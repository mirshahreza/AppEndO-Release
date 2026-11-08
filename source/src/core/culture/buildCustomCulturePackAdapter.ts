import type { PlatformCulturePack } from '../../shared/api/contracts/platform/cultures';
import type { CulturePackAdapter } from '../../shared/api/contracts/systemExtensions/types';
import { loadBuiltinTranslationBundle } from './builtinTranslationLoader';
import { mergeCultureTypography } from './cultureTypographyMerge';
import { mergeTranslationBundle } from './CultureTranslationOverrides';

export function buildCustomCulturePackAdapter(
  pack: PlatformCulturePack,
): CulturePackAdapter {
  const typography = mergeCultureTypography(pack.translationBundleId, pack.typography);

  return {
    extension: {
      type: 'culture-pack',
      id: pack.id,
      label: pack.label,
      language: pack.language,
      locale: pack.locale,
      calendar: pack.calendar,
      direction: pack.direction,
      translationBundleId: pack.translationBundleId,
      defaultTimezone: pack.defaultTimezone,
      typography,
      enabled: true,
      trusted: true,
      signed: true,
      capabilities: ['culture.read', 'culture.bundle', 'culture.calendar'],
    },
    loadTranslationBundle: async () => {
      const base = await loadBuiltinTranslationBundle(pack.translationBundleId);
      return mergeTranslationBundle(base, pack.id);
    },
  };
}
