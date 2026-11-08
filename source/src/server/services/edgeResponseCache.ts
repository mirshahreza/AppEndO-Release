import { cacheManager } from '../../core/cache/CacheManager';
import { buildEdgeResponseCacheKey } from '../../shared/lib/cacheKeyFormat';

export async function invalidateEdgeResponseCache(
  method: string,
  routePath: string,
): Promise<void> {
  const normalizedMethod = String(method || 'GET').trim().toUpperCase() || 'GET';
  const normalizedPath = String(routePath || '').trim() || '/';
  const prefix = buildEdgeResponseCacheKey({
    keyNamespace: `${normalizedMethod}:${normalizedPath}`,
  });

  await cacheManager.invalidateByPrefix(prefix);
}

export async function invalidateUsersListEdgeCache(): Promise<void> {
  await invalidateEdgeResponseCache('GET', '/api/users');
}
