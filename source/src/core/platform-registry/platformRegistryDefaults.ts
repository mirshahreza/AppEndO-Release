import fs from 'fs';
import path from 'path';
import {
  STUDIO_MOUNT_ID,
  SITE_PORTAL_SEGMENT,
  SITE_PORTAL_PAGE_KEYS,
  portalBindingIdentityKey,
  toPortalRoutePattern,
} from '../../shared/api/contracts/platform/mountConstants';
import {
  EXTENSIONS_NAV_GROUP,
  LEGACY_LIBRARIES_ROUTE_PATTERN,
  LEGACY_PACKAGE_MANAGER_ROUTE_PATTERN,
  LIBRARIES_PAGE_KEY,
  LIBRARIES_ROUTE_PATTERN,
  PACKAGE_MANAGER_PAGE_KEY,
  PACKAGE_MANAGER_ROUTE_PATTERN,
} from '../../shared/api/contracts/platform/studioPageSeeds';
import type { PlatformRouteBinding } from '../../shared/api/contracts/platform/types';
import { atomicWriteText, atomicWriteTextIfChanged } from '../runtime/RuntimeFileStore';
import {
  ensurePlatformRegistryDirs,
  listMountFiles,
  listRouteBindingFiles,
  touchPlatformRegistryIndex,
  writeRouteBindingFile,
} from './PlatformRegistryFileStore';
import { isRegistryEntityDeleted } from './platformRegistryDeletions';
import { platformRegistryDirs } from './platformRegistryPaths';

export const PLATFORM_REGISTRY_DEFAULTS_ROOT = path.join(process.cwd(), 'src/config/platform-registry');

const ENTITY_DIRS = ['mounts', 'shells', 'page-modules', 'shell-rules', 'route-bindings', 'navigation'] as const;

/** Core navigation manifests shipped with the app — always mirror src/config on boot. */
const CORE_NAVIGATION_SYNC_IDS = ['studio'] as const;

/** Core page modules + route bindings always mirrored from src/config on boot. */
const CORE_REGISTRY_SYNC_PAGE_KEYS = [
  'platform-transfer',
  'file-manager',
  'workflows',
  'settings',
  'idea-foundry',
  'my-workbooks',
  'in-app-notifications',
] as const;

const CORE_SHELL_SYNC_KEYS: readonly string[] = [];

function isSitePortalPageKey(pageKey: string): boolean {
  return (SITE_PORTAL_PAGE_KEYS as readonly string[]).includes(pageKey);
}

function isSitePortalDefaultSuppressed(): boolean {
  return isRegistryEntityDeleted('shells', SITE_PORTAL_SEGMENT);
}

function shouldSkipSitePortalDefault(
  dirName: (typeof ENTITY_DIRS)[number],
  entityId: string,
  sourcePath: string,
): boolean {
  if (!isSitePortalDefaultSuppressed()) {
    return false;
  }

  if (dirName === 'shells' || dirName === 'navigation') {
    return entityId === SITE_PORTAL_SEGMENT;
  }

  if (dirName === 'page-modules') {
    return isSitePortalPageKey(entityId);
  }

  if (dirName === 'route-bindings') {
    const binding = readJsonFile<{ pageKey?: string }>(sourcePath);
    return Boolean(binding?.pageKey && isSitePortalPageKey(binding.pageKey));
  }

  return false;
}

function copyJsonFile(sourcePath: string, targetPath: string): boolean {
  const payload = fs.readFileSync(sourcePath, 'utf8');
  return atomicWriteTextIfChanged(targetPath, payload, platformRegistryDirs.tmp);
}

const STRIP_SEPARATOR_BEFORE_PAGE_KEYS = new Set(['platform-portals', 'base-components']);

function normalizeBindingNavForStudioSync(binding: PlatformRouteBinding): PlatformRouteBinding {
  if (!STRIP_SEPARATOR_BEFORE_PAGE_KEYS.has(binding.pageKey) || !binding.nav) {
    return binding;
  }

  const nav = { ...(binding.nav as Record<string, unknown>) };
  delete nav.separatorBefore;
  return { ...binding, nav: nav as PlatformRouteBinding['nav'] };
}

function bindingsEquivalentForStudioSync(
  left: PlatformRouteBinding,
  right: PlatformRouteBinding,
): boolean {
  return JSON.stringify(normalizeBindingNavForStudioSync(left))
    === JSON.stringify(normalizeBindingNavForStudioSync(right));
}

