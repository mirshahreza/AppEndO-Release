import fs from 'fs';
import path from 'path';
import {
  appendPackageEvent,
  ensurePackageStorageDirs,
  packageDirs,
  PACKAGE_STORAGE_ROOT,
} from '../src/core/packages/PackageFileStore.js';
import {
  listMountFiles,
  listPageModuleFiles,
  listRouteBindingFiles,
  listShellFiles,
  listShellRuleFiles,
} from '../src/core/platform-registry/PlatformRegistryFileStore.js';
import { deletePlatformRowsByOwnerPluginId } from '../src/server/domain/platform/packageOwnershipRepository.js';

function removeIfExists(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

async function purgeLegacyPluginOwnedPlatformRows(): Promise<string[]> {
  const packageIds = new Set<string>();
  for (const rows of [
    listMountFiles(),
    listShellFiles(),
    listPageModuleFiles(),
    listShellRuleFiles(),
    listRouteBindingFiles(),
  ]) {
    for (const row of rows) {
      if (row.ownerPackageId) {
        packageIds.add(row.ownerPackageId);
      }
    }
  }

  for (const packageId of [...packageIds].sort()) {
    await deletePlatformRowsByOwnerPluginId(packageId);
  }
  return [...packageIds].sort();
}

function resetPluginStorage(): void {
  removeIfExists(packageDirs.artifacts);
  removeIfExists(packageDirs.manifests);
  removeIfExists(packageDirs.installed);
  removeIfExists(packageDirs.deployments);
  removeIfExists(packageDirs.objects);
  removeIfExists(packageDirs.runtimes);
  removeIfExists(packageDirs.dependencies);
  removeIfExists(packageDirs.events);
  removeIfExists(packageDirs.locks);
  removeIfExists(packageDirs.tmp);
  removeIfExists(path.join(PACKAGE_STORAGE_ROOT, 'index.json'));

  ensurePackageStorageDirs();
}

async function main(): Promise<void> {
  ensurePackageStorageDirs();

  const legacyPluginIds = await purgeLegacyPluginOwnedPlatformRows();
  resetPluginStorage();

  appendPackageEvent({
    type: 'plugin.platform.purge.succeeded',
    actor: 'operator',
    payload: {
      legacyPluginIds,
      storageRoot: PACKAGE_STORAGE_ROOT,
    },
  });

  console.log('Plugin platform state purged.');
  if (legacyPluginIds.length > 0) {
    console.log(`Removed legacy DB-owned rows for: ${legacyPluginIds.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
