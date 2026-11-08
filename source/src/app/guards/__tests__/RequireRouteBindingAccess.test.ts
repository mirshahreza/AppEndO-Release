import { describe, expect, it } from 'vitest';
import { resolveRouteBindingGateAuth } from '../RequireRouteBindingAccess';
import { canAccessRouteBinding } from '../roleAccess';
import type { PlatformPageModule, PlatformRouteBinding } from '../../../shared/api/contracts/platform/types';

const binding = (auth: PlatformRouteBinding['auth']): PlatformRouteBinding => ({
  id: 1,
  mountId: 'ir',
  routePattern: 'secure-page',
  pageKey: 'secure-page',
  enabled: true,
  auth,
});

describe('RequireRouteBindingAccess helpers', () => {
  it('uses full FunctionAccessControl auth on route bindings', () => {
    const route = binding({
      accessMode: 'specific',
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });

    expect(canAccessRouteBinding(route, { roles: ['ADMIN'] })).toBe(true);
    expect(canAccessRouteBinding(route, { roles: ['USER'] })).toBe(false);
  });

  it('falls back to page module defaultRoles when binding auth is missing', () => {
    const pageModule: PlatformPageModule = {
      pageKey: 'secure-page',
      title: 'Secure',
      loaderKind: 'designer',
      loaderRef: 'general/secure-page',
      defaultRoles: ['EDITOR'],
      enabled: true,
    };

    const auth = resolveRouteBindingGateAuth(binding(null), pageModule);
    expect(canAccessRouteBinding({ ...binding(null), auth }, { roles: ['EDITOR'] })).toBe(true);
    expect(canAccessRouteBinding({ ...binding(null), auth }, { roles: ['USER'] })).toBe(false);
  });

  it('requires authentication for authenticated access mode', () => {
    const route = binding({
      accessMode: 'authenticated',
      allowRoles: [],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });

    expect(canAccessRouteBinding(route, null)).toBe(false);
    expect(canAccessRouteBinding(route, { roles: ['USER'] })).toBe(true);
  });
});
