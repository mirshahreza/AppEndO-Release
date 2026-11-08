import type {
  PluginDeploymentStatus,
  VerticalAppDeploymentPreview,
  VerticalAppManifest,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { VerticalAppDeploymentApplied } from '../../../shared/api/contracts/package-manifest/deploymentApplied';
import {
  packageDirs,
  atomicWriteText,
  writeDeploymentApplied,
  removeDeploymentApplied,
} from '../../../core/packages/PackageFileStore';
import fs from 'fs';
import path from 'path';
import { findPlatformMountById } from '../../domain/platform/mountRepository';
import { invalidatePlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';
import { seedDesignerShellsFromManifest } from '../platform/designerShellInstall.service';
import { seedPackageWorkspaceAssetsFromZip, seedPackagePlatformFontsFromZip } from '../package/packageWorkspaceAssetInstall.service';
import {
  findEffectiveMountIdByPathPrefix,
  findEffectiveMountOwnerById,
  findEffectiveRouteBindingOwner,
  findEffectiveShellOwner,
  listEffectiveMountPathPrefixes,
  mountExistsInCoreOrDeployments,
} from './deploymentConflictScan';

export type DeploymentConflict = {
  field: string;
  message: string;
};

export type DeploymentApplyResult =
  | { ok: true; status: Extract<PluginDeploymentStatus, 'applied'> }
  | { ok: true; status: Extract<PluginDeploymentStatus, 'pending'>; previewPath: string }
  | { ok: false; error: string; details?: string[]; conflicts?: DeploymentConflict[] };

function deploymentPreviewPath(packageId: string): string {
  return path.join(packageDirs.installed, `${packageId}.deployment-preview.json`);
}

function normalizeRoutePattern(value: string): string {
  return String(value || '').trim().replace(/^\/+/, '');
}

export function canAutoApplyDeployment(applyPolicy: 'propose' | 'auto'): boolean {
  if (applyPolicy === 'propose') return false;
  return process.env.NODE_ENV !== 'production' || process.env.PACKAGE_AUTO_DEPLOY === 'true';
}

export function buildDeploymentPreview(
  packageId: string,
  version: string,
  manifest: VerticalAppManifest,
): VerticalAppDeploymentPreview {
  return {
    schema: 'package-deployment-preview',
    schemaVersion: '1.0.0',
    packageId,
    version,
    applyPolicy: manifest.deployment.applyPolicy,
    deployment: manifest.deployment,
    generatedAt: new Date().toISOString(),
  };
}

export function writeDeploymentPreview(
  packageId: string,
  preview: VerticalAppDeploymentPreview,
): string {
  const previewPath = deploymentPreviewPath(packageId);
  atomicWriteText(previewPath, `${JSON.stringify(preview, null, 2)}\n`);
  return previewPath;
}

export function readDeploymentPreview(packageId: string): VerticalAppDeploymentPreview | null {
  const previewPath = deploymentPreviewPath(packageId);
  if (!fs.existsSync(previewPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(previewPath, 'utf8')) as VerticalAppDeploymentPreview;
  } catch {
    return null;
  }
}

export function removeDeploymentPreview(packageId: string): void {
  const previewPath = deploymentPreviewPath(packageId);
  if (fs.existsSync(previewPath)) {
    fs.rmSync(previewPath, { force: true });
  }
}

export async function collectDeploymentConflicts(
  packageId: string,
  manifest: VerticalAppManifest,
): Promise<DeploymentConflict[]> {
  const conflicts: DeploymentConflict[] = [];
  const { deployment, capabilities } = manifest;

  const shellOwner = await findEffectiveShellOwner(capabilities.shell.key, packageId);
  if (shellOwner) {
    conflicts.push({
      field: 'capabilities.shell.key',
      message: `Shell key "${capabilities.shell.key}" is already owned by "${shellOwner}".`,
    });
  }

  const existingMountId = await findEffectiveMountIdByPathPrefix(deployment.mount.pathPrefix, packageId);
  if (existingMountId && existingMountId !== deployment.mount.id) {
    conflicts.push({
      field: 'deployment.mount.pathPrefix',
      message: `Mount pathPrefix "${deployment.mount.pathPrefix}" is already used by mount "${existingMountId}".`,
    });
  }

  const mountOwner = await findEffectiveMountOwnerById(deployment.mount.id, packageId);
  if (mountOwner) {
    conflicts.push({
      field: 'deployment.mount.id',
      message: `Mount id "${deployment.mount.id}" is already owned by "${mountOwner}".`,
    });
  }

  for (const route of deployment.routes) {
    const routePattern = normalizeRoutePattern(route.routePattern);
    const routeOwner = await findEffectiveRouteBindingOwner(
      deployment.mount.id,
      routePattern,
      packageId,
    );
    if (routeOwner) {
      conflicts.push({
        field: `deployment.routes.${routePattern}`,
        message: `Route "${routePattern}" on mount "${deployment.mount.id}" is owned by "${routeOwner}".`,
      });
    }
  }

  const pathPrefixes = await listEffectiveMountPathPrefixes();
  if (pathPrefixes.includes(deployment.mount.pathPrefix)) {
    const existingId = await findEffectiveMountIdByPathPrefix(deployment.mount.pathPrefix, packageId);
    if (existingId !== deployment.mount.id) {
      conflicts.push({
        field: 'deployment.mount.pathPrefix',
        message: `pathPrefix "${deployment.mount.pathPrefix}" must be unique.`,
      });
    }
  }

  return conflicts;
}

async function writeVerticalAppDeploymentApplied(
  packageId: string,
  version: string,
  manifest: VerticalAppManifest,
): Promise<void> {
  const existingMount = await findPlatformMountById(manifest.deployment.mount.id);
  const includeMount = !existingMount;

  const applied: VerticalAppDeploymentApplied = {
    schema: 'package-deployment-applied',
    schemaVersion: '1.0.0',
    packageId,
    version,
    appliedAt: new Date().toISOString(),
    kind: 'vertical-app',
    deployment: manifest.deployment,
    capabilities: {
      shell: manifest.capabilities.shell,
      pages: manifest.capabilities.pages,
      designer_layouts: manifest.capabilities.designer_layouts,
    },
    includeMount,
  };

  writeDeploymentApplied(applied);
}

export async function applyPluginDeployment(
  packageId: string,
  version: string,
  manifest: VerticalAppManifest,
  _actorId: number | null,
): Promise<DeploymentApplyResult> {
  const conflicts = await collectDeploymentConflicts(packageId, manifest);
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Deployment blocked due to platform registry conflicts.',
      details: conflicts.map((item) => item.message),
      conflicts,
    };
  }

  if (!canAutoApplyDeployment(manifest.deployment.applyPolicy)) {
    const preview = buildDeploymentPreview(packageId, version, manifest);
    const previewPath = writeDeploymentPreview(packageId, preview);
    return { ok: true, status: 'pending', previewPath };
  }

  await writeVerticalAppDeploymentApplied(packageId, version, manifest);
  seedDesignerShellsFromManifest(packageId, version, manifest);
  seedPackageWorkspaceAssetsFromZip(packageId, version);
  seedPackagePlatformFontsFromZip(packageId, version);
  removeDeploymentPreview(packageId);
  invalidatePlatformRuntimeConfig();
  return { ok: true, status: 'applied' };
}

export async function confirmPluginDeployment(
  packageId: string,
  version: string,
  manifest: VerticalAppManifest,
  _actorId: number | null,
): Promise<DeploymentApplyResult> {
  const conflicts = await collectDeploymentConflicts(packageId, manifest);
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Deployment blocked due to platform registry conflicts.',
      details: conflicts.map((item) => item.message),
      conflicts,
    };
  }

  await writeVerticalAppDeploymentApplied(packageId, version, manifest);
  seedDesignerShellsFromManifest(packageId, version, manifest);
  seedPackageWorkspaceAssetsFromZip(packageId, version);
  seedPackagePlatformFontsFromZip(packageId, version);
  removeDeploymentPreview(packageId);
  invalidatePlatformRuntimeConfig();
  return { ok: true, status: 'applied' };
}

export async function rollbackPluginDeployment(packageId: string): Promise<void> {
  removeDeploymentApplied(packageId);
  removeDeploymentPreview(packageId);
  invalidatePlatformRuntimeConfig();
}

export async function isVerticalAppMountResolvable(
  mountId: string,
  excludePluginId?: string,
): Promise<boolean> {
  return mountExistsInCoreOrDeployments(mountId, excludePluginId);
}
