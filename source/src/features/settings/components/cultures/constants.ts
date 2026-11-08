import type { CultureCalendarId } from '../../../../shared/api/contracts/systemExtensions/types';
import type { PlatformCulturePack } from '../../../../shared/api/contracts/platform/cultures';
import { BUILTIN_CULTURE_PACK_IDS, CULTURE_PACK_ID_PATTERN } from '../../../../shared/api/contracts/platform/cultures';
import { resolveBuiltinTypographyForBundle, resolveCultureFontOptions as resolveMergedCultureFontOptions } from '../../../../core/culture/cultureTypographyMerge';

export { buildCultureTimezoneOptions as resolveCultureTimezoneOptions } from '../../../../shared/lib/ianaTimezoneOptions';

export const CULTURE_CALENDAR_OPTIONS: Array<{ value: CultureCalendarId; label: string }> = [
  { value: 'gregorian', label: 'Gregorian' },
  { value: 'jalali', label: 'Jalali' },
  { value: 'hijri', label: 'Hijri' },
  { value: 'hebrew', label: 'Hebrew' },
];

export const CULTURE_DIRECTION_OPTIONS = [
  { value: 'ltr' as const, label: 'Left to right (LTR)' },
  { value: 'rtl' as const, label: 'Right to left (RTL)' },
];

export const EMPTY_CULTURE_PACK: PlatformCulturePack = {
  id: '',
  label: '',
  language: 'en',
  locale: '',
  calendar: 'gregorian',
  direction: 'ltr',
  translationBundleId: 'us',
};

export type DeriveCulturePackContext = {
  preserveId?: string;
  existingIds?: string[];
};

export function deriveCultureLabel(locale: string): string {
  return locale.trim();
}

export function resolveCultureDisplayLabel(pack: Pick<PlatformCulturePack, 'locale' | 'label'>): string {
  return pack.locale?.trim() || pack.label?.trim() || '';
}

export function slugifyCultureIdSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!normalized) {
    return '';
  }

  if (/^[a-z]/.test(normalized)) {
    return normalized.slice(0, 32);
  }

  return `l-${normalized}`.slice(0, 32);
}

export function deriveCultureId(
  locale: string,
  calendar: CultureCalendarId,
  existingIds: string[],
  preserveId?: string,
): string {
  const preserved = preserveId?.trim();
  if (preserved) {
    return preserved;
  }

  const taken = new Set(existingIds.map((id) => id.trim()).filter(Boolean));
  const localeSlug = slugifyCultureIdSegment(locale);
  if (!localeSlug) {
    return '';
  }

  const candidates = [
    localeSlug,
    `${localeSlug}-${calendar}`,
  ];

  for (const candidate of candidates) {
    if (CULTURE_PACK_ID_PATTERN.test(candidate) && !taken.has(candidate)) {
      return candidate;
    }
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const base = localeSlug.slice(0, Math.max(1, 28 - String(suffix).length));
    const candidate = `${base}-${suffix}`;
    if (CULTURE_PACK_ID_PATTERN.test(candidate) && !taken.has(candidate)) {
      return candidate;
    }
  }

  return localeSlug.slice(0, 32);
}

export function applyDerivedCulturePack(
  pack: PlatformCulturePack,
  context: DeriveCulturePackContext = {},
): PlatformCulturePack {
  const locale = pack.locale.trim();
  const existingIds = context.existingIds ?? [];
  const preserveId = context.preserveId ?? (pack.id.trim() || undefined);
  const id = deriveCultureId(locale, pack.calendar, existingIds, preserveId);

  return applyDerivedTranslationBundle({
    ...pack,
    locale,
    label: deriveCultureLabel(locale),
    id,
  });
}

/** Builtin cultures use their own bundle; custom cultures inherit from locale language. */
export function deriveTranslationBundleId(cultureId: string, locale: string): string {
  const id = cultureId.trim();
  if ((BUILTIN_CULTURE_PACK_IDS as readonly string[]).includes(id)) {
    return id;
  }

  const fromLocale = locale.trim().split('-')[0]?.toLowerCase() ?? '';
  switch (fromLocale) {
    case 'fa':
      return 'ir';
    case 'ar':
      return 'iq';
    default:
      return 'us';
  }
}

export function applyDerivedTranslationBundle(pack: PlatformCulturePack): PlatformCulturePack {
  const translationBundleId = deriveTranslationBundleId(pack.id, pack.locale);
  const previousBundleId = pack.translationBundleId?.trim() ?? '';

  if (translationBundleId === previousBundleId) {
    return { ...pack, translationBundleId };
  }

  const nextFonts = resolveCultureFontOptions(translationBundleId);
  return {
    ...pack,
    translationBundleId,
    typography: {
      defaultFontId: resolveDefaultCultureFontId(translationBundleId),
      fonts: nextFonts,
    },
  };
}

/** BCP-47 language subtag derived from locale; falls back to translation bundle defaults. */
export function deriveCultureLanguage(locale: string, translationBundleId: string): string {
  const fromLocale = locale.trim().split('-')[0]?.toLowerCase() ?? '';
  if (/^[a-z]{2,3}$/.test(fromLocale)) {
    return fromLocale;
  }

  switch (translationBundleId.trim()) {
    case 'ir':
      return 'fa';
    case 'iq':
      return 'ar';
    default:
      return 'en';
  }
}

export const formatCalendarLabel = (calendar: string) => {
  switch (calendar) {
    case 'gregorian':
      return 'Gregorian';
    case 'jalali':
      return 'Jalali';
    case 'hijri':
      return 'Hijri';
    case 'hebrew':
      return 'Hebrew';
    default:
      return calendar;
  }
};

export function resolveCultureFontOptions(translationBundleId: string) {
  return resolveMergedCultureFontOptions(translationBundleId);
}

export function resolveDefaultCultureFontId(
  translationBundleId: string,
  typography?: PlatformCulturePack['typography'],
): string {
  const base = resolveCultureFontOptions(translationBundleId);
  const defaultFromBundle = resolveBuiltinTypographyForBundle(translationBundleId).defaultFontId;
  const overrideId = typography?.defaultFontId?.trim();
  if (overrideId && base.some((font) => font.id === overrideId)) {
    return overrideId;
  }
  return defaultFromBundle;
}
