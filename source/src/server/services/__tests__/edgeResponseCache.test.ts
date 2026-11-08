import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../core/cache/CacheManager', () => ({
  cacheManager: {
    invalidateByPrefix: vi.fn(),
  },
}));

import { buildEdgeResponseCacheKey } from '../../../shared/lib/cacheKeyFormat';
import { cacheManager } from '../../../core/cache/CacheManager';
import { invalidateEdgeResponseCache, invalidateUsersListEdgeCache } from '../edgeResponseCache';

describe('edgeResponseCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cacheManager.invalidateByPrefix).mockResolvedValue(2);
  });

  it('invalidates all cache keys for the edge route prefix', async () => {
    const prefix = buildEdgeResponseCacheKey({ keyNamespace: 'GET:/api/users' });

    await invalidateEdgeResponseCache('GET', '/api/users');

    expect(cacheManager.invalidateByPrefix).toHaveBeenCalledWith(prefix);
  });

  it('invalidates users list edge cache', async () => {
    const prefix = buildEdgeResponseCacheKey({ keyNamespace: 'GET:/api/users' });

    await invalidateUsersListEdgeCache();

    expect(cacheManager.invalidateByPrefix).toHaveBeenCalledWith(prefix);
  });
});