function syncCoreRouteBindingFromDefault(sourcePath: string): boolean {
  const defaultBinding = readJsonFile<PlatformRouteBinding>(sourcePath);
  if (!defaultBinding) {
    return false;
  }

  const currentBindings = listRouteBindingFiles();
  const currentForPattern = currentBindings.find(
    (binding) =>
      binding.mountId === defaultBinding.mountId
      && portalBindingIdentityKey(binding.routePattern, binding.pageKey)
        === portalBindingIdentityKey(defaultBinding.routePattern, defaultBinding.pageKey),
  );
  if (currentForPattern) {
    const next = { ...defaultBinding, id: currentForPattern.id };
    if (bindingsEquivalentForStudioSync(next, currentForPattern)) {
      return false;
    }
    return writeRouteBindingFile(next);
  }

  const idCollision = currentBindings.some((binding) => binding.id === defaultBinding.id);
  const id = idCollision
    ? Math.max(0, ...currentBindings.map((binding) => binding.id)) + 1
    : defaultBinding.id;
  return writeRouteBindingFile({ ...defaultBinding, id });
}

type CoreNavManifestShape = {
  groups?: Array<{ heading?: string | null; order?: number }>;
  [key: string]: unknown;
};

function syncCoreNavigationManifests(): void {
  const navigationDir = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'navigation');
  if (!fs.existsSync(navigationDir)) {
    return;
  }

  const targetNavigationDir = path.join(platformRegistryDirs.root, 'navigation');
  fs.mkdirSync(targetNavigationDir, { recursive: true });

  let registryChanged = false;

  for (const manifestId of CORE_NAVIGATION_SYNC_IDS) {
    if (isRegistryEntityDeleted('navigation', manifestId)) {
      continue;
    }
    const sourcePath = path.join(navigationDir, `${manifestId}.json`);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const targetPath = path.join(targetNavigationDir, `${manifestId}.json`);
    const defaults = readJsonFile<CoreNavManifestShape>(sourcePath);
    const current = fs.existsSync(targetPath) ? readJsonFile<CoreNavManifestShape>(targetPath) : null;

    // Preserve headed groups authored into the live manifest that the shipped defaults don't
    // know about (opt-in package sidebars like heading=`CMS`) — a blind copy wipes them on
    // every boot.
    const defaultGroups = Array.isArray(defaults?.groups) ? defaults.groups : null;
    const currentGroups = Array.isArray(current?.groups) ? current.groups : null;
    if (!defaults || !defaultGroups || !currentGroups) {
      registryChanged = copyJsonFile(sourcePath, targetPath) || registryChanged;
      continue;
    }

    const defaultHeadings = new Set(defaultGroups.map((group) => group.heading ?? null));
    const preservedGroups = currentGroups.filter((group) => {
      const heading = group.heading ?? null;
      return heading !== null && !defaultHeadings.has(heading);
    });

    if (preservedGroups.length === 0) {
      registryChanged = copyJsonFile(sourcePath, targetPath) || registryChanged;
      continue;
    }

    const merged: CoreNavManifestShape = {
      ...defaults,
      groups: [...defaultGroups, ...preservedGroups].sort(
        (left, right) => (left.order ?? 999) - (right.order ?? 999),
      ),
    };
    registryChanged = atomicWriteTextIfChanged(
      targetPath,
      `${JSON.stringify(merged, null, 2)}\n`,
      platformRegistryDirs.tmp,
    ) || registryChanged;
  }

  if (registryChanged) {
    touchPlatformRegistryIndex();
  }
}

/** Restore shipped core navigation manifests after package portal rollback. */
export function restoreCoreNavigationManifests(): void {
  syncCoreNavigationManifests();
}

/** Core shell rules always mirrored from src/config on boot. */
const CORE_SHELL_RULE_SYNC_PATH_PREFIXES = ['/studio/client-components'] as const;

