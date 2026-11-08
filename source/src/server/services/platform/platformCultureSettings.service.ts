import {
  bootstrapCultureRegistry,
  resolveCulturePackAdapter,
} from '../../../core/culture/CultureRegistry';
import type {
  PlatformCulturesConfig,
  PlatformCulturesResponse,
  UpdatePlatformCulturesPayload,
} from '../../../shared/api/contracts/platform/cultures';
import { resolveCulturePackSource, compareCulturePackDisplayOrder } from '../../../shared/api/contracts/platform/cultures';
import { SETTINGS_PATH } from '../../config/settingsFile';
import {
  getPlatformCulturesConfig,
  savePlatformCulturesConfig,
} from '../../db/platformCultureSettingsStore';
import { validatePlatformCulturesConfig } from './platformCultureValidation';
import { bootstrapPlatformCultureTranslationsFromSettings } from './platformCultureTranslations.service';
import { applyPlatformWebFontsRuntime } from './platformWebFontsRuntime';

function listAvailableCulturePackSummaries(config: PlatformCulturesConfig) {
  return config.packs.map((pack) => ({
    ...pack,
    source: resolveCulturePackSource(pack.id),
  })).sort((left, right) => compareCulturePackDisplayOrder(left.id, right.id));
}

function applyPlatformCulturesRuntime(config: PlatformCulturesConfig): void {
  applyPlatformWebFontsRuntime();
  bootstrapCultureRegistry({
    enabledCulturePackIds: config.enabledCulturePackIds,
    defaultCultureId: config.defaultCultureId,
    packs: config.packs,
  });
  bootstrapPlatformCultureTranslationsFromSettings();
}

function resolvePackIdForValidation(config: PlatformCulturesConfig, cultureId: string): boolean {
  bootstrapCultureRegistry(config);
  return Boolean(resolveCulturePackAdapter(cultureId));
}

export class PlatformCultureSettingsService {
  constructor(private readonly settingsPath: string = SETTINGS_PATH) {}

  getCultures(): { body: PlatformCulturesResponse } {
    applyPlatformWebFontsRuntime(this.settingsPath);
    const config = getPlatformCulturesConfig(this.settingsPath);
    applyPlatformCulturesRuntime(config);

    return {
      body: {
        success: true,
        ...config,
        availablePacks: listAvailableCulturePackSummaries(config),
      },
    };
  }

  updateCultures(input: UpdatePlatformCulturesPayload): { body: { success: true } } {
    const validated = validatePlatformCulturesConfig(
      input,
      (cultureId) => resolvePackIdForValidation(input, cultureId),
      this.settingsPath,
    );
    const saved = savePlatformCulturesConfig(this.settingsPath, validated);
    applyPlatformCulturesRuntime(saved);

    return { body: { success: true } };
  }
}

export function bootstrapPlatformCulturesFromSettings(
  settingsPath: string = SETTINGS_PATH,
): PlatformCulturesConfig {
  applyPlatformWebFontsRuntime(settingsPath);
  const config = getPlatformCulturesConfig(settingsPath);
  applyPlatformCulturesRuntime(config);
  return config;
}

let defaultPlatformCultureSettingsService: PlatformCultureSettingsService | null = null;

export function getDefaultPlatformCultureSettingsService(): PlatformCultureSettingsService {
  if (!defaultPlatformCultureSettingsService) {
    defaultPlatformCultureSettingsService = new PlatformCultureSettingsService();
  }
  return defaultPlatformCultureSettingsService;
}
