import {
  BUILTIN_CULTURE_PACK_IDS,
  DEFAULT_PLATFORM_CULTURES_CONFIG,
} from '../../../shared/api/contracts/platform/cultures';
import {
  collectBaseInfoAncestorIds,
  joinBaseInfoTitlePathSegments,
  resolveBaseInfoLocalizedText,
  type BaseInfoLocaleTexts,
} from '../../../shared/lib/baseInfoCultureTranslations';
import { prisma } from '../users/prismaHelpers';
import { buildMergedCultureBundle } from './baseInfoCultureTranslationStore';
import { upsertBaseInfoTitlePaths } from './baseInfoTitlePathSequelizeModel';

export {
  BASE_INFO_TITLE_PATH_SEPARATOR,
  joinBaseInfoTitlePathSegments,
} from '../../../shared/lib/baseInfoCultureTranslations';

type TitleRow = {
  id: string;
  parentId: string | null;
  title: string | null;
};

const titleSelect = {
  id: true,
  parentId: true,
  title: true,
} as const;

export const resolveBaseInfoTitlePathSegment = (
  row: TitleRow,
  cultureId: string,
  bundle: Record<string, string>,
): string => (
  resolveBaseInfoLocalizedText({
    cultureId,
    baseInfoId: row.id,
    field: 'title',
    canonical: row.title,
    bundle,
  })
);

const computeTitlePathForCulture = (
  row: TitleRow,
  cultureId: string,
  rowsById: Map<string, TitleRow>,
  bundle: Record<string, string>,
  memo: Map<string, string>,
): string => {
  const memoKey = `${cultureId}:${row.id}`;
  const cached = memo.get(memoKey);
  if (cached !== undefined) {
    return cached;
  }

  const ancestorIds = collectBaseInfoAncestorIds(row.id);
  const segments = ancestorIds
    .map((id) => rowsById.get(id))
    .filter((ancestor): ancestor is TitleRow => Boolean(ancestor))
    .map((ancestor) => resolveBaseInfoTitlePathSegment(ancestor, cultureId, bundle));

  const path = joinBaseInfoTitlePathSegments(segments);
  memo.set(memoKey, path);
  return path;
};

const enabledCultureIds = (): string[] => {
  const fromBuiltin = [...BUILTIN_CULTURE_PACK_IDS];
  return fromBuiltin.length > 0 ? fromBuiltin : [DEFAULT_PLATFORM_CULTURES_CONFIG.defaultCultureId];
};

const loadRowsById = async (ids: string[]): Promise<Map<string, TitleRow>> => {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await prisma().baseInfo.findMany({
    where: { id: { in: uniqueIds } },
    select: titleSelect,
  });

  return new Map(rows.map((row) => [row.id, row]));
};

const ensureAncestorRows = async (
  rowsById: Map<string, TitleRow>,
  rootIds: string[],
): Promise<void> => {
  const pendingParentIds = new Set<string>();

  const collectParents = (row: TitleRow | undefined) => {
    if (!row?.parentId || rowsById.has(row.parentId)) {
      return;
    }
    pendingParentIds.add(row.parentId);
  };

  for (const rootId of rootIds) {
    collectParents(rowsById.get(rootId));
  }

  while (pendingParentIds.size > 0) {
    const batch = [...pendingParentIds];
    pendingParentIds.clear();
    const loaded = await loadRowsById(batch);
    for (const [id, row] of loaded) {
      rowsById.set(id, row);
      collectParents(row);
    }
  }
};

const recomputeRows = async (rows: TitleRow[], rowsById: Map<string, TitleRow>): Promise<void> => {
  const sorted = [...rows].sort((left, right) => left.id.length - right.id.length);
  const cultures = enabledCultureIds();

  for (const cultureId of cultures) {
    const bundle = buildMergedCultureBundle(cultureId);
    const memo = new Map<string, string>();
    const updates: Array<{ baseInfoId: string; titlePath: string }> = [];

    for (const row of sorted) {
      const titlePath = computeTitlePathForCulture(row, cultureId, rowsById, bundle, memo);
      updates.push({ baseInfoId: row.id, titlePath });
    }

    await upsertBaseInfoTitlePaths(cultureId, updates);
  }
};

const normalizeCanonicalTitle = (value: string | null | undefined): string => (
  String(value ?? '').trim()
);

/** Skip subtree title-path recompute when canonical title and locale title overrides are unchanged. */
export function shouldRecomputeBaseInfoTitlePathsAfterSave(options: {
  previousCanonicalTitle: string | null | undefined;
  nextCanonicalTitle: string | null | undefined;
  locales?: BaseInfoLocaleTexts | null;
}): boolean {
  if (
    normalizeCanonicalTitle(options.previousCanonicalTitle)
    !== normalizeCanonicalTitle(options.nextCanonicalTitle)
  ) {
    return true;
  }
  if (!options.locales) {
    return false;
  }
  return Object.values(options.locales).some((entry) => entry?.title !== undefined);
}

/** Recompute localized title paths for one node and every descendant (by hierarchical id prefix). */
export async function recomputeBaseInfoTitlePathsForSubtree(rootId: string): Promise<void> {
  const root = rootId.trim();
  if (!root) {
    return;
  }

  const subtreeRows = await prisma().baseInfo.findMany({
    where: {
      OR: [{ id: root }, { id: { startsWith: `${root}.` } }],
    },
    select: titleSelect,
  });
  if (subtreeRows.length === 0) {
    return;
  }

  const rowsById = new Map(subtreeRows.map((row) => [row.id, row]));
  await ensureAncestorRows(rowsById, [root]);
  await recomputeRows(subtreeRows, rowsById);
}

/** Full-table backfill (install upgrade or repair). */
export async function recomputeAllBaseInfoTitlePaths(): Promise<void> {
  const allRows = await prisma().baseInfo.findMany({
    select: titleSelect,
    orderBy: [{ id: 'asc' }],
  });
  if (allRows.length === 0) {
    return;
  }

  const rowsById = new Map(allRows.map((row) => [row.id, row]));
  await recomputeRows(allRows, rowsById);
}

/** Assign localized title paths for a single newly inserted node. */
export async function assignBaseInfoTitlePathForNewNode(nodeId: string): Promise<void> {
  await recomputeBaseInfoTitlePathsForSubtree(nodeId.trim());
}

export const BASE_INFO_TITLE_PATH_CULTURE_IDS = BUILTIN_CULTURE_PACK_IDS;
