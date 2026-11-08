import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cacheManager } from '../CacheManager';
import { DEFAULT_CACHE_SETTINGS } from '../../../shared/api/contracts/cache/constants';
import {
  ROLE_ATTRIBUTES_CACHE_PREFIX,
  SESSION_CONTEXT_CACHE_PREFIX,
  USER_ROLES_CACHE_PREFIX,
  buildPlatformCacheKey,
} from '../../../shared/lib/cacheKeyFormat';

describe('CacheManager.invalidateByPrefix', () => {
  beforeEach(async () => {
    await cacheManager.loadSettings(DEFAULT_CACHE_SETTINGS);
    await cacheManager.clearAll();
  });

  afterEach(async () => {
    await cacheManager.clearAll();
  });

  it('invalidates session/role/user keys when prefix already ends with ":"', async () => {
    const sessionKey = buildPlatformCacheKey('session', 'ctx3', 42);
    const roleKey = buildPlatformCacheKey('role', 'attrs', 'AGENT');
    const userRolesKey = buildPlatformCacheKey('user', 'role', 7);

    await cacheManager.set(sessionKey, { ok: true }, 60);
    await cacheManager.set(roleKey, [{ key: 'city' }], 60);
    await cacheManager.set(userRolesKey, ['ADMIN'], 60);
    await cacheManager.set('edge---:GET-:/api/items', { cached: true }, 60);

    expect(await cacheManager.invalidateByPrefix(SESSION_CONTEXT_CACHE_PREFIX)).toBe(1);
    expect(await cacheManager.get(sessionKey)).toBeNull();

    expect(await cacheManager.invalidateByPrefix(ROLE_ATTRIBUTES_CACHE_PREFIX)).toBe(1);
    expect(await cacheManager.get(roleKey)).toBeNull();

    expect(await cacheManager.invalidateByPrefix(USER_ROLES_CACHE_PREFIX)).toBe(1);
    expect(await cacheManager.get(userRolesKey)).toBeNull();

    expect(await cacheManager.get('edge---:GET-:/api/items')).toEqual({ cached: true });
  });

  it('still matches edge base keys and scoped variants without trailing ":"', async () => {
    const baseKey = 'edge---:GET-:/api/items';
    const scopedKey = `${baseKey}:abcd1234--`;
    await cacheManager.set(baseKey, { base: true }, 60);
    await cacheManager.set(scopedKey, { scoped: true }, 60);
    await cacheManager.set('edge---:POST:/api/items', { other: true }, 60);

    expect(await cacheManager.invalidateByPrefix(baseKey)).toBe(2);
    expect(await cacheManager.get(baseKey)).toBeNull();
    expect(await cacheManager.get(scopedKey)).toBeNull();
    expect(await cacheManager.get('edge---:POST:/api/items')).toEqual({ other: true });
  });
});
