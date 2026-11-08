import { SETTINGS_PATH } from '../../config/settingsFile';
import { backfillBootstrapAdminAuditFields } from '../../db/controlPlaneSeed';
import { applySecuritySettingsFromPlatformCache } from '../../db/securitySettingsStore';
import { ensureBootstrapAdminUser } from '../../domain/users/userRepository';
import { initializeAppSettingsCache } from './appSettingsCache';
import {
  initializePlatformSettingsCache,
  reloadPlatformSettingsCacheFromDatabase,
} from './platformSettingsCache';
import { readPlatformBlobSeedsFromExample } from './platformSettingsSeed';

/** Bootstrap platform-wide settings into DB-backed caches (install, setup, full runtime). */
export async function bootstrapPlatformSettingsCaches(settingsPath: string = SETTINGS_PATH): Promise<void> {
  const adminActorId = await ensureBootstrapAdminUser();
  const seeds = readPlatformBlobSeedsFromExample();
  await Promise.all([
    initializePlatformSettingsCache(seeds, adminActorId),
    initializeAppSettingsCache(adminActorId),
  ]);
  applySecuritySettingsFromPlatformCache(settingsPath);
  await backfillBootstrapAdminAuditFields(adminActorId);
}

export async function reloadAllPlatformSettingsCaches(settingsPath: string = SETTINGS_PATH): Promise<void> {
  await reloadPlatformSettingsCacheFromDatabase();
  await initializeAppSettingsCache();
  applySecuritySettingsFromPlatformCache(settingsPath);
}
