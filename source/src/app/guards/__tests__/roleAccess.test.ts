import { describe, expect, it } from 'vitest';
import { studioPath } from '../../platform/studioPaths';
import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  type FunctionAccessControl,
} from '../../../shared/api/contracts/server-functions/accessControl';
import type { PlatformRouteBindingAuth, PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  canAccessPortalAuth,
  canAccessRouteBinding,
  canSelfDeleteAccount,
  findRouteBindingByAbsolutePath,
  hasRequiredRole,
  isAdminUser,
  isRoleRestrictedNavPath,
} from '../roleAccess';

const adminOnlyAuth: FunctionAccessControl = {
  accessMode: 'specific',
  allowRoles: ['ADMIN'],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

function buildStudioConfig(bindings: PlatformRuntimeConfig['bindings']): PlatformRuntimeConfig {
  return {
    version: 'test-v1',
    mounts: [
      {
        id: 'studio',
        pathPrefix: '/studio',
        name: 'Studio',
        enabled: true,
        defaultRoute: '/studio',
        designerRoutePropagation: 'none',
        authProfile: {},
      },
    ],
    shells: [],
    shellRules: [],
    pageModules: [],
    bindings,
    navigations: [],
  };
}

describe('roleAccess', () => {
  it('treats ADMIN in roles array as admin', () => {
    expect(hasRequiredRole({ role: 'USER', roles: ['USER', 'ADMIN'] }, ['ADMIN'])).toBe(true);
    expect(isAdminUser({ role: 'USER', roles: ['ADMIN'] })).toBe(true);
  });

  it('treats primary role field as admin when set to ADMIN', () => {
    expect(hasRequiredRole({ role: 'ADMIN', roles: [] }, ['ADMIN'])).toBe(true);
  });

  it('denies non-admin users for admin routes', () => {
    expect(hasRequiredRole({ role: 'USER', roles: ['USER'] }, ['ADMIN'])).toBe(false);
    expect(isAdminUser({ role: 'USER', roles: ['USER'] })).toBe(false);
  });

  it('marks admin-only navigation paths from route binding auth', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: 'users',
        pageKey: 'users',
        enabled: true,
        auth: adminOnlyAuth,
      },
      {
        id: 2,
        mountId: 'studio',
        routePattern: 'base-info',
        pageKey: 'base-info',
        enabled: true,
      },
    ]);

    expect(
      isRoleRestrictedNavPath(config, 'studio', '/studio', studioPath('users'), { roles: ['USER'] }),
    ).toBe(true);
    expect(
      isRoleRestrictedNavPath(config, 'studio', '/studio', studioPath('base-info'), { roles: ['USER'] }),
    ).toBe(false);
    expect(
      findRouteBindingByAbsolutePath(config, 'studio', '/studio', studioPath('users'))?.pageKey,
    ).toBe('users');
  });

  it('evaluates route binding access from auth roles', () => {
    const binding = {
      id: 1,
      mountId: 'studio',
      routePattern: 'server-functions',
      pageKey: 'server-functions',
      enabled: true,
      auth: adminOnlyAuth,
    };

    expect(canAccessRouteBinding(binding, { roles: ['ADMIN'] })).toBe(true);
    expect(canAccessRouteBinding(binding, { roles: ['USER'] })).toBe(false);
    expect(canAccessRouteBinding({ ...binding, auth: null }, { roles: ['USER'] })).toBe(true);
    expect(canAccessRouteBinding({
      ...binding,
      auth: AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
    }, { roles: ['USER'] })).toBe(true);
  });

  it('evaluates application auth by access mode', () => {
    expect(canAccessPortalAuth(null, null)).toBe(true);
    expect(canAccessPortalAuth(null, { roles: ['USER'] })).toBe(true);
    expect(canAccessPortalAuth(AUTHENTICATED_FUNCTION_ACCESS_CONTROL, null)).toBe(false);
    expect(canAccessPortalAuth(AUTHENTICATED_FUNCTION_ACCESS_CONTROL, { roles: ['USER'] })).toBe(true);
    expect(canAccessPortalAuth(adminOnlyAuth, { roles: ['USER'] })).toBe(false);
    expect(canAccessPortalAuth(adminOnlyAuth, { roles: ['ADMIN'] })).toBe(true);
  });

  it('parses canonical function access control payloads', () => {
    const legacyAuthenticated = { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] } as PlatformRouteBindingAuth;
    const legacyAdminOnly = { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] } as PlatformRouteBindingAuth;

    expect(canAccessPortalAuth(legacyAuthenticated, null)).toBe(false);
    expect(canAccessPortalAuth(legacyAuthenticated, { roles: ['USER'] })).toBe(true);
    expect(canAccessPortalAuth(legacyAdminOnly, { roles: ['USER'] })).toBe(false);
    expect(canAccessPortalAuth(legacyAdminOnly, { roles: ['ADMIN'] })).toBe(true);
  });

  it('blocks self-delete for ADMIN and DEVELOPER roles', () => {
    expect(canSelfDeleteAccount({ role: 'ADMIN', roles: ['ADMIN'] })).toBe(false);
    expect(canSelfDeleteAccount({ role: 'DEVELOPER', roles: ['DEVELOPER'] })).toBe(false);
    expect(canSelfDeleteAccount({ role: 'USER', roles: ['USER', 'ADMIN'] })).toBe(false);
  });

  it('allows self-delete for regular users', () => {
    expect(canSelfDeleteAccount({ role: 'USER', roles: ['USER'] })).toBe(true);
    expect(canSelfDeleteAccount(null)).toBe(true);
  });
});
