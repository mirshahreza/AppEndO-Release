import type { CultureTypography } from '../../shared/api/contracts/systemExtensions/types';
import { resolveWebFontScriptForBundle } from '../../shared/lib/platformWebFonts';
import {
  getPlatformWebFonts,
  isWebFontId,
  webFontToCultureFontDefinition,
} from './platformWebFontRegistry';
import {
  IQ_CULTURE_TYPOGRAPHY,
  IR_CULTURE_TYPOGRAPHY,
  US_CULTURE_TYPOGRAPHY,
} from './cultureTypography';

export const KNOWN_CULTURE_FONT_IDS = [
  'inter',
  'source-sans-3',
  'ibm-plex-sans',
  'vazirmatn',
  'parastoo',
  'noto-sans-arabic',
  'ibm-plex-sans-arabic',
  'rubik',
] as const;

export type KnownCultureFontId = typeof KNOWN_CULTURE_FONT_IDS[number];

const KNOWN_FONT_ID_SET = new Set<string>(KNOWN_CULTURE_FONT_IDS);

export function isKnownCultureFontId(fontId: string): fontId is KnownCultureFontId {
  return KNOWN_FONT_ID_SET.has(fontId);
}

export function isAllowedCultureFontId(fontId: string): boolean {
  const normalized = fontId.trim();
  if (!normalized) {
    return false;
  }

  if (isKnownCultureFontId(normalized)) {
    return true;
  }

  return isWebFontId(normalized) && getPlatformWebFonts().some((font) => font.id === normalized);
}

export function resolveBuiltinTypographyForBundle(translationBundleId: string): CultureTypography {
  switch (translationBundleId.trim()) {
    case 'ir':
      return IR_CULTURE_TYPOGRAPHY;
    case 'iq':
      return IQ_CULTURE_TYPOGRAPHY;
    default:
      return US_CULTURE_TYPOGRAPHY;
  }
}

function mergeTypographyFonts(base: CultureTypography, translationBundleId: string): CultureTypography {
  const script = resolveWebFontScriptForBundle(translationBundleId);
  const webFonts = getPlatformWebFonts()
    .filter((font) => font.script === script)
    .map(webFontToCultureFontDefinition);
  if (webFonts.length === 0) {
    return base;
  }

  const mergedFonts = [...base.fonts];
  const seenIds = new Set(mergedFonts.map((font) => font.id));

  for (const font of webFonts) {
    if (seenIds.has(font.id)) {
      continue;
    }
    mergedFonts.push(font);
    seenIds.add(font.id);
  }

  return {
    ...base,
    fonts: mergedFonts,
  };
}

export function normalizeCultureTypography(raw: unknown): CultureTypography | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const defaultFontId = typeof input.defaultFontId === 'string' ? input.defaultFontId.trim() : '';
  if (!defaultFontId || !isAllowedCultureFontId(defaultFontId)) {
    return undefined;
  }

  if (!Array.isArray(input.fonts)) {
    return { defaultFontId, fonts: [] };
  }

  const fonts = input.fonts
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id.trim() : '',
      label: typeof item.label === 'string' ? item.label.trim() : '',
      family: typeof item.family === 'string' ? item.family.trim() : '',
      url: typeof item.url === 'string' ? item.url.trim() : undefined,
      format: item.format === 'woff2' || item.format === 'woff' || item.format === 'ttf' || item.format === 'otf'
        ? item.format
        : undefined,
    }))
    .filter((font) => font.id && font.label && font.family && isAllowedCultureFontId(font.id));

  return {
    defaultFontId,
    fonts,
  };
}

export function mergeCultureTypography(
  translationBundleId: string,
  settingsTypography?: CultureTypography,
): CultureTypography {
  const base = mergeTypographyFonts(resolveBuiltinTypographyForBundle(translationBundleId), translationBundleId);

  if (!settingsTypography) {
    return base;
  }

  const defaultFontId = settingsTypography.defaultFontId.trim();
  if (!defaultFontId || !base.fonts.some((font) => font.id === defaultFontId)) {
    return base;
  }

  return {
    ...base,
    defaultFontId,
  };
}

export function validateCultureTypographyOverride(
  translationBundleId: string,
  typography: CultureTypography | undefined,
): string | null {
  if (!typography) {
    return null;
  }

  const base = mergeTypographyFonts(resolveBuiltinTypographyForBundle(translationBundleId), translationBundleId);
  const defaultFontId = typography.defaultFontId.trim();

  if (!defaultFontId) {
    return 'Default font is required when typography override is set.';
  }

  if (!isAllowedCultureFontId(defaultFontId)) {
    return `Unknown font id "${defaultFontId}".`;
  }

  if (!base.fonts.some((font) => font.id === defaultFontId)) {
    return `Font "${defaultFontId}" is not allowed for translation bundle "${translationBundleId}".`;
  }

  return null;
}

export function resolveCultureFontOptions(
  translationBundleId: string,
): CultureTypography['fonts'] {
  return mergeTypographyFonts(resolveBuiltinTypographyForBundle(translationBundleId), translationBundleId).fonts;
}

export function resolveCultureFontDefinition(fontId: string): CultureTypography['fonts'][number] | undefined {
  const normalized = fontId.trim();
  const webFont = getPlatformWebFonts().find((font) => font.id === normalized);
  if (webFont) {
    return webFontToCultureFontDefinition(webFont);
  }

  for (const bundleId of ['us', 'ir', 'iq']) {
    const match = resolveCultureFontOptions(bundleId).find((font) => font.id === normalized);
    if (match) {
      return match;
    }
  }

  return undefined;
}
