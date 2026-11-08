import type { TranslationFn } from '../../../core/culture/TranslationRuntime';
import { baseInfoTranslationKey } from '../../../shared/lib/baseInfoCultureTranslations';
import { resolveBaseInfoIqCanonicalTitle } from '../../../shared/lib/baseInfoIqTitlesByEnglish';
import { resolveGeoPlaceholderDisplayTitle } from '../../../shared/lib/baseInfoGeoPlaceholderTitle';

export function resolveBaseInfoNodeDisplayLabel(
  t: TranslationFn,
  row: { id: string; label?: string | null; title?: string | null },
  cultureId?: string,
): string {
  const key = baseInfoTranslationKey('title', row.id);
  const translated = t(key);
  if (translated && translated !== key) {
    return translated;
  }
  const canonical = row.label || row.title || '';
  const geoPlaceholder = cultureId
    ? resolveGeoPlaceholderDisplayTitle(cultureId, canonical)
    : resolveGeoPlaceholderDisplayTitle('us', canonical);
  if (geoPlaceholder) {
    return geoPlaceholder;
  }
  const iqTitle = cultureId
    ? resolveBaseInfoIqCanonicalTitle(cultureId, canonical)
    : undefined;
  if (iqTitle) {
    return iqTitle;
  }
  return canonical || row.id;
}
