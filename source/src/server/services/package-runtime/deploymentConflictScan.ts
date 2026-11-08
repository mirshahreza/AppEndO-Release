import { listDeploymentAppliedRecords } from '../../../core/packages/PackageFileStore';
import {
  listRouteBindingFiles,
  readMountFile,
  readPageModuleFile,
  readShellFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  findPlatformMountIdByPathPrefix,
  listPlatformMountPathPrefixes,
} from '../../domain/platform/packageOwnershipRepository';
import {
  deploymentAppliedToPlatformRows,
  loadAllDeploymentPlatformRows,
} from '../platform/packageDeploymentToPlatformRows';
import type { PackageDeploymentApplied } from '../../../shared/api/contracts/package-manifest/deploymentApplied';
import {
  isExtensionUiRoutesDeploymentApplied,
  isVerticalAppDeploymentApplied,
} from '../../../shared/api/contracts/package-manifest/deploymentApplied';

export const CORE_PLATFORM_OWNER = '__core__';

function normalizeRoutePattern(value: string): string {
  return String(value || '').trim().replace(/^\/+/, '');
}

function listOtherDeployments(excludePluginId?: string): PackageDeploymentApplied[] {
  return listDeploymentAppliedRecords().filter((item) => item.packageId !== excludePluginId);
}

function findDeploymentShellOwner(shellKey: string, excludePluginId?: string): string | null {
  for (const applied of listOtherDeployments(excludePluginId)) {
    if (!isVerticalAppDeploymentApplied(applied)) continue;
    if (applied.capabilities.shell.key === shellKey) {
      return applied.packageId;
    }
  }
  return null;
}

function findDeploymentPageOwner(pageKey: string, excludePluginId?: string): string | null {
  for (const applied of listOtherDeployments(excludePluginId)) {
    const rows = deploymentAppliedToPlatformRows(applied);
    if (rows.pageModules.some((item) => item.pageKey === pageKey)) {
      return applied.packageId;
    }
  }
  return null;
}

function findDeploymentMountOwnerByPathPrefix(
  pathPrefix: string,
  excludePluginId?: string,
): { owner: string; mountId: string } | null {
  for (const applied of listOtherDeployments(excludePluginId)) {
    if (!isVerticalAppDeploymentApplied(applied)) continue;
    if (!applied.includeMount) continue;
    if (applied.deployment.mount.pathPrefix === pathPrefix) {
      return { owner: applied.packageId, mountId: applied.deployment.mount.id };
    }
  }
  return null;
}

function findDeploymentMountOwnerById(
  mountId: string,
  excludePluginId?: string,
): string | null {
  for (const applied of listOtherDeployments(excludePluginId)) {
    if (!isVerticalAppDeploymentApplied(applied)) continue;
    if (applied.includeMount && applied.deployment.mount.id === mountId) {
      return applied.packageId;
    }
  }
  return null;
}

function findDeploymentRouteOwner(
  mountId: string,
  routePattern: string,
  excludePluginId?: string,
): string | null {
  const normalized = normalizeRoutePattern(routePattern);
  for (const applied of listOtherDeployments(excludePluginId)) {
    const rows = deploymentAppliedToPlatformRows(applied);
    const match = rows.bindings.find(
      (item) => item.mountId === mountId && item.routePattern === normalized,
    );
    if (match?.ownerPackageId) {
      return match.ownerPackageId;
    }
  }
  return null;
}

async function findCoreShellOwner(shellKey: string): Promise<string | null> {
  const shell = readShellFile(shellKey);
  if (!shell) return null;
  return shell.ownerPackageId ?? CORE_PLATFORM_OWNER;
}

async function findCorePageOwner(pageKey: string): Promise<string | null> {
  const pageModule = readPageModuleFile(pageKey);
  if (!pageModule) return null;
  return pageModule.ownerPackageId ?? CORE_PLATFORM_OWNER;
}

async function findCoreMountIdByPathPrefix(pathPrefix: string): Promise<string | null> {
  return findPlatformMountIdByPathPrefix(pathPrefix);
}

