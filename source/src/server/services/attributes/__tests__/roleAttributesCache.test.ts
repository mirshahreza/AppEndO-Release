import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../core/cache/CacheManager', () => ({
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}));

vi.mock('../../../domain/users/roleRepository', () => ({
  listRoleRows: vi.fn(),
}));

vi.mock('../../../domain/attributes/valueRepository', () => ({
  listRoleAttributeRows: vi.fn(),
}));

import { cacheManager } from '../../../../core/cache/CacheManager';
import { listRoleAttributeRows } from '../../../domain/attributes/valueRepository';
import { listRoleRows } from '../../../domain/users/roleRepository';
import { buildPlatformCacheKey } from '../../../../shared/lib/cacheKeyFormat';
import {
  getRoleAttributeRows,
  invalidateRoleAttributes,
  preloadAllRoleAttributesCache,
  roleAttributesCacheKey,
  warmRoleAttributesCacheInBackground,
} from '../roleAttributesCache';

describe('roleAttributesCache', () => {
  const agentCacheKey = buildPlatformCacheKey('role', 'attrs', 'AGENT');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds cache keys as role:attrs:{roleName}', () => {
    expect(roleAttributesCacheKey('agent')).toBe(agentCacheKey);
  });

  it('returns cached role rows without querying the database', async () => {
    const cachedRows = [{ id: 1, key: 'region', value_text: '"north"' }];
    vi.mocked(cacheManager.get).mockResolvedValue(cachedRows as never);

    const rows = await getRoleAttributeRows('AGENT');

    expect(rows).toEqual(cachedRows);
    expect(listRoleAttributeRows).not.toHaveBeenCalled();
  });

  it('loads and caches role rows on cache miss', async () => {
    const dbRows = [{ id: 2, key: 'city', value_text: '"103.5"' }];
    vi.mocked(cacheManager.get).mockResolvedValue(null);
    vi.mocked(listRoleAttributeRows).mockResolvedValue(dbRows as never);

    const rows = await getRoleAttributeRows('AGENT');

    expect(rows).toEqual(dbRows);
    expect(cacheManager.set).toHaveBeenCalledWith(agentCacheKey, dbRows, 86_400);
  });

  it('preloads all roles when explicitly warmed', async () => {
    vi.mocked(listRoleRows).mockResolvedValue([
      { id: 1, name: 'ADMIN' },
      { id: 2, name: 'AGENT' },
    ] as never);
    vi.mocked(listRoleAttributeRows).mockResolvedValue([]);

    await preloadAllRoleAttributesCache();

    expect(listRoleAttributeRows).toHaveBeenCalledWith('ADMIN');
    expect(listRoleAttributeRows).toHaveBeenCalledWith('AGENT');
    expect(cacheManager.set).toHaveBeenCalledTimes(2);
  });

  it('invalidates a single role cache entry', async () => {
    await invalidateRoleAttributes('agent');

    expect(cacheManager.invalidate).toHaveBeenCalledWith(agentCacheKey);
  });

  it('background warm preloads all roles without blocking callers', async () => {
    vi.mocked(listRoleRows).mockResolvedValue([{ id: 1, name: 'ADMIN' }] as never);
    vi.mocked(listRoleAttributeRows).mockResolvedValue([]);

    warmRoleAttributesCacheInBackground();
    warmRoleAttributesCacheInBackground();

    await vi.waitFor(() => {
      expect(listRoleAttributeRows).toHaveBeenCalledWith('ADMIN');
    });

    expect(listRoleRows).toHaveBeenCalledTimes(1);
  });
});
