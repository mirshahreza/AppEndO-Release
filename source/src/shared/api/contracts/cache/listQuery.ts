import type { CacheEntryRecord } from './types';
import type { GridQueryState } from '../../../lib/appTableGridQuery';

/** Hard cap for GET /api/cache — the grid used to dump every in-memory key. */
export const CACHE_ENTRIES_LIST_MAX = 500;

export type CacheEntriesListQuery = {
  sortBy?: 'cacheKey' | 'sizeBytes' | 'hitCount' | 'createdAt';
  sortDir?: 'asc' | 'desc';
  cacheType?: string;
  sizeBytes?: string;
  hitCount?: string;
  limit?: number;
};

const SORT_FIELDS = new Set<CacheEntriesListQuery['sortBy']>([
  'cacheKey',
  'sizeBytes',
  'hitCount',
  'createdAt',
]);

function parseSortDir(raw: unknown): 'asc' | 'desc' | undefined {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'asc') return 'asc';
  if (value === 'desc') return 'desc';
  return undefined;
}

function formatCacheSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function matchesTextFilter(value: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return value.toLowerCase().includes(needle);
}

function resolveListLimit(raw: unknown): number {
  const limitRaw = Number(raw);
  if (!Number.isFinite(limitRaw) || limitRaw <= 0) {
    return CACHE_ENTRIES_LIST_MAX;
  }
  return Math.min(Math.floor(limitRaw), CACHE_ENTRIES_LIST_MAX);
}

export function parseCacheEntriesListQuery(raw: Record<string, unknown>): CacheEntriesListQuery {
  const sortBy = String(raw.sortBy ?? '').trim();
  const sortDir = parseSortDir(raw.sortDir ?? raw.sortDirection);

  return {
    sortBy: SORT_FIELDS.has(sortBy as CacheEntriesListQuery['sortBy'])
      ? sortBy as CacheEntriesListQuery['sortBy']
      : undefined,
    sortDir,
    cacheType: String(raw.cacheType ?? raw.cache_type ?? '').trim() || undefined,
    sizeBytes: String(raw.sizeBytes ?? raw.size_bytes ?? '').trim() || undefined,
    hitCount: String(raw.hitCount ?? raw.hit_count ?? '').trim() || undefined,
    limit: resolveListLimit(raw.limit),
  };
}

export function mapGridQueryToCacheEntriesListQuery(query: GridQueryState): CacheEntriesListQuery {
  const params: CacheEntriesListQuery = {};

  if (query.sort) {
    params.sortBy = query.sort.columnId as CacheEntriesListQuery['sortBy'];
    params.sortDir = query.sort.direction;
  }

  for (const [columnId, filter] of Object.entries(query.filters)) {
    if (filter.type !== 'text') {
      continue;
    }
    if (columnId === 'cacheType') params.cacheType = filter.value;
    if (columnId === 'sizeBytes') params.sizeBytes = filter.value;
    if (columnId === 'hitCount') params.hitCount = filter.value;
  }

  return params;
}

export function appendCacheEntriesListParams(
  searchParams: URLSearchParams,
  query: CacheEntriesListQuery,
) {
  if (query.sortBy) searchParams.set('sortBy', query.sortBy);
  if (query.sortDir) searchParams.set('sortDir', query.sortDir);
  if (query.cacheType?.trim()) searchParams.set('cacheType', query.cacheType.trim());
  if (query.sizeBytes?.trim()) searchParams.set('sizeBytes', query.sizeBytes.trim());
  if (query.hitCount?.trim()) searchParams.set('hitCount', query.hitCount.trim());
  if (query.limit && query.limit !== CACHE_ENTRIES_LIST_MAX) {
    searchParams.set('limit', String(query.limit));
  }
}

export function applyCacheEntriesListQuery(
  items: ReadonlyArray<CacheEntryRecord>,
  query: CacheEntriesListQuery,
): CacheEntryRecord[] {
  let result = [...items];

  if (query.cacheType?.trim()) {
    result = result.filter((item) => matchesTextFilter(item.cacheType, query.cacheType!));
  }

  if (query.sizeBytes?.trim()) {
    result = result.filter((item) => (
      matchesTextFilter(String(item.sizeBytes), query.sizeBytes!)
      || matchesTextFilter(formatCacheSize(item.sizeBytes), query.sizeBytes!)
    ));
  }

  if (query.hitCount?.trim()) {
    result = result.filter((item) => (
      matchesTextFilter(String(item.hitCount), query.hitCount!)
      || matchesTextFilter(item.hitCount.toLocaleString(), query.hitCount!)
    ));
  }

  const sortBy = query.sortBy ?? 'cacheKey';
  const sortDir = query.sortDir ?? 'asc';
  const direction = sortDir === 'asc' ? 1 : -1;

  result.sort((left, right) => {
    if (sortBy === 'cacheKey') {
      return direction * String(left.cacheKey).localeCompare(String(right.cacheKey));
    }
    if (sortBy === 'sizeBytes') {
      return direction * (left.sizeBytes - right.sizeBytes);
    }
    if (sortBy === 'hitCount') {
      return direction * (left.hitCount - right.hitCount);
    }
    return direction * String(left.createdAt).localeCompare(String(right.createdAt));
  });

  const limit = resolveListLimit(query.limit);
  return result.slice(0, limit);
}
