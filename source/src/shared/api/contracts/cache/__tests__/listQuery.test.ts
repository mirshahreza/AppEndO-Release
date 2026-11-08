import { describe, expect, it } from 'vitest';
import type { CacheEntryRecord } from '../types';
import {
  applyCacheEntriesListQuery,
  CACHE_ENTRIES_LIST_MAX,
  mapGridQueryToCacheEntriesListQuery,
  parseCacheEntriesListQuery,
} from '../listQuery';

const sampleItems: CacheEntryRecord[] = [
  {
    cacheKey: 'alpha:key',
    cacheType: 'string',
    sizeBytes: 512,
    hitCount: 12,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    cacheKey: 'beta:key',
    cacheType: 'object',
    sizeBytes: 2048,
    hitCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('mapGridQueryToCacheEntriesListQuery', () => {
  it('maps server-side column filters and sort', () => {
    expect(mapGridQueryToCacheEntriesListQuery({
      sort: { columnId: 'hitCount', direction: 'desc' },
      filters: {
        cacheType: { type: 'text', value: 'obj' },
        sizeBytes: { type: 'text', value: '2.0 KB' },
        hitCount: { type: 'text', value: '3' },
      },
    })).toEqual({
      sortBy: 'hitCount',
      sortDir: 'desc',
      cacheType: 'obj',
      sizeBytes: '2.0 KB',
      hitCount: '3',
    });
  });
});

describe('applyCacheEntriesListQuery', () => {
  it('filters type, size, and hits on the server contract', () => {
    const result = applyCacheEntriesListQuery(sampleItems, {
      cacheType: 'object',
      sizeBytes: '2.0',
      hitCount: '3',
      sortBy: 'cacheKey',
      sortDir: 'asc',
    });

    expect(result).toEqual([sampleItems[1]]);
  });

  it('caps the payload even when the store has more keys than the list max', () => {
    const items = Array.from({ length: CACHE_ENTRIES_LIST_MAX + 25 }, (_, index) => ({
      cacheKey: `key:${String(index).padStart(4, '0')}`,
      cacheType: 'string',
      sizeBytes: 8,
      hitCount: index,
      createdAt: '2026-01-01T00:00:00.000Z',
    }));

    const result = applyCacheEntriesListQuery(items, { sortBy: 'cacheKey', sortDir: 'asc' });
    expect(result).toHaveLength(CACHE_ENTRIES_LIST_MAX);
    expect(parseCacheEntriesListQuery({}).limit).toBe(CACHE_ENTRIES_LIST_MAX);
    expect(parseCacheEntriesListQuery({ limit: 9_999 }).limit).toBe(CACHE_ENTRIES_LIST_MAX);
  });
});
