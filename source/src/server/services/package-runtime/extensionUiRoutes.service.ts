import fs from 'fs';
import path from 'path';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { packageDirs, atomicWriteText, writeDeploymentApplied } from '../../../core/packages/PackageFileStore';
import {
  buildExtensionUiRoutePreviewRoute,
} from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';
import type {
  ExtensionUiRouteCapability,
  ExtensionUiRoutesPreview,
} from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';
import type { ExtensionUiRoutesDeploymentApplied } from '../../../shared/api/contracts/package-manifest/deploymentApplied';
import type { VerticalAppDeploymentPreview } from '../../../shared/api/contracts/package-manifest/verticalApp';
import {
  isExtensionUiRoutesPreview,
  isVerticalAppDeploymentPreview,
} from '../../../shared/api/contracts/package-manifest/deploymentPreview';
import { findPlatformMountById } from '../../domain/platform/mountRepository';
import { resolveExperienceManifestPageKey } from '../../../shared/lib/designerComponentPath';
import { packageStudioSidebarChrome } from '../../../shared/lib/packageStudioSidebar';
import { invalidatePlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';
import {
  removeDeploymentPreview,
  type DeploymentConflict,
} from './packageDeployment.service';
import {
  CORE_PLATFORM_OWNER,
  findEffectivePageModuleOwner,
  findEffectiveRouteBindingOwner,
} from './deploymentConflictScan';

export type PluginRegistryProposalPreview =
  | VerticalAppDeploymentPreview
  | ExtensionUiRoutesPreview;

export type ExtensionUiRoutesApplyResult =
  | { ok: true; status: 'pending' }
  | { ok: true; status: 'applied' }
  | { ok: false; error: string; details?: string[]; conflicts?: DeploymentConflict[] };

function deploymentPreviewPath(packageId: string): string {
  return path.join(packageDirs.installed, `${packageId}.deployment-preview.json`);
}

function normalizeRoutePattern(value: string): string {
  return String(value || '').trim().replace(/^\/+/, '');
}

export function buildExtensionUiRoutesPreview(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): ExtensionUiRoutesPreview {
  const routes = (manifest.capabilities.ui_routes ?? []).map((route) => {
    const preview = buildExtensionUiRoutePreviewRoute(packageId, route);
    const chrome = packageStudioSidebarChrome(route.pageKey);
    if (!chrome) {
      return preview;
    }
    return {
      ...preview,
      title: chrome.label,
      routePattern: chrome.routePattern,
    };
  });

  return {
    schema: 'package-ui-routes-preview',
    schemaVersion: '1.0.0',
    packageId,
    version,
    routes,
    generatedAt: new Date().toISOString(),
  };
}

export function writeExtensionUiRoutesPreview(
  packageId: string,
  preview: ExtensionUiRoutesPreview,
): string {
  const previewPath = deploymentPreviewPath(packageId);
  atomicWriteText(previewPath, `${JSON.stringify(preview, null, 2)}\n`);
  return previewPath;
}

export function readPackageRegistryProposalPreview(packageId: string): PluginRegistryProposalPreview | null {
  const previewPath = deploymentPreviewPath(packageId);
  if (!fs.existsSync(previewPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(previewPath, 'utf8')) as PluginRegistryProposalPreview;
    if (isExtensionUiRoutesPreview(parsed) || isVerticalAppDeploymentPreview(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function designerPageKeysImpliedByUiRoute(route: ExtensionUiRouteCapability): string[] {
  const keys = new Set<string>();
  const pageKey = route.pageKey.trim();
  if (pageKey) keys.add(pageKey);

  const pattern = route.suggestedRoutePattern?.trim().replace(/^\/+/, '') ?? '';
  if (pattern) {
    keys.add(pattern);
    const collapsed = resolveExperienceManifestPageKey(pattern);
    if (collapsed) keys.add(collapsed);
  }

  const entryPath = route.entry.trim()
    .replace(/^\/+/, '')
    .replace(/^ui\//, '')
    .replace(/\.(tsx|ts|jsx|js)$/i, '');
  if (entryPath) {
    keys.add(entryPath);
    const collapsed = resolveExperienceManifestPageKey(entryPath);
    if (collapsed) keys.add(collapsed);
  }

  return [...keys];
}

async function isCoreDesignerUiRoute(
  packageId: string,
  route: ExtensionUiRouteCapability,
): Promise<boolean> {
  for (const pageKey of designerPageKeysImpliedByUiRoute(route)) {
    const pageOwner = await findEffectivePageModuleOwner(pageKey, packageId);
    if (pageOwner === CORE_PLATFORM_OWNER) {
      return true;
    }
  }

  const previewRoute = buildExtensionUiRoutePreviewRoute(packageId, route);
  const routeOwner = await findEffectiveRouteBindingOwner(
    previewRoute.mountId,
    normalizeRoutePattern(previewRoute.routePattern),
    packageId,
  );
  return routeOwner === CORE_PLATFORM_OWNER;
}

async function listApplicableExtensionUiRoutes(
  packageId: string,
  manifest: PackageManifest,
): Promise<ExtensionUiRouteCapability[]> {
  const applicable: ExtensionUiRouteCapability[] = [];
  for (const route of manifest.capabilities.ui_routes ?? []) {
    if (await isCoreDesignerUiRoute(packageId, route)) {
      continue;
    }
    applicable.push(route);
  }
  return applicable;
}

function manifestWithUiRoutes(
  manifest: PackageManifest,
  routes: ExtensionUiRouteCapability[],
): PackageManifest {
  return {
    ...manifest,
    capabilities: {
      ...manifest.capabilities,
      ui_routes: routes,
    },
  };
}

export async function collectExtensionUiRoutesConflicts(
  packageId: string,
  manifest: PackageManifest,
): Promise<DeploymentConflict[]> {
  const conflicts: DeploymentConflict[] = [];
  const routes = manifest.capabilities.ui_routes ?? [];

  for (const route of routes) {
    if (await isCoreDesignerUiRoute(packageId, route)) {
      continue;
    }

    const previewRoute = buildExtensionUiRoutePreviewRoute(packageId, route);
    const mount = await findPlatformMountById(previewRoute.mountId);
    if (!mount) {
      conflicts.push({
        field: `capabilities.ui_routes.${route.pageKey}.suggestedMountId`,
        message: `Mount "${previewRoute.mountId}" does not exist.`,
      });
      continue;
    }

    const pageOwner = await findEffectivePageModuleOwner(route.pageKey, packageId);
    if (pageOwner) {
      conflicts.push({
        field: `capabilities.ui_routes.${route.pageKey}`,
        message: `Page module "${route.pageKey}" is already owned by "${pageOwner}".`,
      });
    }

    const routePattern = normalizeRoutePattern(previewRoute.routePattern);
    const routeOwner = await findEffectiveRouteBindingOwner(
      previewRoute.mountId,
      routePattern,
      packageId,
    );
    if (routeOwner) {
      conflicts.push({
        field: `capabilities.ui_routes.${route.pageKey}.suggestedRoutePattern`,
        message: `Route "${routePattern}" on mount "${previewRoute.mountId}" is owned by "${routeOwner}".`,
      });
    }
  }

  return conflicts;
}

function writeExtensionUiRoutesDeploymentApplied(
  packageId: string,
  version: string,
  routes: ExtensionUiRoutesPreview['routes'],
): void {
  const applied: ExtensionUiRoutesDeploymentApplied = {
    schema: 'package-deployment-applied',
    schemaVersion: '1.0.0',
    packageId,
    version,
    appliedAt: new Date().toISOString(),
    kind: 'extension-ui-routes',
    routes,
  };
  writeDeploymentApplied(applied);
}

export async function applyExtensionUiRoutes(
  packageId: string,
  version: string,
  manifest: PackageManifest,
  _actorId: number | null,
): Promise<ExtensionUiRoutesApplyResult> {
  const routes = await listApplicableExtensionUiRoutes(packageId, manifest);
  if (routes.length === 0) {
    removeDeploymentPreview(packageId);
    return { ok: true, status: 'applied' };
  }

  const applicableManifest = manifestWithUiRoutes(manifest, routes);
  const conflicts = await collectExtensionUiRoutesConflicts(packageId, applicableManifest);
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Extension UI route proposal blocked due to platform registry conflicts.',
      details: conflicts.map((item) => item.message),
      conflicts,
    };
  }

  const preview = buildExtensionUiRoutesPreview(packageId, version, applicableManifest);
  writeExtensionUiRoutesPreview(packageId, preview);
  return { ok: true, status: 'pending' };
}

export async function confirmExtensionUiRoutes(
  packageId: string,
  version: string,
  manifest: PackageManifest,
  _actorId: number | null,
): Promise<ExtensionUiRoutesApplyResult> {
  const preview = readPackageRegistryProposalPreview(packageId);
  if (!preview || !isExtensionUiRoutesPreview(preview)) {
    return {
      ok: false,
      error: `UI routes preview for package "${packageId}" was not found.`,
    };
  }

  const applicable = await listApplicableExtensionUiRoutes(packageId, manifest);
  const applicableKeys = new Set(applicable.map((route) => route.pageKey));
  const routes = preview.routes.filter((route) => applicableKeys.has(route.pageKey));
  if (routes.length === 0) {
    removeDeploymentPreview(packageId);
    return { ok: true, status: 'applied' };
  }

  const conflicts = await collectExtensionUiRoutesConflicts(
    packageId,
    manifestWithUiRoutes(manifest, applicable),
  );
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Extension UI route apply blocked due to platform registry conflicts.',
      details: conflicts.map((item) => item.message),
      conflicts,
    };
  }

  writeExtensionUiRoutesDeploymentApplied(packageId, version, routes);
  removeDeploymentPreview(packageId);
  invalidatePlatformRuntimeConfig();
  return { ok: true, status: 'applied' };
}

export function hasExtensionUiRoutes(manifest: PackageManifest): boolean {
  return (manifest.capabilities.ui_routes?.length ?? 0) > 0;
}

export function listExtensionUiRouteCapabilities(
  manifest: PackageManifest,
): ExtensionUiRouteCapability[] {
  return manifest.capabilities.ui_routes ?? [];
}
