import { loadMasterTranslationBundle as loadMasterBuiltinTranslationBundle } from './builtinTranslationLoader';
import { EMBEDDED_ENGLISH_BUNDLE } from './embeddedTranslationBundles';
import { ALWAYS_ENGLISH_TRANSLATION_KEYS } from './technicalCultureLabels';

export type TranslationLookupOptions = {
  /** Default `warn` in development. Nav/package fallbacks should pass `silent`. */
  missing?: 'warn' | 'silent';
};

export type TranslationFn = (key: string, options?: TranslationLookupOptions) => string;

export type TranslationRuntime = {
  t: TranslationFn;
  bundle: Record<string, string>;
  fallbackBundle: Record<string, string>;
};

let devWarningsEnabled = typeof import.meta !== 'undefined'
  && import.meta.env?.DEV === true
  ? true
  : process.env.NODE_ENV !== 'production';

export function setTranslationDevWarningsEnabled(enabled: boolean): void {
  devWarningsEnabled = enabled;
}

export function createTranslationRuntime(
  bundle: Record<string, string>,
  fallbackBundle: Record<string, string>,
): TranslationRuntime {
  const warnedKeys = new Set<string>();

  const t: TranslationFn = (key: string, options?: TranslationLookupOptions) => {
    const warnMissing = options?.missing !== 'silent';

    if (ALWAYS_ENGLISH_TRANSLATION_KEYS.has(key)) {
      const english = EMBEDDED_ENGLISH_BUNDLE[key];
      if (english != null && english !== '') {
        return english;
      }
    }

    const value = bundle[key];
    if (value != null && value !== '') {
      return value;
    }

    const fallback = fallbackBundle[key];
    if (fallback != null && fallback !== '') {
      if (warnMissing && devWarningsEnabled && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        console.warn(`[culture] Missing translation key "${key}" — falling back to master bundle.`);
      }
      return fallback;
    }

    const embeddedEnglish = EMBEDDED_ENGLISH_BUNDLE[key];
    if (embeddedEnglish != null && embeddedEnglish !== '') {
      if (warnMissing && devWarningsEnabled && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        console.warn(`[culture] Missing translation key "${key}" — falling back to embedded English.`);
      }
      return embeddedEnglish;
    }

    if (warnMissing && devWarningsEnabled && !warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn(`[culture] Missing translation key "${key}" — returning key as label.`);
    }

    return key;
  };

  return { t, bundle, fallbackBundle };
}

export async function loadMasterTranslationBundle(): Promise<Record<string, string>> {
  return loadMasterBuiltinTranslationBundle();
}