function syncCoreShellRulesFromDefaults(): void {
  const sourceDir = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'shell-rules');
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  ensurePlatformRegistryDirs();
  fs.mkdirSync(platformRegistryDirs.shellRules, { recursive: true });

  for (const name of fs.readdirSync(sourceDir)) {
    if (!name.endsWith('.json')) {
      continue;
    }

    const sourcePath = path.join(sourceDir, name);
    const defaultRule = readJsonFile<{ pathPrefix?: string; ownerPackageId?: string | null }>(sourcePath);
    if (!defaultRule?.pathPrefix) {
      continue;
    }

    if (!CORE_SHELL_RULE_SYNC_PATH_PREFIXES.includes(
      defaultRule.pathPrefix as typeof CORE_SHELL_RULE_SYNC_PATH_PREFIXES[number],
    )) {
      continue;
    }

    if (defaultRule.ownerPackageId) {
      continue;
    }

    copyJsonFile(sourcePath, path.join(platformRegistryDirs.shellRules, name));
  }
}

function syncCoreRegistryArtifactsFromDefaults(): void {
  if (!fs.existsSync(PLATFORM_REGISTRY_DEFAULTS_ROOT)) {
    return;
  }

  ensurePlatformRegistryDirs();

  for (const pageKey of CORE_REGISTRY_SYNC_PAGE_KEYS) {
    if (isSitePortalDefaultSuppressed() && isSitePortalPageKey(pageKey)) {
      continue;
    }
    const sourceModulePath = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', `${pageKey}.json`);
    if (fs.existsSync(sourceModulePath)) {
      copyJsonFile(sourceModulePath, path.join(platformRegistryDirs.pageModules, `${pageKey}.json`));
    }
  }

  const routeBindingsDefaultsDir = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'route-bindings');
  if (!fs.existsSync(routeBindingsDefaultsDir)) {
    return;
  }

  fs.mkdirSync(platformRegistryDirs.routeBindings, { recursive: true });
  for (const name of fs.readdirSync(routeBindingsDefaultsDir)) {
    if (!name.endsWith('.json')) {
      continue;
    }

    const sourcePath = path.join(routeBindingsDefaultsDir, name);
    const binding = readJsonFile<{ pageKey?: string }>(sourcePath);
    if (!binding?.pageKey || !(CORE_REGISTRY_SYNC_PAGE_KEYS as readonly string[]).includes(binding.pageKey)) {
      continue;
    }
    if (isSitePortalDefaultSuppressed() && isSitePortalPageKey(binding.pageKey)) {
      continue;
    }

    syncCoreRouteBindingFromDefault(sourcePath);
  }
}

function syncCoreShellsFromDefaults(): void {
  const sourceDir = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'shells');
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  ensurePlatformRegistryDirs();
  fs.mkdirSync(platformRegistryDirs.shells, { recursive: true });

  for (const shellKey of CORE_SHELL_SYNC_KEYS) {
    if (isRegistryEntityDeleted('shells', shellKey)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, `${shellKey}.json`);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    copyJsonFile(sourcePath, path.join(platformRegistryDirs.shells, `${shellKey}.json`));
  }
}

/** Restore shipped core navigation + registry artifacts after app upgrades. */
export function restoreCorePlatformRegistryArtifacts(): void {
  syncCoreNavigationManifests();
  syncCoreRegistryArtifactsFromDefaults();
  syncCoreShellRulesFromDefaults();
  syncCoreShellsFromDefaults();
}

const CORE_STUDIO_DEVELOPMENT_PAGE_KEYS = new Set([
  'idea-foundry',
  'server-functions',
  'data-studio',
  'client-components',
  'platform-portals',
  'workflows',
  'base-components',
  'appearance',
]);

const CORE_STUDIO_EXTENSIONS_PAGE_KEYS = new Set([
  PACKAGE_MANAGER_PAGE_KEY,
  LIBRARIES_PAGE_KEY,
]);

const CORE_STUDIO_RESTORED_PAGE_KEYS = new Set([
  ...CORE_STUDIO_DEVELOPMENT_PAGE_KEYS,
  ...CORE_STUDIO_EXTENSIONS_PAGE_KEYS,
]);

