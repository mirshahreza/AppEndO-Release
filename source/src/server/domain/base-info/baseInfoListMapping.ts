import {
  resolveBaseInfoLocalizedText,
} from '../../../shared/lib/baseInfoCultureTranslations';
import { resolveGeoPlaceholderDisplayTitle } from '../../../shared/lib/baseInfoGeoPlaceholderTitle';
import { buildMergedCultureBundle } from './baseInfoCultureTranslationStore';
import { computeDisplayTitlePathsForCulture } from './baseInfoPathResolve';
import { listBaseInfoTitlePathsForCulture } from './baseInfoTitlePathSequelizeModel';

export type BaseInfoDbRow = {
  id: string;
  parentId: string | null;
  title: string | null;
  shortName: string | null;
  note: string | null;
  metadata: string | null;
  value: number | null;
  isActive: boolean;
  viewOrder: { toNumber?: () => number } | number | null;
  uiColor: string | null;
  uiHtml: string | null;
};

export const toViewOrderNumber = (value: { toNumber?: () => number } | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveRowLabel = (
  row: Pick<BaseInfoDbRow, 'id' | 'title'>,
  cultureId: string,
  bundle: Record<string, string>,
): string => {
  const localized = resolveBaseInfoLocalizedText({
    cultureId,
    baseInfoId: row.id,
    field: 'title',
    canonical: row.title,
    bundle,
  });
  const canonical = String(row.title ?? '').trim();
  if (localized !== canonical || !canonical) {
    return localized;
  }
  const geoPlaceholder = resolveGeoPlaceholderDisplayTitle(cultureId, canonical);
  if (geoPlaceholder) {
    return geoPlaceholder;
  }
  return localized;
};

export const resolveRowNote = (
  row: Pick<BaseInfoDbRow, 'id' | 'note'>,
  cultureId: string,
  bundle: Record<string, string>,
): string | null => {
  const resolved = resolveBaseInfoLocalizedText({
    cultureId,
    baseInfoId: row.id,
    field: 'note',
    canonical: row.note,
    bundle,
  });
  return resolved || null;
};

export async function mapBaseInfoRowsForCulture<T extends BaseInfoDbRow>(
  rows: T[],
  cultureId: string,
  mapper: (row: T, context: {
    label: string;
    resolvedNote: string | null;
    titlePath: string | null;
  }) => Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const normalizedCultureId = cultureId.trim() || 'us';
  const bundle = buildMergedCultureBundle(normalizedCultureId);
  const rowIds = rows.map((row) => row.id);
  let titlePathById = new Map<string, string>();
  try {
    titlePathById = await listBaseInfoTitlePathsForCulture(normalizedCultureId, rowIds);
  } catch {
    titlePathById = new Map();
  }

  const needsFallback = rowIds.some((id) => !titlePathById.get(id)?.trim());
  if (needsFallback) {
    const computed = await computeDisplayTitlePathsForCulture(rowIds, normalizedCultureId, bundle);
    titlePathById = new Map([...titlePathById, ...computed]);
  }

  return rows.map((row) => mapper(row, {
    label: resolveRowLabel(row, normalizedCultureId, bundle),
    resolvedNote: resolveRowNote(row, normalizedCultureId, bundle),
    titlePath: titlePathById.get(row.id)?.trim() || null,
  }));
}
