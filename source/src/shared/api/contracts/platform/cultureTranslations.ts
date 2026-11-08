import { BUILTIN_CULTURE_PACK_IDS } from './cultures';

export const MASTER_TRANSLATION_BUNDLE_ID = 'us';

export type PlatformCultureTranslationBundles = Record<string, Record<string, string>>;

export type PlatformCultureTranslationOverrides = Record<string, Record<string, string>>;

/** Full platform translation state persisted in control-plane DB (`platformCultureTranslations` blob). */
export type PlatformCultureTranslationsConfig = {
  revision: number;
  bundles: PlatformCultureTranslationBundles;
  cultureOverrides: PlatformCultureTranslationOverrides;
};

/** Slim payload sent on boot — bundles are fetched lazily per culture. */
export type PlatformCultureTranslationsBootMeta = Pick<
  PlatformCultureTranslationsConfig,
  'revision' | 'cultureOverrides'
>;

export const DEFAULT_PLATFORM_CULTURE_TRANSLATIONS_CONFIG: PlatformCultureTranslationsConfig = {
  revision: 0,
  bundles: {},
  cultureOverrides: {},
};

export type CultureTranslationEntry = {
  key: string;
  native: string;
  translation: string;
  isOverridden: boolean;
};

export type CultureTranslationCultureColumn = {
  id: string;
  label: string;
  locale?: string;
  translationBundleId: string;
  direction: 'ltr' | 'rtl';
};

export type PlatformCultureTranslationBundleResponse = {
  success: true;
  bundleId: string;
  revision: number;
  bundle: Record<string, string>;
};

export type PlatformCultureTranslationsResponse = {
  success: true;
  revision: number;
  keys: string[];
  masterBundle: Record<string, string>;
  defaultBundles: PlatformCultureTranslationBundles;
  cultureOverrides: PlatformCultureTranslationOverrides;
  cultures: CultureTranslationCultureColumn[];
};

export type UpdatePlatformCultureTranslationsPayload = PlatformCultureTranslationsConfig;

export const BUILTIN_TRANSLATION_CULTURE_IDS = [...BUILTIN_CULTURE_PACK_IDS] as const;
