import { cacheManager } from '../../../core/cache/CacheManager';
import {
  buildPlatformCacheKey,
  SESSION_CONTEXT_CACHE_PREFIX,
} from '../../../shared/lib/cacheKeyFormat';

export { SESSION_CONTEXT_CACHE_PREFIX };
export const SESSION_CONTEXT_TTL_SECONDS = 86_400;

export type CachedSessionContext = {
  serverContext: Record<string, unknown>;
  clientContext: Record<string, unknown>;
};

export const sessionContextCacheKey = (userId: number): string =>
  buildPlatformCacheKey('session', 'ctx3', userId);

export async function getCachedSessionContext(userId: number): Promise<CachedSessionContext | null> {
  return cacheManager.get<CachedSessionContext>(sessionContextCacheKey(userId));
}

export async function setCachedSessionContext(
  userId: number,
  payload: CachedSessionContext,
): Promise<void> {
  await cacheManager.set(sessionContextCacheKey(userId), payload, SESSION_CONTEXT_TTL_SECONDS);
}

export async function invalidateSessionContext(userId: number): Promise<void> {
  await cacheManager.invalidate(sessionContextCacheKey(userId));
}

export async function invalidateSessionContextForUsers(userIds: number[]): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  await Promise.all(uniqueIds.map((userId) => invalidateSessionContext(userId)));
}

export async function invalidateAllSessionContexts(): Promise<void> {
  await cacheManager.invalidateByPrefix(SESSION_CONTEXT_CACHE_PREFIX);
}
