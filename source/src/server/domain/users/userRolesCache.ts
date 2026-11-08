import { cacheManager } from '../../../core/cache/CacheManager';
import {
  buildPlatformCacheKey,
  USER_ROLES_CACHE_PREFIX,
} from '../../../shared/lib/cacheKeyFormat';

export { USER_ROLES_CACHE_PREFIX };
export const USER_ROLES_TTL_SECONDS = 86_400;

export const userRolesCacheKey = (userId: number): string =>
  buildPlatformCacheKey('user', 'role', userId);

export async function getCachedUserRoles(userId: number): Promise<string[] | null> {
  return cacheManager.get<string[]>(userRolesCacheKey(userId));
}

export async function setCachedUserRoles(userId: number, roles: string[]): Promise<void> {
  await cacheManager.set(userRolesCacheKey(userId), roles, USER_ROLES_TTL_SECONDS);
}

export async function invalidateUserRolesCache(userId: number): Promise<void> {
  await cacheManager.invalidate(userRolesCacheKey(userId));
}

export async function invalidateUserRolesCacheForUsers(userIds: number[]): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  await Promise.all(uniqueIds.map((userId) => invalidateUserRolesCache(userId)));
}
