import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeEvictCacheKey,
  executeGetCacheEntry,
  executeListCacheKeys,
  EVICT_CACHE_KEY_TOOL_NAME,
  GET_CACHE_ENTRY_TOOL_NAME,
  LIST_CACHE_KEYS_TOOL_NAME,
} from '../cacheTools';

const mockEntries = [
  {
    cacheKey: 'users:1',
    cacheType: 'memory',
    sizeBytes: 12,
    hitCount: 2,
    createdAt: '2026-06-16T00:00:00.000Z',
  },
];

vi.mock('../../../../../../core/cache/CacheManager', () => ({
  cacheManager: {
    listEntries: vi.fn(async () => mockEntries),
    getEntry: vi.fn(async (key: string) => (
      key === 'users:1'
        ? { ...mockEntries[0], value: { id: 1 } }
        : null
    )),
    deleteKey: vi.fn(async (key: string) => key === 'users:1'),
  },
}));

describe('appendo-cache pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers cache pack tools', () => {
    const registry = createPhase1ToolRegistry('agent', ['cache']);
    registerBuiltinCapabilityPacks(registry, ['appendo-cache']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-cache').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('lists cache keys', async () => {
    const result = await executeListCacheKeys({ limit: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.totalCount).toBe(1);
    }
  });

  it('loads a cache entry', async () => {
    const result = await executeGetCacheEntry({ key: 'users:1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.entry.cacheKey).toBe('users:1');
    }
  });

  it('evicts a cache key', async () => {
    const result = await executeEvictCacheKey({ key: 'users:1' });
    expect(result.ok).toBe(true);
  });

  it('exposes catalog tool names', () => {
    expect(LIST_CACHE_KEYS_TOOL_NAME).toBe('list_cache_keys');
    expect(GET_CACHE_ENTRY_TOOL_NAME).toBe('get_cache_entry');
    expect(EVICT_CACHE_KEY_TOOL_NAME).toBe('evict_cache_key');
  });
});
