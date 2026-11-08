import { createHash } from 'crypto';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  listPlatformMountRows,
  listPlatformPageModuleRows,
  listPlatformRouteBindingRows,
  listPlatformShellRuleRows,
  listPlatformShellRows,
} from '../../domain/platform';
import { listNavigationFiles, readPlatformRegistryIndex } from '../../../core/platform-registry/PlatformRegistryFileStore';
import { listDeploymentAppliedRecords } from '../../../core/packages/PackageFileStore';
import {
  deploymentAppliedToPlatformRows,
  mergeDeploymentPlatformRows,
} from './packageDeploymentToPlatformRows';
import {
  applyRemoteHubsChromeToBindings,
  applyRemoteHubsChromeToPageModules,
  ensureRemoteHubsNavigationIfInstalled,
  filterRemoteHubsHostRowsUnlessInstalled,
  filterRemoteHubsNavigationUnlessInstalled,
  isRemoteHubsRuntimeEnabled,
} from '../remote-hubs/remoteHubsRuntime';
import { coerceHawietyPackagePageModule, HAWIETY_PACKAGE_ID } from '../../../core/packages/hawietyPackage';
import {
  filterHawietyHostRowsUnlessInstalled,
  filterHawietyNavigationsUnlessInstalled,
  isHawietyRuntimeEnabled,
} from '../hawiety/hawietyRuntime';

let cachedConfig: PlatformRuntimeConfig | null = null;
let cachedConfigIndexUpdatedAt: string | null = null;

/**
 * The in-memory cache below is per-process. Writes made by another process (an install
 * script, a second server instance, etc.) call touchPlatformRegistryIndex() but can't
 * reach this process's `cachedConfig` — without this check, this process would keep
 * serving a stale config until it happened to restart. `readPlatformRegistryIndex()` is
 * one small JSON file read, cheap enough to do on every call.
 */
function isCachedConfigStale(): boolean {
  if (!cachedConfig) return true;
  const currentIndexUpdatedAt = readPlatformRegistryIndex().updatedAt;
  return currentIndexUpdatedAt !== cachedConfigIndexUpdatedAt;
}

/** Package-owned registry rows stay out of core until that package runtime is enabled (Hawiety registry publish). */
function filterCoreRows<T extends { ownerPackageId?: string | null }>(rows: T[]): T[] {
  return rows.filter((item) => {
    if (!item.ownerPackageId) {
      return true;
    }
    if (item.ownerPackageId === HAWIETY_PACKAGE_ID && isHawietyRuntimeEnabled()) {
      return true;
    }
    return false;
  });
}

export function computePlatformRuntimeVersion(
  config: Omit<PlatformRuntimeConfig, 'version'>,
  deploymentFingerprints: string[] = [],
): string {
  const maxUpdatedAt = [
    ...config.mounts,
    ...config.shells,
    ...config.shellRules,
    ...config.pageModules,
    ...config.bindings,
    ...config.navigations,
  ]
    .map((item) => item.updatedAt || item.createdAt || '')
    .filter(Boolean)
    .sort()
    .at(-1) ?? '';

  const payload = JSON.stringify({
    maxUpdatedAt,
    deploymentFingerprints,
    mounts: config.mounts,
    shells: config.shells,
    shellRules: config.shellRules,
    pageModules: config.pageModules,
    bindings: config.bindings,
    navigations: config.navigations,
  });

  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function loadDeploymentOverlay() {
  let overlay = {
    mounts: [] as ReturnType<typeof deploymentAppliedToPlatformRows>['mounts'],
    shells: [] as ReturnType<typeof deploymentAppliedToPlatformRows>['shells'],
    shellRules: [] as ReturnType<typeof deploymentAppliedToPlatformRows>['shellRules'],
    pageModules: [] as ReturnType<typeof deploymentAppliedToPlatformRows>['pageModules'],
    bindings: [] as ReturnType<typeof deploymentAppliedToPlatformRows>['bindings'],
  };

  const fingerprints: string[] = [];
  for (const applied of listDeploymentAppliedRecords()) {
    fingerprints.push(`${applied.packageId}@${applied.version}:${applied.appliedAt}`);
    overlay = mergeDeploymentPlatformRows(overlay, deploymentAppliedToPlatformRows(applied));
  }

  return { overlay, fingerprints };
}

export async function loadPlatformRuntimeConfig(): Promise<PlatformRuntimeConfig> {
  const [mounts, shells, shellRules, pageModules, bindings, navigations] = await Promise.all([
    listPlatformMountRows(),
    listPlatformShellRows(),
    listPlatformShellRuleRows(),
    listPlatformPageModuleRows(),
    listPlatformRouteBindingRows(),
    Promise.resolve(listNavigationFiles()),
  ]);

  const core = {
    mounts: filterCoreRows(mounts),
    shells: filterCoreRows(shells),
    shellRules: filterCoreRows(shellRules),
    pageModules: filterCoreRows(pageModules),
    bindings: filterCoreRows(bindings),
    navigations,
  };

  const { overlay, fingerprints } = loadDeploymentOverlay();
  const merged = mergeDeploymentPlatformRows(core, overlay);
  const hawietyAwarePageModules = isHawietyRuntimeEnabled()
    ? merged.pageModules.map((module) => coerceHawietyPackagePageModule(module))
    : merged.pageModules;
  const filteredPageModules = applyRemoteHubsChromeToPageModules(
    filterRemoteHubsHostRowsUnlessInstalled(
      filterHawietyHostRowsUnlessInstalled(hawietyAwarePageModules),
    ),
  );
  const filteredBindings = applyRemoteHubsChromeToBindings(
    filterRemoteHubsHostRowsUnlessInstalled(
      filterHawietyHostRowsUnlessInstalled(merged.bindings),
    ),
  );
  const withNavigations = {
    ...merged,
    mounts: filterHawietyHostRowsUnlessInstalled(merged.mounts),
    shells: filterHawietyHostRowsUnlessInstalled(merged.shells),
    shellRules: filterHawietyHostRowsUnlessInstalled(merged.shellRules),
    navigations: filterHawietyNavigationsUnlessInstalled(
      core.navigations
        .map(ensureRemoteHubsNavigationIfInstalled)
        .map(filterRemoteHubsNavigationUnlessInstalled),
    ),
    pageModules: filteredPageModules,
    bindings: filteredBindings,
  };
  const gatedFingerprints = [
    ...fingerprints,
    `remote-hubs:${isRemoteHubsRuntimeEnabled() ? 'on' : 'off'}`,
    `hawiety:${isHawietyRuntimeEnabled() ? 'on' : 'off'}`,
  ];

  return {
    ...withNavigations,
    version: computePlatformRuntimeVersion(withNavigations, gatedFingerprints),
  };
}

export async function getPlatformRuntimeConfig(): Promise<PlatformRuntimeConfig> {
  if (isCachedConfigStale()) {
    cachedConfigIndexUpdatedAt = readPlatformRegistryIndex().updatedAt;
    cachedConfig = await loadPlatformRuntimeConfig();
  }
  return cachedConfig!;
}

export function invalidatePlatformRuntimeConfig(): void {
  cachedConfig = null;
  cachedConfigIndexUpdatedAt = null;
}

export function __setPlatformRuntimeConfigCacheForTests(
  config: PlatformRuntimeConfig | null,
): void {
  cachedConfig = config;
  cachedConfigIndexUpdatedAt = config ? readPlatformRegistryIndex().updatedAt : null;
}
