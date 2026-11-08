// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  getBindingsForMount,
  getRouteBindingById,
  resolveShellRuleForPath,
} from '../platformConfigHelpers';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  PLATFORM_PORTALS_PAGE_KEY,
  PLATFORM_PORTALS_ROUTE_PATTERN,
} from '../../../shared/api/contracts/platform/studioPageSeeds';

const baseConfig = (): PlatformRuntimeConfig => ({
  version: 'seed-v1',
  navigations: [],
  mounts: [
    {
      id: 'studio',
      pathPrefix: '/studio',
      name: 'Studio',
      enabled: true,
      defaultRoute: '/studio',
      designerRoutePropagation: 'none',
      authProfile: { requireAuth: true },
    },
  ],
  shells: [
    {
      shellKey: 'admin',
      name: 'Admin Layout',
      entry: 'core:AdminLayout',
      surface: 'admin',
      enabled: true,
    },
  ],
  shellRules: [
    {
      id: 1,
      mountId: 'studio',
      pathPrefix: '/studio',
      shellKey: 'admin',
      priority: 0,
      enabled: true,
    },
  ],
  pageModules: [
    {
      pageKey: 'dashboard',
      title: 'Dashboard',
      loaderKind: 'core',
      loaderRef: 'core:Dashboard',
      enabled: true,
    },
  ],
  bindings: [
    {
      id: 1,
      mountId: 'studio',
      routePattern: '',
      pageKey: 'dashboard',
      enabled: true,
    },
  ],
});

describe('platform registry invalidation integration', () => {
  it('reflects added route bindings when runtime config version changes', () => {
    const before = baseConfig();
    const after: PlatformRuntimeConfig = {
      ...before,
      version: 'seed-v2',
      bindings: [
        ...before.bindings,
        {
          id: 2,
          mountId: 'studio',
          routePattern: PLATFORM_PORTALS_ROUTE_PATTERN,
          pageKey: PLATFORM_PORTALS_PAGE_KEY,
          enabled: true,
          nav: { label: 'Portals', group: 'Development', order: 50 },
        },
      ],
      pageModules: [
        ...before.pageModules,
        {
          pageKey: PLATFORM_PORTALS_PAGE_KEY,
          title: 'Portals',
          loaderKind: 'core',
          loaderRef: 'core:PlatformPortals',
          defaultRoles: ['ADMIN'],
          enabled: true,
        },
      ],
    };

    expect(getBindingsForMount(before, 'studio')).toHaveLength(1);
    expect(getBindingsForMount(after, 'studio')).toHaveLength(2);
    expect(after.version).not.toBe(before.version);
    expect(
      getBindingsForMount(after, 'studio').some(
        (binding) => binding.routePattern === PLATFORM_PORTALS_ROUTE_PATTERN,
      ),
    ).toBe(true);
  });

  it('resolves updated shell rules from refreshed runtime config', () => {
    const before = baseConfig();
    const after: PlatformRuntimeConfig = {
      ...before,
      version: 'seed-v3',
      shells: [
        ...before.shells,
        {
          shellKey: 'designer',
          name: 'Designer Shell',
          entry: 'core:DesignerShell',
          surface: 'designer',
          enabled: true,
        },
      ],
      shellRules: [
        ...before.shellRules,
        {
          id: 2,
          mountId: 'studio',
          pathPrefix: '/studio/design-preview',
          shellKey: 'designer',
          priority: 10,
          enabled: true,
        },
      ],
    };

    expect(resolveShellRuleForPath(before, 'studio', '/studio/client-components')?.shellKey).toBe('admin');
    expect(resolveShellRuleForPath(after, 'studio', '/studio/design-preview')?.shellKey).toBe('designer');
  });

  it('reads live binding auth/nav from config by binding id', () => {
    const config: PlatformRuntimeConfig = {
      ...baseConfig(),
      bindings: [
        {
          id: 10,
          mountId: 'studio',
          routePattern: 'users',
          pageKey: 'users',
          enabled: true,
          auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        },
      ],
    };

    const staleBinding = {
      id: 10,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
      auth: { accessMode: 'specific', allowRoles: ['USER'], allowUsers: [], denyRoles: [], denyUsers: [] },
    };

    expect(getRouteBindingById(config, 10)?.auth?.roles).toEqual(['ADMIN']);
    expect(getRouteBindingById(config, staleBinding.id)?.auth?.roles).not.toEqual(
      staleBinding.auth?.roles,
    );
  });
});
