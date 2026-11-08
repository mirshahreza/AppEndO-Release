import type { CultureCalendarId, CultureTypography } from '../systemExtensions/types';

/** Hawiety legacy UI font (Tajawal Regular) — platform Web Font id under Settings → Web Fonts. */
export const IQ_HAWIETY_WEB_FONT_ID = 'web-tajawal-regular';

export type PlatformCulturePack = {
  id: string;
  label: string;
  language: string;
  locale: string;
  calendar: CultureCalendarId;
  direction: 'ltr' | 'rtl';
  translationBundleId: string;
  defaultTimezone?: string;
  /** Override default font from the translation bundle typography catalog. */
  typography?: CultureTypography;
};

export type PlatformCulturePackSource = 'builtin' | 'custom';

export type PlatformCulturePackSummary = PlatformCulturePack & {
  source: PlatformCulturePackSource;
};

export type PlatformCulturesConfig = {
  packs: PlatformCulturePack[];
  enabledCulturePackIds: string[];
  defaultCultureId: string;
};

export type PlatformCulturesResponse = PlatformCulturesConfig & {
  success: true;
  availablePacks: PlatformCulturePackSummary[];
};

export type UpdatePlatformCulturesPayload = PlatformCulturesConfig;

export const BUILTIN_CULTURE_PACK_IDS = ['us', 'ir', 'iq'] as const;

export const DEFAULT_BUILTIN_CULTURE_PACKS: PlatformCulturePack[] = [
  {
    id: 'us',
    label: 'United States',
    language: 'en',
    locale: 'en-US',
    calendar: 'gregorian',
    direction: 'ltr',
    translationBundleId: 'us',
  },
  {
    id: 'ir',
    label: 'Iran',
    language: 'fa',
    locale: 'fa-IR',
    calendar: 'jalali',
    direction: 'rtl',
    translationBundleId: 'ir',
  },
  {
    id: 'iq',
    label: 'Iraq',
    language: 'ar',
    locale: 'ar-IQ',
    calendar: 'gregorian',
    direction: 'rtl',
    translationBundleId: 'iq',
    defaultTimezone: 'Asia/Baghdad',
    typography: {
      defaultFontId: IQ_HAWIETY_WEB_FONT_ID,
      fonts: [],
    },
  },
];

export const DEFAULT_PLATFORM_CULTURES_CONFIG: PlatformCulturesConfig = {
  packs: DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => ({ ...pack })),
  enabledCulturePackIds: [...BUILTIN_CULTURE_PACK_IDS],
  defaultCultureId: 'us',
};

export const CULTURE_PACK_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

/** Display order for builtin packs; custom packs sort after by id. */
export function compareCulturePackDisplayOrder(leftId: string, rightId: string): number {
  const order = BUILTIN_CULTURE_PACK_IDS as readonly string[];
  const leftIndex = order.indexOf(leftId);
  const rightIndex = order.indexOf(rightId);
  if (leftIndex !== -1 && rightIndex !== -1) {
    return leftIndex - rightIndex;
  }
  if (leftIndex !== -1) {
    return -1;
  }
  if (rightIndex !== -1) {
    return 1;
  }
  return leftId.localeCompare(rightId);
}

export function resolveCulturePackSource(packId: string): PlatformCulturePackSource {
  return (BUILTIN_CULTURE_PACK_IDS as readonly string[]).includes(packId) ? 'builtin' : 'custom';
}