/** Restore Studio development page modules and route bindings shipped with the app. */
export function restoreCoreStudioDevelopmentRegistryArtifacts(): void {
  if (!fs.existsSync(PLATFORM_REGISTRY_DEFAULTS_ROOT)) {
    return;
  }

  ensurePlatformRegistryDirs();

  let registryChanged = false;

  for (const pageKey of CORE_STUDIO_RESTORED_PAGE_KEYS) {
    const sourcePath = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', `${pageKey}.json`);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    registryChanged = copyJsonFile(
      sourcePath,
      path.join(platformRegistryDirs.pageModules, `${pageKey}.json`),
    ) || registryChanged;
  }

  const routeBindingsDefaultsDir = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'route-bindings');
  if (!fs.existsSync(routeBindingsDefaultsDir)) {
    if (registryChanged) {
      touchPlatformRegistryIndex();
    }
    return;
  }

  fs.mkdirSync(platformRegistryDirs.routeBindings, { recursive: true });
  for (const name of fs.readdirSync(routeBindingsDefaultsDir)) {
    if (!name.endsWith('.json')) {
      continue;
    }

    const sourcePath = path.join(routeBindingsDefaultsDir, name);
    const binding = readJsonFile<{ pageKey?: string }>(sourcePath);
    if (!binding?.pageKey || !CORE_STUDIO_RESTORED_PAGE_KEYS.has(binding.pageKey)) {
      continue;
    }

    registryChanged = syncCoreRouteBindingFromDefault(sourcePath) || registryChanged;
  }

  if (registryChanged) {
    touchPlatformRegistryIndex();
  }
}

/** Self-heal Studio Server Functions / Client Components registry rows on boot. */
export function ensureCoreStudioDevelopmentRegistryArtifacts(): void {
  restoreCoreStudioDevelopmentRegistryArtifacts();
  applyPlatformRegistryCanonicalRenames();
  syncExperienceStudioRouteBindingMirrors();
  restoreCoreNavigationManifests();
}

/** Keep culture-mount mirrors aligned when studio development route patterns change. */
export function syncExperienceStudioRouteBindingMirrors(): void {
  ensurePlatformRegistryDirs();

  const studioBindings = listRouteBindingFiles().filter((binding) => binding.mountId === STUDIO_MOUNT_ID);
  const autoMounts = listMountFiles().filter(
    (mount) => mount.enabled && mount.designerRoutePropagation === 'auto',
  );

  if (studioBindings.length === 0 || autoMounts.length === 0) {
    return;
  }

  for (const mount of autoMounts) {
    for (const studioBinding of studioBindings) {
      const experiencePattern = toPortalRoutePattern(studioBinding.routePattern);
      const studioIdentity = portalBindingIdentityKey(studioBinding.routePattern, studioBinding.pageKey);
      const mirrors = listRouteBindingFiles().filter(
        (binding) =>
          binding.mountId === mount.id
          && portalBindingIdentityKey(binding.routePattern, binding.pageKey) === studioIdentity,
      );

      for (const mirror of mirrors) {
        if (mirror.routePattern === experiencePattern && mirror.enabled === studioBinding.enabled) {
          continue;
        }

        writeRouteBindingFile({
          ...mirror,
          routePattern: experiencePattern,
          enabled: studioBinding.enabled,
        });
      }
    }
  }
}

function copyJsonFiles(sourceDir: string, targetDir: string): void {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const name of fs.readdirSync(sourceDir)) {
    if (!name.endsWith('.json')) {
      continue;
    }

    const payload = fs.readFileSync(path.join(sourceDir, name), 'utf8');
    atomicWriteText(path.join(targetDir, name), payload, platformRegistryDirs.tmp);
  }
}

export function copyPlatformRegistryDefaults(): void {
  if (!fs.existsSync(PLATFORM_REGISTRY_DEFAULTS_ROOT)) {
    throw new Error(`Platform registry defaults are missing at ${PLATFORM_REGISTRY_DEFAULTS_ROOT}.`);
  }

  ensurePlatformRegistryDirs();

  const indexPath = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'index.json');
  if (fs.existsSync(indexPath)) {
    atomicWriteText(
      path.join(platformRegistryDirs.root, 'index.json'),
      fs.readFileSync(indexPath, 'utf8'),
      platformRegistryDirs.tmp,
    );
  }

  for (const dirName of ENTITY_DIRS) {
    copyJsonFiles(
      path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, dirName),
      path.join(platformRegistryDirs.root, dirName),
    );
  }
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown): boolean {
  return atomicWriteTextIfChanged(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    platformRegistryDirs.tmp,
  );
}

function asNavRecord(nav: unknown): Record<string, unknown> {
  return typeof nav === 'object' && nav != null ? { ...(nav as Record<string, unknown>) } : {};
}

