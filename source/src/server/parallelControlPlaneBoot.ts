import { ensureControlPlaneFeatureTables } from './db/ensureControlPlaneFeatureTables';
import { ensureControlPlaneInitialized } from './db/controlPlaneInit';
import { readControlPlaneDatabaseSettings } from './db/controlPlaneDatabase';
import {
  ensureExtxDbObjects,
  resetExtxDbObjectsInstallState,
} from '../oss/excludedModuleStub';
import { ensureDevSimpleAuthSettings } from './setup/greenfieldInstall';
import {
  initComponentUsagePersistence,
} from './services/component-usage/componentUsagePersistence.service';
import { bootstrapPlatformSettingsCaches } from './services/settings/bootstrapPlatformSettings';

/**
 * Control-plane reference data + Sequelize feature tables + platform settings caches.
 * Feature DDL and platform cache bootstrap are independent after reference init — run in parallel.
 */
export async function ensureControlPlaneBootDataAndCaches(settingsPath: string): Promise<void> {
  console.log('[AppEndO] Ensuring control-plane reference data…');
  await ensureControlPlaneInitialized(settingsPath, { pushSchema: false });
  console.log('[AppEndO] Loading platform and application settings caches…');
  await Promise.all([
    ensureControlPlaneFeatureTables(settingsPath),
    bootstrapPlatformSettingsCaches(settingsPath),
  ]);

  const { provider } = readControlPlaneDatabaseSettings(settingsPath);
  if (provider === 'sqlserver') {
    console.log('[AppEndO] Ensuring Portalx DB procedures (extx_* )…');
    resetExtxDbObjectsInstallState();
    try {
      await ensureExtxDbObjects();
      console.log('[AppEndO] Portalx DB procedures ready.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[AppEndO] Portalx DB procedure install failed — fix SQL or run: npm run extx:db-objects\n  ${message}`,
      );
    }
  }

  initComponentUsagePersistence();
  await ensureDevSimpleAuthSettings(null);
  console.log('[AppEndO] Platform settings caches ready.');
}
