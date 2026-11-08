import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../core/cache/CacheManager', () => ({
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}));

import { cacheManager } from '../../../../core/cache/CacheManager';
import { buildPlatformCacheKey } from '../../../../shared/lib/cacheKeyFormat';
import {
  getCachedUserRoles,
  invalidateUserRolesCache,
  setCachedUserRoles,
  userRolesCacheKey,
  USER_ROLES_TTL_SECONDS,
} from '../userRolesCache';

describe('userRolesCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds user---:role:{userId} keys', () => {
    expect(userRolesCacheKey(42)).toBe(buildPlatformCacheKey('user', 'role', 42));
  });

  it('reads and writes through CacheManager with 24h TTL', async () => {
    vi.mocked(cacheManager.get).mockResolvedValue(['ADMIN', 'USER']);

    await expect(getCachedUserRoles(42)).resolves.toEqual(['ADMIN', 'USER']);
    expect(cacheManager.get).toHaveBeenCalledWith(userRolesCacheKey(42));

    await setCachedUserRoles(7, ['DEVELOPER']);
    expect(cacheManager.set).toHaveBeenCalledWith(
      userRolesCacheKey(7),
      ['DEVELOPER'],
      USER_ROLES_TTL_SECONDS,
    );

    await invalidateUserRolesCache(7);
    expect(cacheManager.invalidate).toHaveBeenCalledWith(userRolesCacheKey(7));
  });
});