function canonicalizeExtensionStudioBinding(binding: Record<string, unknown>): Record<string, unknown> | null {
  const pageKey = String(binding.pageKey ?? '');
  const routePattern = String(binding.routePattern ?? '');
  const isPackageManager = pageKey === 'packages'
    || pageKey === PACKAGE_MANAGER_PAGE_KEY
    || routePattern === 'packages'
    || routePattern === PACKAGE_MANAGER_ROUTE_PATTERN
    || routePattern === LEGACY_PACKAGE_MANAGER_ROUTE_PATTERN;
  const isLibraries = pageKey === LIBRARIES_PAGE_KEY
    && (
      routePattern === LIBRARIES_ROUTE_PATTERN
      || routePattern === LEGACY_LIBRARIES_ROUTE_PATTERN
    );

  if (!isPackageManager && !isLibraries) {
    return null;
  }

  const canonicalPageKey = isPackageManager ? PACKAGE_MANAGER_PAGE_KEY : LIBRARIES_PAGE_KEY;
  const canonicalRoute = isPackageManager ? PACKAGE_MANAGER_ROUTE_PATTERN : LIBRARIES_ROUTE_PATTERN;
  const canonicalLabel = isPackageManager ? 'Package Manager' : 'Libraries';
  const canonicalOrder = isPackageManager ? 1 : 2;
  const { separatorBefore: _removed, ...navWithoutSeparator } = asNavRecord(binding.nav);
  const alreadyCanonical = pageKey === canonicalPageKey
    && routePattern === canonicalRoute
    && navWithoutSeparator.group === EXTENSIONS_NAV_GROUP
    && navWithoutSeparator.order === canonicalOrder
    && navWithoutSeparator.label === canonicalLabel;

  if (alreadyCanonical) {
    return null;
  }

  return {
    ...binding,
    pageKey: canonicalPageKey,
    routePattern: canonicalRoute,
    nav: {
      ...navWithoutSeparator,
      label: canonicalLabel,
      group: EXTENSIONS_NAV_GROUP,
      order: canonicalOrder,
    },
  };
}

function stripLegacyDevelopmentNavSeparators(): void {
  ensurePlatformRegistryDirs();
  const routeBindingsDir = platformRegistryDirs.routeBindings;
  if (!fs.existsSync(routeBindingsDir)) {
    return;
  }

  const pageKeys = new Set(['platform-portals', 'base-components']);

  for (const fileName of fs.readdirSync(routeBindingsDir)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    const bindingPath = path.join(routeBindingsDir, fileName);
    const binding = readJsonFile<Record<string, unknown>>(bindingPath);
    if (!binding?.pageKey || !pageKeys.has(String(binding.pageKey))) {
      continue;
    }

    const nav = binding.nav;
    if (typeof nav !== 'object' || nav == null) {
      continue;
    }

    const navRecord = nav as Record<string, unknown>;
    if (navRecord.separatorBefore !== true) {
      continue;
    }

    const { separatorBefore: _removed, ...navWithoutSeparator } = navRecord;
    writeJsonFile(bindingPath, {
      ...binding,
      nav: navWithoutSeparator,
    });
  }
}

