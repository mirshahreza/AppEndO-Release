// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import {
  getBindingsForMount,
  getPageModuleByKey,
  resolveRouteBindingForRelativePath,
  resolveShellRuleForPath,
} from '../platformConfigHelpers';
import { resolvePageModule, resolveShellComponent } from '../resolvers';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';

const studioRuntimeConfig: PlatformRuntimeConfig = {
  version: 'seed-v1',
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
    {
      shellKey: 'designer',
      name: 'Designer Shell',
      entry: 'core:DesignerShell',
      surface: 'designer',
      enabled: true,
    },
  ],
  shellRules: [
    {
      id: 1,
      mountId: 'studio',
      pathPrefix: '/studio/client-components',
      shellKey: 'designer',
      priority: 10,
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
    {
      pageKey: 'users',
      title: 'Users',
      loaderKind: 'core',
      loaderRef: 'core:Users',
      defaultRoles: ['ADMIN'],
      enabled: true,
    },
    {
      pageKey: 'client-components',
      title: 'Client Components',
      loaderKind: 'core',
      loaderRef: 'core:ComponentDesigner',
      defaultRoles: ['ADMIN'],
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
    {
      id: 2,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
      auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    },
    {
      id: 3,
      mountId: 'studio',
      routePattern: 'client-components',
      pageKey: 'client-components',
      enabled: true,
      auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    },
  ],
  navigations: [],
};

describe('platform route resolve integration', () => {
  it('resolves designer shell rule for /studio/client-components', () => {
    const configWithDesignerRule: PlatformRuntimeConfig = {
      ...studioRuntimeConfig,
      shellRules: [
        {
          id: 1,
          mountId: 'studio',
          pathPrefix: '/studio/client-components',
          shellKey: 'designer',
          priority: 10,
          enabled: true,
        },
      ],
    };

    expect(resolveShellRuleForPath(configWithDesignerRule, 'studio', '/studio/client-components')?.shellKey).toBe(
      'designer',
    );
    expect(resolveShellRuleForPath(configWithDesignerRule, 'studio', '/studio/users')).toBeUndefined();
  });

  it('maps route bindings to core page modules and resolvers', () => {
    const usersBinding = resolveRouteBindingForRelativePath(studioRuntimeConfig, 'studio', 'users');
    const usersPage = getPageModuleByKey(studioRuntimeConfig, usersBinding?.pageKey ?? '');
    const usersComponent = resolvePageModule(usersPage?.loaderRef ?? '');

    expect(usersBinding?.pageKey).toBe('users');
    expect(usersPage?.loaderRef).toBe('core:Users');
    expect(usersComponent?.component).toBeTruthy();
  });

  it('exposes all enabled studio bindings for mount routing', () => {
    const bindings = getBindingsForMount(studioRuntimeConfig, 'studio');
    expect(bindings).toHaveLength(3);
    expect(bindings.some((binding) => binding.routePattern === '')).toBe(true);
  });

  it('resolves shell layout components for admin and designer shells', () => {
    const adminShell = studioRuntimeConfig.shells.find((shell) => shell.shellKey === 'admin');
    const designerShell = studioRuntimeConfig.shells.find((shell) => shell.shellKey === 'designer');

    expect(resolveShellComponent(adminShell?.entry ?? '')).toBeTruthy();
    expect(resolveShellComponent(designerShell?.entry ?? '')).toBeTruthy();
  });
});

const experienceRuntimeConfig: PlatformRuntimeConfig = {
  version: 'experience-v1',
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
      pathPrefix: '/studio/client-components',
      shellKey: 'designer',
      priority: 10,
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
      nav: { label: 'Dashboard', icon: 'LayoutDashboard' },
    },
  ],
  navigations: [],
};

describe('culture route resolve integration', () => {
  beforeEach(() => {
    bootstrapCultureRegistry(['us', 'ir']);
  });

  it('resolves the same dashboard page module on ir and us culture routes', () => {
    const irBinding = resolveRouteBindingForRelativePath(experienceRuntimeConfig, 'ir', 'studio');
    const usBinding = resolveRouteBindingForRelativePath(experienceRuntimeConfig, 'us', 'studio');
    const dashboardPage = getPageModuleByKey(experienceRuntimeConfig, 'dashboard');

    expect(irBinding?.pageKey).toBe('dashboard');
    expect(usBinding?.pageKey).toBe('dashboard');
    expect(dashboardPage?.loaderRef).toBe('core:Dashboard');
    expect(resolvePageModule(dashboardPage?.loaderRef ?? '')?.component).toBeTruthy();
  });

  it('inherits studio designer shell rules for culture route ids', () => {
    expect(resolveShellRuleForPath(experienceRuntimeConfig, 'ir', '/ir/studio/client-components')?.shellKey).toBe('designer');
    expect(resolveShellRuleForPath(experienceRuntimeConfig, 'us', '/us/studio/client-components')?.shellKey).toBe('designer');
  });
});
