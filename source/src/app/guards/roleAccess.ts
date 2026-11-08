import { buildMountAbsolutePath, getBindingsForMount } from '../platform/platformConfigHelpers';
import type {
  PlatformRouteBinding,
  PlatformRouteBindingAuth,
  PlatformRuntimeConfig,
} from '../../shared/api/contracts/platform/types';
import {
  canAccessManagedFunction,
  type ManagedFunctionAccessPrincipal,
} from '../../shared/api/contracts/server-functions/accessControl';
import { formatAccessControlLabel } from '../../shared/api/contracts/server-functions/accessControl';
import { parsePlatformRouteBindingAuth } from '../../shared/api/contracts/platform/platformAccessControl';

export type AuthUserLike = {
  role?: string;
  roles?: string[];
} | null | undefined;

export const ALL_ROLES_WILDCARD = '*';

export const normalizeRole = (role: string) => String(role || '').trim().toUpperCase();

function authUserToPrincipal(user: AuthUserLike): ManagedFunctionAccessPrincipal {
  const roles = new Set<string>();
  for (const role of user?.roles ?? []) {
    const normalized = normalizeRole(String(role));
    if (normalized) {
      roles.add(normalized);
    }
  }
  if (user?.role) {
    const normalized = normalizeRole(user.role);
    if (normalized) {
      roles.add(normalized);
    }
  }

  return {
    isAuthenticated: Boolean(user),
    isAdmin: isAdminUser(user),
    roles: [...roles],
  };
}

export function formatAuthRolesLabel(auth?: PlatformRouteBindingAuth | null): string {
  return formatAccessControlLabel(parsePlatformRouteBindingAuth(auth));
}

export function normalizeAuthRoles(auth?: PlatformRouteBindingAuth | null): string[] | null {
  const acl = parsePlatformRouteBindingAuth(auth);
  if (acl.allowRoles.length === 0) {
    return null;
  }
  return acl.allowRoles;
}

export const hasRequiredRole = (
  user: AuthUserLike,
  requiredRoles: string[],
): boolean => {
  if (!user || requiredRoles.length === 0) return false;

  const required = new Set(requiredRoles.map(normalizeRole));
  const assigned = new Set(
    (user.roles ?? []).map((role) => normalizeRole(String(role))),
  );

  if (user.role) {
    assigned.add(normalizeRole(user.role));
  }

  for (const role of required) {
    if (assigned.has(role)) return true;
  }

  return false;
};

export const isAdminUser = (user: AuthUserLike) => hasRequiredRole(user, ['ADMIN']);

export const canSelfDeleteAccount = (user: AuthUserLike) =>
  !hasRequiredRole(user, ['ADMIN', 'DEVELOPER']);

export function canAccessPortalAuth(
  auth: PlatformRouteBindingAuth | null | undefined,
  currentUser: AuthUserLike,
): boolean {
  return canAccessManagedFunction(
    authUserToPrincipal(currentUser),
    parsePlatformRouteBindingAuth(auth),
  );
}

export function canAccessRouteBinding(
  binding: PlatformRouteBinding,
  currentUser: AuthUserLike,
): boolean {
  return canAccessPortalAuth(binding.auth, currentUser);
}

export function findRouteBindingByAbsolutePath(
  config: PlatformRuntimeConfig,
  mountId: string,
  mountPathPrefix: string,
  absolutePath: string,
): PlatformRouteBinding | undefined {
  return getBindingsForMount(config, mountId).find(
    (binding) => buildMountAbsolutePath(mountPathPrefix, binding.routePattern) === absolutePath,
  );
}

export function isRoleRestrictedNavPath(
  config: PlatformRuntimeConfig,
  mountId: string,
  mountPathPrefix: string,
  absolutePath: string,
  currentUser: AuthUserLike,
): boolean {
  const binding = findRouteBindingByAbsolutePath(config, mountId, mountPathPrefix, absolutePath);
  if (!binding) {
    return false;
  }

  return !canAccessRouteBinding(binding, currentUser);
}
