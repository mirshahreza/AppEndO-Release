import { aiManager } from '../core/ai/AiManager';
import { cacheManager } from '../core/cache/CacheManager';
import { ensureAiSettings } from './db/aiSettingsStore';
import { ensureCacheSettings } from './db/cacheSettingsStore';
import { ensureDataSourcesSettings } from './db/dataSourcesStore';
import { ensureGitSettings } from './db/gitSettingsStore';
import { ensurePackagesSettings } from './db/packagesSettings';
import { ensurePlatformCulturesSettings } from './db/platformCultureSettingsStore';
import { ensureSchedulerSettings } from './db/schedulerSettingsStore';
import {
  hydrateAiSettingsSecrets,
  hydrateCacheSecrets,
} from './domain/security/credentialVault/platformSettingsSecrets';
import { bootstrapPlatformCulturesFromSettings } from './services/platform/platformCultureSettings.service';
import { applyPlatformWebFontsRuntime } from './services/platform/platformWebFontsRuntime';

export type ApplicationSettingsRuntimeSlice = {
  aiSettings: ReturnType<typeof ensureAiSettings>;
  schedulerSettings: ReturnType<typeof ensureSchedulerSettings>;
};

/**
 * Loads application settings blobs, hydrates vault secrets in parallel, and applies culture/font runtime.
 * Call only after {@link bootstrapPlatformSettingsCaches} has finished.
 */
export async function applyApplicationSettingsRuntime(
  settingsPath: string,
): Promise<ApplicationSettingsRuntimeSlice> {
  ensureDataSourcesSettings(settingsPath);
  ensurePackagesSettings(settingsPath);
  const aiSettings = ensureAiSettings(settingsPath);
  const schedulerSettings = ensureSchedulerSettings(settingsPath);
  const cacheSettings = ensureCacheSettings(settingsPath);
  ensureGitSettings(settingsPath);
  ensurePlatformCulturesSettings(settingsPath);

  const [
    hydratedAi,
    hydratedCache,
    cultureTranslationsStore,
    feedbackSettingsStore,
    identityProvidersStore,
  ] = await Promise.all([
    hydrateAiSettingsSecrets(aiSettings),
    hydrateCacheSecrets(cacheSettings),
    import('./db/platformCultureTranslationsStore'),
    import('./db/feedbackSettingsStore'),
    import('./db/identityProvidersStore'),
  ]);

  aiManager.reloadFromSettings(hydratedAi);
  await cacheManager.loadSettings(hydratedCache);

  cultureTranslationsStore.ensurePlatformCultureTranslationsSettings(settingsPath);
  feedbackSettingsStore.ensurePlatformFeedbackConfig(settingsPath);
  identityProvidersStore.ensureAuthIdentitySettings(settingsPath);

  applyPlatformWebFontsRuntime(settingsPath);
  bootstrapPlatformCulturesFromSettings(settingsPath);

  return { aiSettings, schedulerSettings };
}
