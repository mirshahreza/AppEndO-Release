import type { PlatformCultureTranslationsResponse } from '../../../shared/api/contracts/platform/cultureTranslations';

export function buildEffectiveCultureDraft(
  data: PlatformCultureTranslationsResponse,
  cultureId: string,
): Record<string, string> {
  const culture = data.cultures.find((entry) => entry.id === cultureId);
  if (!culture) {
    return {};
  }

  const defaults = data.defaultBundles[culture.translationBundleId]
    ?? data.defaultBundles[culture.id]
    ?? {};
  const overrides = data.cultureOverrides[cultureId] ?? {};
  return { ...defaults, ...overrides };
}
