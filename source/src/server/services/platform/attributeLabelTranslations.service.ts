import { SETTINGS_PATH } from '../../config/settingsFile';
import {
  bootstrapCultureTranslationRuntime,
  toCultureTranslationsBootMeta,
  type PlatformCultureTranslationsConfig,
} from '../../../core/culture/CultureTranslationOverrides';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../../shared/api/contracts/platform/cultureTranslations';
import {
  attributeLabelTranslationKey,
} from '../../../shared/lib/attributeLabelTranslations';
import {
  ensurePlatformCultureTranslationsSettings,
  savePlatformCultureTranslationsConfig,
} from '../../db/platformCultureTranslationsStore';
import { bootstrapServerCultureTranslationsCache } from './platformCultureTranslationsRuntimeCache';

const applyRuntime = (config: PlatformCultureTranslationsConfig): PlatformCultureTranslationsConfig => {
  bootstrapServerCultureTranslationsCache(config);
  bootstrapCultureTranslationRuntime(toCultureTranslationsBootMeta(config));
  return config;
};

const removeKeyFromConfig = (
  config: PlatformCultureTranslationsConfig,
  translationKey: string,
): PlatformCultureTranslationsConfig => {
  const bundles: PlatformCultureTranslationsConfig['bundles'] = {};
  for (const [bundleId, bundle] of Object.entries(config.bundles)) {
    if (!(translationKey in bundle)) {
      bundles[bundleId] = bundle;
      continue;
    }
    const next = { ...bundle };
    delete next[translationKey];
    bundles[bundleId] = next;
  }

  const cultureOverrides: PlatformCultureTranslationsConfig['cultureOverrides'] = {};
  for (const [cultureId, overrides] of Object.entries(config.cultureOverrides)) {
    if (!(translationKey in overrides)) {
      cultureOverrides[cultureId] = overrides;
      continue;
    }
    const next = { ...overrides };
    delete next[translationKey];
    cultureOverrides[cultureId] = next;
  }

  return {
    ...config,
    revision: config.revision + 1,
    bundles,
    cultureOverrides,
  };
};

/** Seed/update the English (master) translation for an attribute label. */
export function upsertAttributeLabelTranslation(
  attributeKey: string,
  englishLabel: string,
  settingsPath: string = SETTINGS_PATH,
): void {
  const translationKey = attributeLabelTranslationKey(attributeKey);
  const normalizedKey = attributeKey.trim().toLowerCase();
  if (!normalizedKey) {
    return;
  }
  const value = englishLabel.trim() || normalizedKey;

  const config = ensurePlatformCultureTranslationsSettings(settingsPath);
  const master = { ...(config.bundles[MASTER_TRANSLATION_BUNDLE_ID] ?? {}) };
  if (master[translationKey] === value) {
    return;
  }

  master[translationKey] = value;
  const saved = savePlatformCultureTranslationsConfig(settingsPath, {
    ...config,
    revision: config.revision + 1,
    bundles: {
      ...config.bundles,
      [MASTER_TRANSLATION_BUNDLE_ID]: master,
    },
  });
  applyRuntime(saved);
}

/** Remove an attribute label key from all bundles and culture overrides. */
export function removeAttributeLabelTranslation(
  attributeKey: string,
  settingsPath: string = SETTINGS_PATH,
): void {
  const translationKey = attributeLabelTranslationKey(attributeKey);
  const config = ensurePlatformCultureTranslationsSettings(settingsPath);
  const next = removeKeyFromConfig(config, translationKey);
  if (next.revision === config.revision) {
    return;
  }
  applyRuntime(savePlatformCultureTranslationsConfig(settingsPath, next));
}

/**
 * When an attribute key is renamed, move the master translation to the new key
 * and drop the old key from bundles/overrides.
 */
export function renameAttributeLabelTranslation(
  previousAttributeKey: string,
  nextAttributeKey: string,
  englishLabel: string,
  settingsPath: string = SETTINGS_PATH,
): void {
  const previous = previousAttributeKey.trim().toLowerCase();
  const next = nextAttributeKey.trim().toLowerCase();
  if (previous && previous !== next) {
    removeAttributeLabelTranslation(previous, settingsPath);
  }
  upsertAttributeLabelTranslation(next, englishLabel, settingsPath);
}
