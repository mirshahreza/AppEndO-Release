import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';
import {
  BUILTIN_CULTURE_PACK_IDS,
  compareCulturePackDisplayOrder,
  DEFAULT_PLATFORM_CULTURES_CONFIG,
  type PlatformCulturePack,
  type PlatformCulturesConfig,
} from '../../shared/api/contracts/platform/cultures';
import type { CultureCalendarId } from '../../shared/api/contracts/systemExtensions/types';
import { IQ_HAWIETY_WEB_FONT_ID } from '../../shared/api/contracts/platform/cultures';
import { normalizeCultureTypography } from '../../core/culture/cultureTypographyMerge';

const PLATFORM_CULTURES_SETTINGS_KEY = 'platformCultures';

const CALENDAR_IDS = new Set<CultureCalendarId>(['gregorian', 'jalali', 'hijri', 'hebrew']);

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCulturePack(raw: unknown): PlatformCulturePack | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const input = raw as Record<string, unknown>;
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const language = typeof input.language === 'string' ? input.language.trim() : '';
  const locale = typeof input.locale === 'string' ? input.locale.trim() : '';
  const calendar = typeof input.calendar === 'string' ? input.calendar.trim() : '';
  const direction = input.direction === 'rtl' ? 'rtl' : input.direction === 'ltr' ? 'ltr' : null;
  const translationBundleId = typeof input.translationBundleId === 'string'
    ? input.translationBundleId.trim()
    : '';
  const defaultTimezone = typeof input.defaultTimezone === 'string' && input.defaultTimezone.trim()
    ? input.defaultTimezone.trim()
    : undefined;
  const typography = normalizeCultureTypography(input.typography);

  if (!id || !label || !language || !locale || !direction || !translationBundleId) {
    return null;
  }

  if (!CALENDAR_IDS.has(calendar as CultureCalendarId)) {
    return null;
  }

  return {
    id,
    label,
    language,
    locale,
    calendar: calendar as CultureCalendarId,
    direction,
    translationBundleId,
    ...(defaultTimezone ? { defaultTimezone } : {}),
    ...(typography ? { typography } : {}),
  };
}

function normalizeCulturePacks(value: unknown): PlatformCulturePack[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byId = new Map<string, PlatformCulturePack>();
  for (const item of value) {
    const pack = normalizeCulturePack(item);
    if (!pack) {
      continue;
    }
    byId.set(pack.id, pack);
  }

  return [...byId.values()].sort((left, right) => compareCulturePackDisplayOrder(left.id, right.id));
}

function resolveDefaultPacks(packs: PlatformCulturePack[]): PlatformCulturePack[] {
  if (packs.length > 0) {
    return packs;
  }

  return DEFAULT_PLATFORM_CULTURES_CONFIG.packs.map((pack) => ({ ...pack }));
}

function applyBuiltinCulturePackDefaults(packs: PlatformCulturePack[]): PlatformCulturePack[] {
  return packs.map((pack) => {
    if (pack.id !== 'iq' || pack.typography?.defaultFontId?.trim()) {
      return pack;
    }

    return {
      ...pack,
      typography: {
        defaultFontId: IQ_HAWIETY_WEB_FONT_ID,
        fonts: [],
      },
    };
  });
}

export function normalizePlatformCulturesConfig(raw: unknown): PlatformCulturesConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      packs: DEFAULT_PLATFORM_CULTURES_CONFIG.packs.map((pack) => ({ ...pack })),
      enabledCulturePackIds: [...DEFAULT_PLATFORM_CULTURES_CONFIG.enabledCulturePackIds],
      defaultCultureId: DEFAULT_PLATFORM_CULTURES_CONFIG.defaultCultureId,
    };
  }

  const input = raw as Record<string, unknown>;
  const packs = applyBuiltinCulturePackDefaults(resolveDefaultPacks(normalizeCulturePacks(input.packs)));
  const packIds = packs.map((pack) => pack.id);
  const enabledCulturePackIds = normalizeStringArray(input.enabledCulturePackIds);
  const defaultCultureId = typeof input.defaultCultureId === 'string' && input.defaultCultureId.trim()
    ? input.defaultCultureId.trim()
    : DEFAULT_PLATFORM_CULTURES_CONFIG.defaultCultureId;

  const resolvedEnabledIds = enabledCulturePackIds.length > 0
    ? enabledCulturePackIds.filter((id) => packIds.includes(id))
    : packIds.filter((id) => (BUILTIN_CULTURE_PACK_IDS as readonly string[]).includes(id));

  const resolvedDefaultId = packIds.includes(defaultCultureId)
    ? defaultCultureId
    : (resolvedEnabledIds[0] ?? DEFAULT_PLATFORM_CULTURES_CONFIG.defaultCultureId);

  return {
    packs,
    enabledCulturePackIds: resolvedEnabledIds.length > 0
      ? resolvedEnabledIds
      : [...DEFAULT_PLATFORM_CULTURES_CONFIG.enabledCulturePackIds],
    defaultCultureId: resolvedEnabledIds.includes(resolvedDefaultId)
      ? resolvedDefaultId
      : (resolvedEnabledIds[0] ?? DEFAULT_PLATFORM_CULTURES_CONFIG.defaultCultureId),
  };
}

export const getPlatformCulturesConfigFromFile = (
  settingsPath: string,
): PlatformCulturesConfig => {
  const settings = readSettingsObject(settingsPath);
  return normalizePlatformCulturesConfig(settings[PLATFORM_CULTURES_SETTINGS_KEY]);
};

export const savePlatformCulturesConfigToFile = (
  settingsPath: string,
  config: PlatformCulturesConfig,
): PlatformCulturesConfig => {
  const normalized = normalizePlatformCulturesConfig(config);
  const settings = readSettingsObject(settingsPath);
  settings[PLATFORM_CULTURES_SETTINGS_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

export const getPlatformCulturesConfig = (
  settingsPath: string,
): PlatformCulturesConfig => readPlatformBlob(
  settingsPath,
  'platformCultures',
  getPlatformCulturesConfigFromFile,
  (raw) => normalizePlatformCulturesConfig(raw),
);

export const savePlatformCulturesConfig = (
  settingsPath: string,
  config: PlatformCulturesConfig,
): PlatformCulturesConfig => {
  const normalized = normalizePlatformCulturesConfig(config);
  return writePlatformBlob(
    settingsPath,
    'platformCultures',
    normalized as unknown as Record<string, unknown>,
    savePlatformCulturesConfigToFile,
  ) as unknown as PlatformCulturesConfig;
};

export const ensurePlatformCulturesSettings = (
  settingsPath: string,
): PlatformCulturesConfig => getPlatformCulturesConfig(settingsPath);