async function findCoreMountOwnerById(mountId: string): Promise<string | null> {
  const mount = readMountFile(mountId);
  if (!mount) return null;
  return mount.ownerPackageId ?? CORE_PLATFORM_OWNER;
}

async function findCoreRouteOwner(
  mountId: string,
  routePattern: string,
): Promise<string | null> {
  const normalized = normalizeRoutePattern(routePattern);
  const binding = listRouteBindingFiles()
    .filter((item) => item.mountId === mountId && item.routePattern === normalized)
    .at(-1);
  if (!binding) return null;
  return binding.ownerPackageId ?? CORE_PLATFORM_OWNER;
}

async function listCoreMountPathPrefixes(): Promise<string[]> {
  const prefixes = new Set<string>(await listPlatformMountPathPrefixes());
  for (const mount of loadAllDeploymentPlatformRows().mounts) {
    prefixes.add(mount.pathPrefix);
  }
  return [...prefixes].sort();
}

export async function findEffectiveShellOwner(
  shellKey: string,
  excludePluginId?: string,
): Promise<string | null> {
  const deploymentOwner = findDeploymentShellOwner(shellKey, excludePluginId);
  if (deploymentOwner) return deploymentOwner;
  const coreOwner = await findCoreShellOwner(shellKey);
  if (coreOwner && coreOwner !== excludePluginId) return coreOwner;
  return null;
}

export async function findEffectivePageModuleOwner(
  pageKey: string,
  excludePluginId?: string,
): Promise<string | null> {
  const deploymentOwner = findDeploymentPageOwner(pageKey, excludePluginId);
  if (deploymentOwner) return deploymentOwner;
  const coreOwner = await findCorePageOwner(pageKey);
  if (coreOwner && coreOwner !== excludePluginId) return coreOwner;
  return null;
}

export async function findEffectiveMountIdByPathPrefix(
  pathPrefix: string,
  excludePluginId?: string,
): Promise<string | null> {
  const deploymentMatch = findDeploymentMountOwnerByPathPrefix(pathPrefix, excludePluginId);
  if (deploymentMatch) return deploymentMatch.mountId;
  return findCoreMountIdByPathPrefix(pathPrefix);
}

export async function findEffectiveMountOwnerById(
  mountId: string,
  excludePluginId?: string,
): Promise<string | null> {
  const deploymentOwner = findDeploymentMountOwnerById(mountId, excludePluginId);
  if (deploymentOwner) return deploymentOwner;
  const coreOwner = await findCoreMountOwnerById(mountId);
  if (coreOwner && coreOwner !== excludePluginId) return coreOwner;
  return null;
}

export async function findEffectiveRouteBindingOwner(
  mountId: string,
  routePattern: string,
  excludePluginId?: string,
): Promise<string | null> {
  const deploymentOwner = findDeploymentRouteOwner(mountId, routePattern, excludePluginId);
  if (deploymentOwner) return deploymentOwner;
  const coreOwner = await findCoreRouteOwner(mountId, routePattern);
  if (coreOwner && coreOwner !== excludePluginId) return coreOwner;
  return null;
}

export async function listEffectiveMountPathPrefixes(): Promise<string[]> {
  return listCoreMountPathPrefixes();
}

export async function mountExistsInCoreOrDeployments(
  mountId: string,
  excludePluginId?: string,
): Promise<boolean> {
  const deploymentOwner = findDeploymentMountOwnerById(mountId, excludePluginId);
  if (deploymentOwner) return true;
  const coreOwner = await findCoreMountOwnerById(mountId);
  return coreOwner !== null;
}

export function listExtensionUiRoutesFromDeployments(
  excludePluginId?: string,
): Array<{ packageId: string; mountId: string; routePattern: string; pageKey: string }> {
  const hits: Array<{ packageId: string; mountId: string; routePattern: string; pageKey: string }> = [];
  for (const applied of listOtherDeployments(excludePluginId)) {
    if (!isExtensionUiRoutesDeploymentApplied(applied)) continue;
    for (const route of applied.routes) {
      hits.push({
        packageId: applied.packageId,
        mountId: route.mountId,
        routePattern: normalizeRoutePattern(route.routePattern),
        pageKey: route.pageKey,
      });
    }
  }
  return hits;
}
