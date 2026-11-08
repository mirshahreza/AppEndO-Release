/**
 * Legacy geo ETL sometimes leaves canonical title as `hwy-region-{id}` when HWY_H_Eghteraat.EghteraName is null.
 */
const GEO_PLACEHOLDER_TITLE_RE = /^hwy-(region|maktab)-(\d+)$/i;

export function resolveGeoPlaceholderDisplayTitle(
  cultureId: string,
  canonical: string | null | undefined,
): string | null {
  const trimmed = String(canonical ?? '').trim();
  const match = GEO_PLACEHOLDER_TITLE_RE.exec(trimmed);
  if (!match) {
    return null;
  }
  const kind = match[1].toLowerCase();
  const legacyId = match[2];
  const normalizedCulture = String(cultureId || '').trim().toLowerCase();

  if (normalizedCulture === 'iq' || normalizedCulture === 'ar' || normalizedCulture.startsWith('ar-')) {
    return kind === 'region' ? `منطقة ${legacyId}` : `مكتب ${legacyId}`;
  }
  if (normalizedCulture === 'ir' || normalizedCulture === 'fa' || normalizedCulture.startsWith('fa')) {
    return kind === 'region' ? `منطقه ${legacyId}` : `دفتر ${legacyId}`;
  }
  return kind === 'region' ? `Region ${legacyId}` : `Maktab ${legacyId}`;
}

export function isGeoPlaceholderCanonicalTitle(title: string | null | undefined): boolean {
  return GEO_PLACEHOLDER_TITLE_RE.test(String(title ?? '').trim());
}
