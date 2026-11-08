import { cacheManager } from '../../../../../core/cache/CacheManager';
import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';

export const LIST_CACHE_KEYS_TOOL_NAME = 'list_cache_keys';
export const GET_CACHE_ENTRY_TOOL_NAME = 'get_cache_entry';
export const EVICT_CACHE_KEY_TOOL_NAME = 'evict_cache_key';

export const executeListCacheKeys = async (args: Record<string, unknown>) => {
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 500);
  const search = typeof args.search === 'string' ? args.search.trim().toLowerCase() : '';

  const items = await cacheManager.listEntries();
  const filtered = search
    ? items.filter((item) => item.cacheKey.toLowerCase().includes(search))
    : items;
  const slice = filtered.slice(0, limit);

  return {
    ok: true as const,
    summary: `Listed ${slice.length} cache key(s).`,
    data: {
      items: slice,
      totalCount: filtered.length,
      truncated: filtered.length > slice.length,
    },
  };
};

export const executeGetCacheEntry = async (args: Record<string, unknown>) => {
  const key = typeof args.key === 'string' ? args.key.trim() : '';
  if (!key) {
    return {
      ok: false as const,
      summary: 'key is required.',
      error: 'missing_key',
    };
  }

  const entry = await cacheManager.getEntry(key);
  if (!entry) {
    return {
      ok: false as const,
      summary: `Cache key "${key}" was not found.`,
      error: 'cache_key_not_found',
    };
  }

  return {
    ok: true as const,
    summary: `Loaded cache entry "${key}".`,
    data: { entry },
  };
};

export const executeEvictCacheKey = async (args: Record<string, unknown>) => {
  const key = typeof args.key === 'string' ? args.key.trim() : '';
  if (!key) {
    return {
      ok: false as const,
      summary: 'key is required.',
      error: 'missing_key',
    };
  }

  const deleted = await cacheManager.deleteKey(key);
  if (!deleted) {
    return {
      ok: false as const,
      summary: `Cache key "${key}" was not found.`,
      error: 'cache_key_not_found',
    };
  }

  return {
    ok: true as const,
    summary: `Evicted cache key "${key}".`,
    data: { key },
  };
};

export const createCacheTools = (): NativeToolDefinition[] => [
  {
    name: LIST_CACHE_KEYS_TOOL_NAME,
    description: 'List cache keys with optional search filter (admin inspection).',
    group: 'cache',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows (1–500, default 50).' },
        search: { type: 'string', description: 'Optional substring filter on cache keys.' },
      },
    },
    execute: async (args) => executeListCacheKeys(args),
  },
  {
    name: GET_CACHE_ENTRY_TOOL_NAME,
    description: 'Load a single cache entry by key.',
    group: 'cache',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Cache key from list_cache_keys.' },
      },
      required: ['key'],
    },
    execute: async (args) => executeGetCacheEntry(args),
  },
  {
    name: EVICT_CACHE_KEY_TOOL_NAME,
    description: 'Delete a single cache key (requires user confirm in Agent apply flow).',
    group: 'cache',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Cache key to evict.' },
      },
      required: ['key'],
    },
    execute: async (args) => executeEvictCacheKey(args),
  },
];
