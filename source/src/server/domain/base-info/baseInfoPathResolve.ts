import {
  collectBaseInfoAncestorIds,
  joinBaseInfoTitlePathSegments,
} from '../../../shared/lib/baseInfoCultureTranslations';
import { prisma } from '../users/prismaHelpers';
import { resolveRowLabel } from './baseInfoListMapping';

type TitleRow = { id: string; title: string | null };

const loadTitleRowsByIds = async (ids: string[]): Promise<Map<string, TitleRow>> => {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await prisma().baseInfo.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, title: true },
  });

  return new Map(rows.map((row) => [row.id, row]));
};

/** Compute display title paths in-memory (used when materialized table is empty or stale). */
export async function computeDisplayTitlePathsForCulture(
  nodeIds: string[],
  cultureId: string,
  bundle: Record<string, string>,
): Promise<Map<string, string>> {
  const normalizedCultureId = cultureId.trim() || 'us';
  const ancestorIds = new Set<string>();
  for (const nodeId of nodeIds) {
    for (const id of collectBaseInfoAncestorIds(nodeId)) {
      ancestorIds.add(id);
    }
  }

  const rowsById = await loadTitleRowsByIds([...ancestorIds]);
  const memo = new Map<string, string>();

  const computeOne = (nodeId: string): string => {
    const memoKey = `${normalizedCultureId}:${nodeId}`;
    const cached = memo.get(memoKey);
    if (cached !== undefined) {
      return cached;
    }

    const chain = collectBaseInfoAncestorIds(nodeId);
    const segments = chain
      .map((id) => rowsById.get(id))
      .filter((row): row is TitleRow => Boolean(row))
      .map((row) => resolveRowLabel(row, normalizedCultureId, bundle));

    const path = joinBaseInfoTitlePathSegments(segments);
    memo.set(memoKey, path);
    return path;
  };

  const paths = new Map<string, string>();
  for (const nodeId of nodeIds) {
    const trimmed = nodeId.trim();
    if (!trimmed) {
      continue;
    }
    paths.set(trimmed, computeOne(trimmed));
  }

  return paths;
}
