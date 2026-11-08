import { cacheManager } from '../../../core/cache/CacheManager';
import { logger } from '../../../core/logging/Logger';
import {
  buildPlatformCacheKey,
  ROLE_ATTRIBUTES_CACHE_PREFIX,
} from '../../../shared/lib/cacheKeyFormat';
import { listRoleRows } from '../../domain/users/roleRepository';
import {
  listRoleAttributeRows,
  type SettingsAttributeWithValueRow,
} from '../../domain/attributes/valueRepository';
import { normalizeRoleName } from '../../domain/users/roleUtils';

export { ROLE_ATTRIBUTES_CACHE_PREFIX };
export const ROLE_ATTRIBUTES_TTL_SECONDS = 86_400;

export type CachedRoleAttributes = SettingsAttributeWithValueRow[];

export const roleAttributesCacheKey = (roleName: string): string =>
  buildPlatformCacheKey('role', 'attrs', normalizeRoleName(roleName));

export async function getCachedRoleAttributes(roleName: string): Promise<CachedRoleAttributes | null> {
  return cacheManager.get<CachedRoleAttributes>(roleAttributesCacheKey(roleName));
}

export async function setCachedRoleAttributes(
  roleName: string,
  rows: CachedRoleAttributes,
): Promise<void> {
  await cacheManager.set(roleAttributesCacheKey(roleName), rows, ROLE_ATTRIBUTES_TTL_SECONDS);
}

export async function invalidateRoleAttributes(roleName: string): Promise<void> {
  await cacheManager.invalidate(roleAttributesCacheKey(roleName));
}

export async function invalidateAllRoleAttributes(): Promise<void> {
  const roles = await listRoleRows();
  await Promise.all(roles.map((role) => invalidateRoleAttributes(role.name)));
}

export async function refreshRoleAttributesCache(roleName: string): Promise<CachedRoleAttributes> {
  const rows = await listRoleAttributeRows(roleName);
  await setCachedRoleAttributes(roleName, rows);
  return rows;
}

export async function getRoleAttributeRows(roleName: string): Promise<CachedRoleAttributes> {
  const cached = await getCachedRoleAttributes(roleName);
  if (cached) {
    return cached;
  }

  return refreshRoleAttributesCache(roleName);
}

export async function preloadAllRoleAttributesCache(): Promise<void> {
  const roles = await listRoleRows();
  await Promise.all(roles.map((role) => refreshRoleAttributesCache(role.name)));
}

let backgroundWarmPromise: Promise<void> | null = null;

/** Non-blocking warm-up for all roles — safe to call after listen. */
export function warmRoleAttributesCacheInBackground(): void {
  if (backgroundWarmPromise) {
    return;
  }

  backgroundWarmPromise = (async () => {
    try {
      await preloadAllRoleAttributesCache();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Server', `Role attribute cache background warm failed: ${message}`);
    }
  })().finally(() => {
    backgroundWarmPromise = null;
  });
}
