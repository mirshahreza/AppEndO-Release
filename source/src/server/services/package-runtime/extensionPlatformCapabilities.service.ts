import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import {
  packageDirs,
  readPackageIndex,
  readPlatformCapabilitiesApplied,
  removePlatformCapabilitiesApplied,
  writePlatformCapabilitiesApplied,
} from '../../../core/packages/PackageFileStore';
import {
  deleteNavigationFile,
  readNavigationFile,
  readShellFile,
  withPlatformRegistryLock,
  writeNavigationFile,
  writeShellFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import { loadPlatformRegistryDefaultShells } from '../../../core/platform-registry/loadPlatformRegistryDefaults';
import { restoreCoreNavigationManifests, restoreCoreStudioDevelopmentRegistryArtifacts } from '../../../core/platform-registry/platformRegistryDefaults';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import {
  COMPONENT_ALONE_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
  STUDIO_MOUNT_ID,
  STUDIO_PORTAL_SEGMENT,
} from '../../../shared/api/contracts/platform/mountConstants';
import type { PlatformShell } from '../../../shared/api/contracts/platform/types';
import type { ExperienceManifest } from '../../../shared/api/contracts/platform/experienceManifest';
import {
  isBuiltInPortal,
  validatePackageExtensionPortals,
} from '../../../shared/api/contracts/platform/experienceManifest';
import {
  isBuiltInNavigationId,
  validateNavigationManifest,
  type NavigationManifest,
} from '../../../shared/api/contracts/platform/navigation';
import type { ExtensionPlatformCapabilitiesApplied } from '../../../shared/api/contracts/package-manifest/extensionPlatformCapabilities';
import {
  deletePlatformRouteBinding,
  findPlatformRouteBindingById,
} from '../../domain/platform/routeBindingRepository';
import { deletePlatformShell, updatePlatformShell } from '../../domain/platform/shellRepository';
import {
  compileExperienceManifest,
  type CompileExperienceManifestResult,
} from '../platform/compileExperienceManifest';
import { invalidatePlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';
import type { DeploymentConflict } from './packageDeployment.service';

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function readJsonFromArtifact(
  packageId: string,
  version: string,
  entryPath: string,
): unknown | null {
  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) return null;

  const zip = new AdmZip(artifactPath);
  const normalized = normalizeZipEntryName(entryPath);
  const entry = zip.getEntries().find((item) => normalizeZipEntryName(item.entryName) === normalized);
  if (!entry || entry.isDirectory) return null;

  try {
    return JSON.parse(entry.getData().toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

function packageActor(packageId: string): PlatformRegistryActor {
  return { userId: null, username: `package:${packageId}` };
}

function toPortalCompileResult(
  result: CompileExperienceManifestResult,
): ExtensionPlatformCapabilitiesApplied['portalCompile'] {
  return {
    navigationIds: result.navigationIds,
    shellKeys: result.shellKeys,
    routeBindingIds: result.routeBindingIds,
    pageModulesCreated: result.pageModulesCreated,
    pageModulesUpdated: result.pageModulesUpdated,
    bindingsRemoved: result.bindingsRemoved,
  };
}

export function hasExtensionPlatformCapabilities(manifest: PackageManifest): boolean {
  return (manifest.capabilities.navigations?.length ?? 0) > 0
    || (manifest.capabilities.portals?.length ?? 0) > 0;
}

export function collectExtensionPlatformCapabilitiesConflicts(
  packageId: string,
  manifest: PackageManifest,
): DeploymentConflict[] {
  const conflicts: DeploymentConflict[] = [];

  for (const navigation of manifest.capabilities.navigations ?? []) {
    if (isBuiltInNavigationId(navigation.id)) {
      conflicts.push({
        field: `capabilities.navigations.${navigation.id}`,
        message: `Navigation "${navigation.id}" is built-in and cannot be published by a package.`,
      });
    }
  }

  for (const portal of manifest.capabilities.portals ?? []) {
    if (!portal.segment?.trim()) {
      conflicts.push({
        field: 'capabilities.portals',
        message: 'Portal segment is required.',
      });
      continue;
    }
    if (isBuiltInPortal({ segment: portal.segment })) {
      conflicts.push({
        field: `capabilities.portals.${portal.segment}`,
        message: `Portal "${portal.segment}" is built-in and cannot be published by a package.`,
      });
    }
  }

  void packageId;
  return conflicts;
}

export async function applyExtensionPlatformCapabilities(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<{ ok: true } | { ok: false; error: string; details?: string[] }> {
  if (!hasExtensionPlatformCapabilities(manifest)) {
    return { ok: true };
  }

  const conflicts = collectExtensionPlatformCapabilitiesConflicts(packageId, manifest);
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Install blocked due to extension portal/navigation conflicts.',
      details: conflicts.map((item) => item.message),
    };
  }

  const appliedNavigationIds: string[] = [];
  const appliedPortalSegments: string[] = [];

  for (const navigationCap of manifest.capabilities.navigations ?? []) {
    const raw = readJsonFromArtifact(packageId, version, navigationCap.entry);
    if (!raw) {
      return {
        ok: false,
        error: `Navigation artifact entry "${navigationCap.entry}" was not found.`,
      };
    }

    const validation = validateNavigationManifest(raw);
    if (!validation.valid) {
      return {
        ok: false,
        error: `Navigation "${navigationCap.id}" failed validation.`,
        details: validation.errors,
      };
    }

    if (validation.manifest.id !== navigationCap.id) {
      return {
        ok: false,
        error: `Navigation capability id "${navigationCap.id}" does not match manifest id "${validation.manifest.id}".`,
      };
    }

    withPlatformRegistryLock(() => {
      writeNavigationFile(validation.manifest);
    });
    appliedNavigationIds.push(validation.manifest.id);
  }

  let portalCompile: ExtensionPlatformCapabilitiesApplied['portalCompile'];
  const portals = manifest.capabilities.portals ?? [];
  if (portals.length > 0) {
    const rawPortals: unknown[] = [];
    for (const portalCap of portals) {
      const raw = readJsonFromArtifact(packageId, version, portalCap.entry);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
          ok: false,
          error: `Portal artifact entry "${portalCap.entry}" was not found or is invalid.`,
        };
      }
      rawPortals.push(raw);
    }

    const validation = validatePackageExtensionPortals(packageId, rawPortals);
    if (!validation.valid) {
      return {
        ok: false,
        error: 'Package portal manifest failed validation.',
        details: validation.errors,
      };
    }

    const extensionPortals = validation.manifest.portals.filter((portal) => !isBuiltInPortal(portal));
    const experienceManifest: ExperienceManifest = {
      id: packageId,
      cultureId: 'us',
      portals: extensionPortals,
    };

    try {
      const compileResult = await compileExperienceManifest(experienceManifest, packageActor(packageId));
      portalCompile = toPortalCompileResult(compileResult);
      appliedPortalSegments.push(...portals.map((portal) => portal.segment));
    } catch (error: unknown) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to compile package portals.',
      };
    }
  }

  writePlatformCapabilitiesApplied({
    schema: 'package-platform-capabilities-applied',
    schemaVersion: '1.0.0',
    packageId,
    version,
    appliedAt: new Date().toISOString(),
    navigations: appliedNavigationIds,
    portals: appliedPortalSegments,
    ...(portalCompile ? { portalCompile } : {}),
  });

  invalidatePlatformRuntimeConfig();
  return { ok: true };
}

