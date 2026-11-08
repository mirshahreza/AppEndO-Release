import {
  cleanupFunctionStoreTmpFiles,
} from '../core/functions/FunctionFileStore';
import {
  cleanupPackageTmpFiles,
  enforcePackageEventRetention,
} from '../core/packages/PackageFileStore';
import {
  cleanupPlatformRegistryTmpFiles,
  ensurePlatformRegistryDirs,
} from '../core/platform-registry/PlatformRegistryFileStore';
import { ensurePlatformRegistrySeed } from '../core/platform-registry/ensurePlatformRegistrySeed';
import {
  ensureCoreStudioDevelopmentRegistryArtifacts,
  restoreCorePlatformRegistryArtifacts,
  syncMissingPlatformRegistryDefaults,
} from '../core/platform-registry/platformRegistryDefaults';
import { logger } from '../core/logging/Logger';
import { refreshEdgeDataSourcesCatalog } from './db/dataSourcesStore';
import { seedSampleMockRecordEvents } from './domain/record-events/sampleMockHistory';
import { invalidatePlatformRuntimeConfig } from './services/platform/platformRuntimeConfig.service';

/**
 * Work not required for `/api/boot` or listen — run immediately after the server accepts traffic.
 * Failures are logged; they do not block READY.
 */
export async function runDeferredServerRuntimeWarmup(settingsPath: string): Promise<void> {
  const startedAt = Date.now();
  console.log('[AppEndO] Deferred runtime warmup starting (post-listen)…');

  const { initIdentityProviderRuntime } = await import('./services/auth/identityProviderSettings.service');
  await Promise.all([
    refreshEdgeDataSourcesCatalog(),
    initIdentityProviderRuntime(settingsPath),
  ]);

  cleanupFunctionStoreTmpFiles();
  cleanupPlatformRegistryTmpFiles();
  cleanupPackageTmpFiles();
  enforcePackageEventRetention();

  ensurePlatformRegistryDirs();
  ensurePlatformRegistrySeed();
  syncMissingPlatformRegistryDefaults();
  restoreCorePlatformRegistryArtifacts();
  ensureCoreStudioDevelopmentRegistryArtifacts();
  const { ensureHawietyPortalShellBrand } = await import('./domain/hwy/ensureHawietyPortalShellBrand');
  await ensureHawietyPortalShellBrand();
  const { isHawietyRuntimeEnabled } = await import('./services/hawiety/hawietyRuntime');
  if (isHawietyRuntimeEnabled()) {
    const { HAWIETY_PACKAGE_ID } = await import('../core/packages/hawietyPackage');
    const { repairInstalledVerticalAppUiRoutes } = await import(
      './services/package-runtime/repairVerticalAppUiRoutes.service'
    );
    const routeCount = repairInstalledVerticalAppUiRoutes(HAWIETY_PACKAGE_ID);
    if (routeCount > 0) {
      console.log(`[hawiety] Package UI routes ready (${routeCount}).`);
    }
  }
  invalidatePlatformRuntimeConfig();

  await seedSampleMockRecordEvents();

  console.log(`[AppEndO] Deferred runtime warmup finished (+${Date.now() - startedAt}ms).`);
}

export const runDeferredServerRuntimeWarmupSafe = (settingsPath: string): void => {
  void runDeferredServerRuntimeWarmup(settingsPath).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Server', `Deferred runtime warmup failed: ${message}`);
  });
};
