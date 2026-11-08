import type {
  PlatformCultureTranslationBundleResponse,
  PlatformCultureTranslationsResponse,
  UpdatePlatformCultureTranslationsPayload,
} from '../../../shared/api/contracts/platform/cultureTranslations';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../../shared/api/contracts/platform/cultureTranslations';
import {
  bootstrapCultureTranslationRuntime,
  buildCultureTranslationsSavePayload,
  mergeTranslationBundle,
  normalizePlatformCultureTranslationsConfig,
  toCultureTranslationsBootMeta,
  type PlatformCultureTranslationsConfig,
} from '../../../core/culture/CultureTranslationOverrides';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getPlatformCulturesConfig } from '../../db/platformCultureSettingsStore';
import {
  ensurePlatformCultureTranslationsSettings,
  getPlatformCultureTranslationsConfig,
  savePlatformCultureTranslationsConfig,
} from '../../db/platformCultureTranslationsStore';
import {
  bootstrapServerCultureTranslationsCache,
  getServerCultureTranslationBundle,
  getServerCultureTranslationsRevision,
} from './platformCultureTranslationsRuntimeCache';
import { buildSeedCultureTranslationBundles } from './platformCultureTranslationsSeed';

function listCultureTranslationColumns() {
  const culturesConfig = getPlatformCulturesConfig(SETTINGS_PATH);
  return culturesConfig.packs
    .map((pack) => ({
      id: pack.id,
      label: pack.label,
      locale: pack.locale,
      translationBundleId: pack.translationBundleId,
      direction: pack.direction,
    }));
}

function listTranslationKeys(config: PlatformCultureTranslationsConfig): string[] {
  const keys = new Set<string>();
  for (const bundle of Object.values(config.bundles)) {
    for (const key of Object.keys(bundle)) {
      keys.add(key);
    }
  }
  return [...keys].sort((left, right) => left.localeCompare(right));
}

function buildTranslationsResponse(
  config: PlatformCultureTranslationsConfig,
): PlatformCultureTranslationsResponse {
  return {
    success: true,
    revision: config.revision,
    keys: listTranslationKeys(config),
    masterBundle: { ...(config.bundles[MASTER_TRANSLATION_BUNDLE_ID] ?? {}) },
    defaultBundles: Object.fromEntries(
      Object.entries(config.bundles).map(([bundleId, bundle]) => [bundleId, { ...bundle }]),
    ),
    cultureOverrides: config.cultureOverrides,
    cultures: listCultureTranslationColumns(),
  };
}

function applyRuntime(config: PlatformCultureTranslationsConfig): PlatformCultureTranslationsConfig {
  bootstrapServerCultureTranslationsCache(config);
  bootstrapCultureTranslationRuntime(toCultureTranslationsBootMeta(config));
  return config;
}

export class PlatformCultureTranslationsService {
  constructor(private readonly settingsPath: string = SETTINGS_PATH) {}

  getCultureTranslationBundle(bundleId: string): { body: PlatformCultureTranslationBundleResponse } {
    const config = ensurePlatformCultureTranslationsSettings(this.settingsPath);
    bootstrapServerCultureTranslationsCache(config);

    const normalized = bundleId.trim() || MASTER_TRANSLATION_BUNDLE_ID;
    const seedBundles = buildSeedCultureTranslationBundles();
    const bundle = getServerCultureTranslationBundle(normalized)
      ?? seedBundles[normalized]
      ?? seedBundles[MASTER_TRANSLATION_BUNDLE_ID];
    if (!bundle || Object.keys(bundle).length === 0) {
      throw new Error(`Unknown culture translation bundle "${normalized}".`);
    }

    return {
      body: {
        success: true,
        bundleId: normalized,
        revision: getServerCultureTranslationsRevision(),
        bundle,
      },
    };
  }

  getTranslations(): { body: PlatformCultureTranslationsResponse } {
    const config = ensurePlatformCultureTranslationsSettings(this.settingsPath);
    applyRuntime(config);
    return { body: buildTranslationsResponse(config) };
  }

  updateTranslations(input: UpdatePlatformCultureTranslationsPayload): { body: { success: true } } {
    const normalized = normalizePlatformCultureTranslationsConfig(input);
    const saved = savePlatformCultureTranslationsConfig(this.settingsPath, normalized);
    applyRuntime(saved);
    return { body: { success: true } };
  }
}

export function bootstrapPlatformCultureTranslationsFromSettings(
  settingsPath: string = SETTINGS_PATH,
): ReturnType<typeof toCultureTranslationsBootMeta> {
  const config = ensurePlatformCultureTranslationsSettings(settingsPath);
  applyRuntime(config);
  return toCultureTranslationsBootMeta(config);
}

export function mergeCultureTranslationDraft(
  current: PlatformCultureTranslationsConfig,
  cultureId: string,
  translationBundleId: string,
  effectiveDraft: Record<string, string>,
  cultures: Array<{ id: string; translationBundleId: string }>,
): PlatformCultureTranslationsConfig {
  const draft = { [cultureId.trim()]: effectiveDraft };
  return buildCultureTranslationsSavePayload(current, draft, cultures);
}

export function buildEffectiveTranslationsForCulture(
  cultureId: string,
  translationBundleId: string,
  config: PlatformCultureTranslationsConfig,
): Record<string, string> {
  const bundleId = (translationBundleId || cultureId).trim();
  const base = config.bundles[bundleId] ?? {};
  bootstrapCultureTranslationRuntime(toCultureTranslationsBootMeta(config));
  return mergeTranslationBundle({ ...base }, cultureId);
}

let defaultPlatformCultureTranslationsService: PlatformCultureTranslationsService | null = null;

export function getDefaultPlatformCultureTranslationsService(): PlatformCultureTranslationsService {
  if (!defaultPlatformCultureTranslationsService) {
    defaultPlatformCultureTranslationsService = new PlatformCultureTranslationsService();
  }
  return defaultPlatformCultureTranslationsService;
}