const BUILT_IN_SHELL_KEYS = new Set([
  STUDIO_PORTAL_SEGMENT,
  COMPONENT_ALONE_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
]);

function getBuiltInShellDefault(shellKey: string): PlatformShell | undefined {
  return loadPlatformRegistryDefaultShells().find((shell) => shell.shellKey === shellKey);
}

async function restoreBuiltInShellFromDefaults(
  shellKey: string,
  actor: PlatformRegistryActor,
): Promise<void> {
  const defaultShell = getBuiltInShellDefault(shellKey);
  if (!defaultShell) {
    return;
  }

  const current = readShellFile(shellKey);
  if (!current) {
    withPlatformRegistryLock(() => {
      writeShellFile(defaultShell);
    });
    return;
  }

  await updatePlatformShell(
    shellKey,
    {
      name: defaultShell.name,
      entry: defaultShell.entry,
      surface: defaultShell.surface,
      enabled: defaultShell.enabled,
      entryMode: defaultShell.entryMode ?? 'shell',
      redirectToSegment: defaultShell.redirectToSegment ?? null,
      redirectToCulture: defaultShell.redirectToCulture ?? null,
      auth: defaultShell.auth ?? null,
      navigationRef: defaultShell.navigationRef ?? null,
      source: defaultShell.source ?? null,
    },
    actor,
  );
}

