import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';
import {
  normalizePlatformCultureTranslationsConfig,
  type PlatformCultureTranslationsConfig,
} from '../../core/culture/CultureTranslationOverrides';
import {
  collectInstalledPackageCultureKeys,
  overlayPackageCultureKeysOnBundles,
  stripPackageCultureOverrides,
} from '../services/package/packageCultureKeysSidecar';
import {
  buildSeedCultureTranslationBundles,
  mergeCultureTranslationBundles,
} from '../services/platform/platformCultureTranslationsSeed';

const PLATFORM_CULTURE_TRANSLATIONS_SETTINGS_KEY = 'platformCultureTranslations';

export const getPlatformCultureTranslationsConfigFromFile = (
  settingsPath: string,
): PlatformCultureTranslationsConfig => {
  const settings = readSettingsObject(settingsPath);
  return normalizePlatformCultureTranslationsConfig(settings[PLATFORM_CULTURE_TRANSLATIONS_SETTINGS_KEY]);
};

export const savePlatformCultureTranslationsConfigToFile = (
  settingsPath: string,
  config: PlatformCultureTranslationsConfig,
): PlatformCultureTranslationsConfig => {
  const normalized = normalizePlatformCultureTranslationsConfig(config);
  const settings = readSettingsObject(settingsPath);
  settings[PLATFORM_CULTURE_TRANSLATIONS_SETTINGS_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

export const getPlatformCultureTranslationsConfig = (
  settingsPath: string,
): PlatformCultureTranslationsConfig => readPlatformBlob(
  settingsPath,
  'platformCultureTranslations',
  getPlatformCultureTranslationsConfigFromFile,
  (raw) => normalizePlatformCultureTranslationsConfig(raw),
);

export const savePlatformCultureTranslationsConfig = (
  settingsPath: string,
  config: PlatformCultureTranslationsConfig,
): PlatformCultureTranslationsConfig => {
  const normalized = normalizePlatformCultureTranslationsConfig(config);
  return writePlatformBlob(
    settingsPath,
    'platformCultureTranslations',
    normalized as unknown as Record<string, unknown>,
    savePlatformCultureTranslationsConfigToFile,
  ) as unknown as PlatformCultureTranslationsConfig;
};

export const ensurePlatformCultureTranslationsSettings = (
  settingsPath: string,
): PlatformCultureTranslationsConfig => {
  const current = getPlatformCultureTranslationsConfig(settingsPath);
  const seedBundles = buildSeedCultureTranslationBundles();
  const packageKeys = collectInstalledPackageCultureKeys();
  const mergedBundles = overlayPackageCultureKeysOnBundles(
    mergeCultureTranslationBundles(current.bundles, seedBundles),
    packageKeys,
  );
  const cultureOverrides = stripPackageCultureOverrides(current.cultureOverrides, packageKeys);
  const bundlesChanged = JSON.stringify(mergedBundles) !== JSON.stringify(current.bundles);
  const overridesChanged = JSON.stringify(cultureOverrides) !== JSON.stringify(current.cultureOverrides);
  const needsRevision = current.revision <= 0;

  if (!bundlesChanged && !overridesChanged && !needsRevision) {
    return current;
  }

  return savePlatformCultureTranslationsConfig(settingsPath, {
    ...current,
    revision: bundlesChanged || overridesChanged ? current.revision + 1 : 1,
    bundles: mergedBundles,
    cultureOverrides,
  });
};