/** One-time canonical renames for dev runtime registries created before slug migrations. */
export function applyPlatformRegistryCanonicalRenames(): void {
  ensurePlatformRegistryDirs();

  const pageModulesDir = platformRegistryDirs.pageModules;
  const routeBindingsDir = platformRegistryDirs.routeBindings;
  const legacyEdgeModulePath = path.join(pageModulesDir, 'edge.json');
  const legacyEdgeFunctionsModulePath = path.join(pageModulesDir, 'edge-functions.json');
  const canonicalServerFunctionsModulePath = path.join(pageModulesDir, 'server-functions.json');
  const legacyApplicationsModulePath = path.join(pageModulesDir, 'platform-applications.json');

  const migrateLegacyEdgePageModule = (legacyPath: string): void => {
    if (!fs.existsSync(legacyPath)) {
      return;
    }

    const legacyModule = readJsonFile<Record<string, unknown>>(legacyPath);
    const canonicalDefaults = readJsonFile<Record<string, unknown>>(
      path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', 'server-functions.json'),
    );

    writeJsonFile(canonicalServerFunctionsModulePath, {
      ...(legacyModule ?? {}),
      ...(canonicalDefaults ?? {}),
      pageKey: 'server-functions',
      title: 'Server Functions',
      loaderRef: 'core:ServerFunctions',
    });
    fs.rmSync(legacyPath, { force: true });
  };

  migrateLegacyEdgePageModule(legacyEdgeModulePath);
  migrateLegacyEdgePageModule(legacyEdgeFunctionsModulePath);

  if (fs.existsSync(legacyApplicationsModulePath)) {
    fs.rmSync(legacyApplicationsModulePath, { force: true });
  }

  const legacyComponentsModulePath = path.join(pageModulesDir, 'components.json');
  const canonicalClientComponentsModulePath = path.join(pageModulesDir, 'client-components.json');
  if (fs.existsSync(legacyComponentsModulePath)) {
    const legacyModule = readJsonFile<Record<string, unknown>>(legacyComponentsModulePath);
    const canonicalDefaults = readJsonFile<Record<string, unknown>>(
      path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', 'client-components.json'),
    );

    writeJsonFile(canonicalClientComponentsModulePath, {
      ...(legacyModule ?? {}),
      ...(canonicalDefaults ?? {}),
      pageKey: 'client-components',
      title: 'Client Components',
      loaderRef: 'core:ComponentDesigner',
    });
    fs.rmSync(legacyComponentsModulePath, { force: true });
  }

  const legacyPackagesModulePath = path.join(pageModulesDir, 'packages.json');
  const canonicalPackageManagerModulePath = path.join(pageModulesDir, 'package-manager.json');
  if (fs.existsSync(legacyPackagesModulePath)) {
    const legacyModule = readJsonFile<Record<string, unknown>>(legacyPackagesModulePath);
    const canonicalDefaults = readJsonFile<Record<string, unknown>>(
      path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', 'package-manager.json'),
    );

    writeJsonFile(canonicalPackageManagerModulePath, {
      ...(legacyModule ?? {}),
      ...(canonicalDefaults ?? {}),
      pageKey: 'package-manager',
      title: 'Package Manager',
      loaderRef: 'core:PackageManager',
    });
    fs.rmSync(legacyPackagesModulePath, { force: true });
  }

  const legacyWorkflowDesignerModulePath = path.join(pageModulesDir, 'workflow-designer.json');
  const canonicalWorkflowsModulePath = path.join(pageModulesDir, 'workflows.json');
  if (fs.existsSync(legacyWorkflowDesignerModulePath)) {
    const legacyModule = readJsonFile<Record<string, unknown>>(legacyWorkflowDesignerModulePath);
    const canonicalDefaults = readJsonFile<Record<string, unknown>>(
      path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', 'workflows.json'),
    );

    writeJsonFile(canonicalWorkflowsModulePath, {
      ...(legacyModule ?? {}),
      ...(canonicalDefaults ?? {}),
      pageKey: 'workflows',
      title: 'Workflows',
      loaderRef: 'core:Workflows',
    });
    fs.rmSync(legacyWorkflowDesignerModulePath, { force: true });
  }

  const legacySandboxModulePath = path.join(pageModulesDir, 'sandbox.json');
  const canonicalBaseComponentsModulePath = path.join(pageModulesDir, 'base-components.json');
  if (fs.existsSync(legacySandboxModulePath)) {
    const legacyModule = readJsonFile<Record<string, unknown>>(legacySandboxModulePath);
    const canonicalDefaults = readJsonFile<Record<string, unknown>>(
      path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', 'base-components.json'),
    );

    writeJsonFile(canonicalBaseComponentsModulePath, {
      ...(legacyModule ?? {}),
      ...(canonicalDefaults ?? {}),
      pageKey: 'base-components',
      title: 'Base Components',
      loaderRef: 'core:BaseComponents',
    });
    fs.rmSync(legacySandboxModulePath, { force: true });
  }

  const legacyHttpConnectionsModulePath = path.join(pageModulesDir, 'http-connections.json');
  const canonicalApiTalkModulePath = path.join(pageModulesDir, 'api-talk.json');
  if (fs.existsSync(legacyHttpConnectionsModulePath) || fs.existsSync(canonicalApiTalkModulePath)) {
    const legacyModule = fs.existsSync(legacyHttpConnectionsModulePath)
      ? readJsonFile<Record<string, unknown>>(legacyHttpConnectionsModulePath)
      : readJsonFile<Record<string, unknown>>(canonicalApiTalkModulePath);
    const canonicalDefaults = readJsonFile<Record<string, unknown>>(
      path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'page-modules', 'api-talk.json'),
    );

    writeJsonFile(canonicalApiTalkModulePath, {
      ...(legacyModule ?? {}),
      ...(canonicalDefaults ?? {}),
      pageKey: 'api-talk',
      title: 'API Talk',
      loaderRef: 'core:ApiTalk',
    });
    fs.rmSync(legacyHttpConnectionsModulePath, { force: true });
  }

  fs.rmSync(path.join(pageModulesDir, 'layouts.json'), { force: true });
  fs.rmSync(path.join(pageModulesDir, 'layout-templates.json'), { force: true });

  const shellRulesDir = platformRegistryDirs.shellRules;
  if (fs.existsSync(shellRulesDir)) {
    for (const fileName of fs.readdirSync(shellRulesDir)) {
      if (!fileName.endsWith('.json')) {
        continue;
      }

      const rulePath = path.join(shellRulesDir, fileName);
      const rule = readJsonFile<Record<string, unknown>>(rulePath);
      if (!rule) {
        continue;
      }

      if (rule.pathPrefix === '/studio/components') {
        writeJsonFile(rulePath, {
          ...rule,
          pathPrefix: '/studio/client-components',
        });
      }
    }
  }

  const edgeBindingPath = path.join(routeBindingsDir, '2.json');
  const edgeBinding = readJsonFile<Record<string, unknown>>(edgeBindingPath);
  if (edgeBinding) {
    writeJsonFile(edgeBindingPath, {
      ...edgeBinding,
      routePattern: 'server-functions/*',
      pageKey: 'server-functions',
      nav: {
        ...(typeof edgeBinding.nav === 'object' && edgeBinding.nav != null ? edgeBinding.nav as object : {}),
        label: 'Server Functions',
      },
    });
  }

  for (const fileName of fs.readdirSync(routeBindingsDir)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    const bindingPath = path.join(routeBindingsDir, fileName);
    const binding = readJsonFile<Record<string, unknown>>(bindingPath);
    if (!binding) {
      continue;
    }

    if (binding.pageKey === 'components' || binding.routePattern === 'components') {
      writeJsonFile(bindingPath, {
        ...binding,
        pageKey: 'client-components',
        routePattern: 'client-components/*',
        nav: {
          ...(typeof binding.nav === 'object' && binding.nav != null ? binding.nav as object : {}),
          label: 'Client Components',
        },
      });
      continue;
    }

    if (binding.pageKey === 'platform-applications') {
      writeJsonFile(bindingPath, {
        ...binding,
        pageKey: 'platform-portals',
        routePattern: 'portals',
        nav: {
          ...(typeof binding.nav === 'object' && binding.nav != null ? binding.nav as object : {}),
          label: 'Portals',
        },
      });
      continue;
    }

    if (binding.pageKey === 'http-connections' || binding.routePattern === 'http-connections') {
      writeJsonFile(bindingPath, {
        ...binding,
        pageKey: 'api-talk',
        routePattern: 'api-talk',
        nav: {
          ...(typeof binding.nav === 'object' && binding.nav != null ? binding.nav as object : {}),
          label: 'API Talk',
          description: 'Send HTTP requests, organize collections, and inspect responses from Studio.',
        },
      });
      continue;
    }

    const extensionBinding = canonicalizeExtensionStudioBinding(binding);
    if (extensionBinding) {
      writeRouteBindingFile(extensionBinding as PlatformRouteBinding);
      continue;
    }

    if (
      binding.pageKey === 'sandbox'
      || binding.routePattern === 'sandbox'
      || binding.routePattern === 'sandbox/*'
    ) {
      writeJsonFile(bindingPath, {
        ...binding,
        pageKey: 'base-components',
        routePattern: 'base-components/*',
        nav: {
          ...(typeof binding.nav === 'object' && binding.nav != null ? binding.nav as object : {}),
          label: 'Base Components',
          description: 'Interactive catalog of shared UI components and standards previews.',
          icon: 'tabler:IconComponents',
        },
      });
      continue;
    }

    if (binding.routePattern === 'applications' && binding.pageKey === 'platform-portals') {
      writeJsonFile(bindingPath, {
        ...binding,
        routePattern: 'portals',
      });
      continue;
    }

    if (binding.pageKey === 'server-functions' && binding.routePattern === 'server-functions') {
      writeJsonFile(bindingPath, {
        ...binding,
        routePattern: 'server-functions/*',
      });
      continue;
    }

    if (
      binding.pageKey === 'sources'
      && (
        binding.routePattern === 'data-sources'
        || binding.routePattern === 'studio/data-sources'
      )
    ) {
      writeJsonFile(bindingPath, {
        ...binding,
        routePattern: binding.mountId === STUDIO_MOUNT_ID
          ? 'data-sources/*'
          : 'studio/data-sources/*',
      });
      continue;
    }

    if (
      binding.pageKey === 'client-components'
      && (
        binding.routePattern === 'client-components'
        || binding.routePattern === 'components'
        || binding.routePattern === 'studio/client-components'
      )
    ) {
      writeJsonFile(bindingPath, {
        ...binding,
        routePattern: binding.mountId === STUDIO_MOUNT_ID
          ? 'client-components/*'
          : 'studio/client-components/*',
      });
      continue;
    }

    if (
      binding.pageKey === 'workflows'
      && (
        binding.routePattern === 'workflows/*'
        || binding.routePattern === 'workflow-designer'
        || binding.routePattern === 'workflow-designer/*'
        || binding.routePattern === 'workflows/edit/*'
      )
    ) {
      const keepListNav = binding.id === 27 || Boolean(
        binding.nav
        && typeof binding.nav === 'object'
        && 'label' in binding.nav
        && Boolean((binding.nav as { label?: string }).label?.trim()),
      );

      writeJsonFile(bindingPath, {
        ...binding,
        routePattern: keepListNav ? 'workflows' : 'workflows/edit/*',
        nav: keepListNav
          ? {
            ...(typeof binding.nav === 'object' && binding.nav != null ? binding.nav as object : {}),
            label: 'Workflows',
            description: 'Author, validate, publish and simulate workflow definitions.',
          }
          : null,
      });
      continue;
    }

    if (
      binding.pageKey === 'workflow-designer'
      || binding.routePattern === 'workflow-designer'
      || binding.routePattern === 'workflow-designer/*'
    ) {
      const keepListNav = binding.id === 27 || Boolean(
        binding.nav
        && typeof binding.nav === 'object'
        && 'label' in binding.nav
        && Boolean((binding.nav as { label?: string }).label?.trim()),
      );

      writeJsonFile(bindingPath, {
        ...binding,
        pageKey: 'workflows',
        routePattern: keepListNav ? 'workflows' : 'workflows/edit/*',
        nav: keepListNav
          ? {
            ...(typeof binding.nav === 'object' && binding.nav != null ? binding.nav as object : {}),
            label: 'Workflows',
            description: 'Author, validate, publish and simulate workflow definitions.',
          }
          : null,
      });
    }
  }

  stripLegacyDevelopmentNavSeparators();
}