const CORE_STUDIO_ROUTE_BINDING_PAGE_KEYS = new Set([
  'server-functions',
  'client-components',
]);

function rollbackPortalCompile(
  portalCompile: ExtensionPlatformCapabilitiesApplied['portalCompile'],
  actor: PlatformRegistryActor,
): Promise<void> {
  if (!portalCompile) return Promise.resolve();

  return (async () => {
    for (const bindingId of portalCompile.routeBindingIds) {
      const binding = await findPlatformRouteBindingById(bindingId);
      if (
        binding?.mountId === STUDIO_MOUNT_ID
        && CORE_STUDIO_ROUTE_BINDING_PAGE_KEYS.has(binding.pageKey)
      ) {
        continue;
      }

      await deletePlatformRouteBinding(bindingId);
    }

    for (const shellKey of portalCompile.shellKeys) {
      if (BUILT_IN_SHELL_KEYS.has(shellKey)) {
        await restoreBuiltInShellFromDefaults(shellKey, actor);
      } else {
        await deletePlatformShell(shellKey);
      }
    }

    for (const navigationId of portalCompile.navigationIds) {
      if (!isBuiltInNavigationId(navigationId) && readNavigationFile(navigationId)) {
        withPlatformRegistryLock(() => {
          deleteNavigationFile(navigationId);
        });
      }
    }
  })();
}

export async function rollbackExtensionPlatformCapabilities(
  packageId: string,
  manifest?: PackageManifest | null,
): Promise<void> {
  const applied = readPlatformCapabilitiesApplied(packageId);
  const actor = packageActor(packageId);
  const navigationIds = new Set<string>([
    ...(applied?.navigations ?? []),
    ...(manifest?.capabilities.navigations ?? []).map((item) => item.id),
    ...(applied?.portalCompile?.navigationIds ?? []),
  ]);

  const touchedStudioNavigation = applied?.portals?.includes(STUDIO_PORTAL_SEGMENT)
    || (applied?.portalCompile?.navigationIds ?? []).some(
      (navigationId) => navigationId.trim() === STUDIO_PORTAL_SEGMENT,
    );

  if (applied?.portalCompile) {
    await rollbackPortalCompile(applied.portalCompile, actor);
    withPlatformRegistryLock(() => {
      restoreCoreStudioDevelopmentRegistryArtifacts();
      if (touchedStudioNavigation) {
        restoreCoreNavigationManifests();
      }
    });
  }

  for (const navigationId of navigationIds) {
    const normalizedId = navigationId.trim();
    if (!normalizedId || isBuiltInNavigationId(normalizedId)) continue;
    if (!readNavigationFile(normalizedId)) continue;

    withPlatformRegistryLock(() => {
      deleteNavigationFile(normalizedId);
    });
  }

  removePlatformCapabilitiesApplied(packageId);
  invalidatePlatformRuntimeConfig();
}

export function readPackageNavigationManifestFromArtifact(
  packageId: string,
  version: string,
  entryPath: string,
): NavigationManifest | null {
  const raw = readJsonFromArtifact(packageId, version, entryPath);
  if (!raw) return null;
  const validation = validateNavigationManifest(raw);
  return validation.valid ? validation.manifest : null;
}
