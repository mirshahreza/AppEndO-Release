import { MASTER_TRANSLATION_BUNDLE_ID } from '../api/contracts/platform/cultureTranslations';

/** Culture-translations key for a settings attribute display label. */
export const ATTRIBUTE_LABEL_TRANSLATION_PREFIX = 'settings.attributes.label.';

export function attributeLabelTranslationKey(attributeKey: string): string {
  return `${ATTRIBUTE_LABEL_TRANSLATION_PREFIX}${String(attributeKey || '').trim().toLowerCase()}`;
}

export function isAttributeLabelTranslationKey(key: string): boolean {
  return key.startsWith(ATTRIBUTE_LABEL_TRANSLATION_PREFIX);
}

/**
 * Resolve an attribute label from culture `t()`, falling back to canonical DB label then key.
 * When `t(key)` returns the key itself, treat as missing translation.
 */
export function resolveAttributeLabel(options: {
  attributeKey: string;
  fallbackLabel?: string | null;
  t?: (key: string) => string;
}): string {
  const attributeKey = String(options.attributeKey || '').trim();
  const translationKey = attributeLabelTranslationKey(attributeKey);
  if (options.t) {
    const translated = options.t(translationKey);
    if (translated && translated !== translationKey) {
      return translated;
    }
  }
  const fallback = options.fallbackLabel?.trim();
  return fallback || attributeKey || translationKey;
}

export { MASTER_TRANSLATION_BUNDLE_ID };