/** Copy canonical defaults that are not yet present in the live runtime registry. */
export function syncMissingPlatformRegistryDefaults(): void {
  if (!fs.existsSync(PLATFORM_REGISTRY_DEFAULTS_ROOT)) {
    return;
  }

  ensurePlatformRegistryDirs();

  let copied = false;
  for (const dirName of ENTITY_DIRS) {
    const sourceDir = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, dirName);
    const targetDir = path.join(platformRegistryDirs.root, dirName);

    if (!fs.existsSync(sourceDir)) {
      continue;
    }

    fs.mkdirSync(targetDir, { recursive: true });

    for (const name of fs.readdirSync(sourceDir)) {
      if (!name.endsWith('.json')) {
        continue;
      }

      const targetPath = path.join(targetDir, name);
      const entityId = name.replace(/\.json$/i, '');
      const sourcePath = path.join(sourceDir, name);
      if (isRegistryEntityDeleted(dirName, entityId) || shouldSkipSitePortalDefault(dirName, entityId, sourcePath)) {
        continue;
      }
      if (fs.existsSync(targetPath)) {
        continue;
      }

      const payload = fs.readFileSync(path.join(sourceDir, name), 'utf8');
      atomicWriteText(targetPath, payload, platformRegistryDirs.tmp);
      copied = true;
    }
  }

  if (copied) {
    touchPlatformRegistryIndex();
  }

  applyPlatformRegistryCanonicalRenames();
}
