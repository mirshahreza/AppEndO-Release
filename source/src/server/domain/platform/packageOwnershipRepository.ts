import {
  deleteRowsByOwnerPluginId,
  listMountFiles,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
} from '../../../core/platform-registry/PlatformRegistryFileStore';

export async function findPlatformMountIdByPathPrefix(pathPrefix: string): Promise<string | null> {
  const mount = listMountFiles().find((item) => item.pathPrefix === pathPrefix);
  return mount?.id ?? null;
}

export async function deletePlatformRowsByOwnerPluginId(packageId: string): Promise<void> {
  withPlatformRegistryLock(() => {
    deleteRowsByOwnerPluginId(packageId);
    touchPlatformRegistryIndex();
  });
}

export async function listPlatformMountPathPrefixes(): Promise<string[]> {
  return listMountFiles()
    .map((mount) => mount.pathPrefix)
    .sort((left, right) => left.localeCompare(right));
}
