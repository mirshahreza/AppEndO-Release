import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { lookupEmbeddedEnglish } from '../../core/culture/embeddedTranslationBundles';
import { designerKey } from '../../core/culture/translations/cultureKeyHelpers';

export function designerText(suffix: string, t?: TranslationFn): string {
  const key = designerKey(suffix);
  return t ? t(key) : lookupEmbeddedEnglish(key);
}

export function interpolateDesignerTemplate(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
