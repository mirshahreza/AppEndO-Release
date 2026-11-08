import { describe, expect, it } from 'vitest';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { buildNavigationManifestFromBindings } from '../../../shared/api/contracts/platform/navigation';
import {
  buildAdminShellNav,
  findAdminShellNavBreadcrumbTrail,
  findAdminShellNavItemByPath,
  findAdminShellNavItemContextByPath,
  flattenAdminShellNavItems,
  formatAdminShellHeaderTitle,
  resolveAdminShellHeaderContext,
} from '../buildAdminShellNav';

const STUDIO_MOUNT_PREFIX = '/studio';

function buildStudioConfig(bindings: PlatformRuntimeConfig['bindings']): PlatformRuntimeConfig {
  return {
    version: 'test-v1',
    mounts: [
      {
        id: 'studio',
        pathPrefix: STUDIO_MOUNT_PREFIX,
        name: 'Studio',
        enabled: true,
        defaultRoute: STUDIO_MOUNT_PREFIX,
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

describe('buildAdminShellNav', () => {
  it('builds grouped navigation from registry bindings', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: '',
        pageKey: 'dashboard',
        enabled: true,
        nav: {
          label: 'Dashboard',
          icon: 'LayoutDashboard',
          description: 'System overview and core metrics tracking.',
          color: 'text-indigo-500',
        },
      },
      {
        id: 2,
        mountId: 'studio',
        routePattern: 'server-functions',
        pageKey: 'server-functions',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Server Functions',
          icon: 'Code2',
          group: 'Development',
          order: 1,
          description: 'Write and execute server-side code dynamically in the Node.js sandbox.',
          color: 'text-emerald-500',
        },
      },
      {
        id: 3,
        mountId: 'studio',
        routePattern: 'plugins',
        pageKey: 'package-manager',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Plugins',
          icon: 'Puzzle',
          group: 'Development',
          order: 4,
          separatorBefore: true,
        },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    expect(groups[0]?.heading).toBeNull();
    expect(groups[0]?.items[0]).toMatchObject({
      label: 'Dashboard',
      path: '/studio',
      description: 'System overview and core metrics tracking.',
    });

    const development = groups.find((group) => group.heading === 'Development');
    const developmentLabels = development?.items
      .filter((item) => item.type !== 'separator')
      .map((item) => item.label);
    expect(developmentLabels).toEqual(['Server Functions', 'Plugins']);
    expect(findAdminShellNavItemByPath(groups, '/studio/server-functions')?.iconColor).toBe('text-emerald-500');
    expect(development?.items.some((item) => item.type === 'separator')).toBe(true);
  });

  it('resolves nested settings paths to the Settings nav item', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: 'settings/*',
        pageKey: 'settings',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Settings',
          icon: 'Settings',
          group: 'Operations',
          order: 1,
        },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    expect(findAdminShellNavItemByPath(groups, '/studio/settings/pwa')?.label).toBe('Settings');
    expect(findAdminShellNavItemContextByPath(groups, '/studio/settings/pwa')).toEqual({
      item: expect.objectContaining({ label: 'Settings' }),
      groupHeading: 'Ops',
    });
    expect(formatAdminShellHeaderTitle('Settings', 'Operations', 'Dashboard')).toBe('Operations / Settings');
    expect(groups[0]?.items[0]?.path).toBe('/studio/settings/server-functions');
  });

  it('filters admin-only bindings for non-admin users', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: '',
        pageKey: 'dashboard',
        enabled: true,
        nav: { label: 'Dashboard', icon: 'LayoutDashboard' },
      },
      {
        id: 2,
        mountId: 'studio',
        routePattern: 'server-functions',
        pageKey: 'server-functions',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: { label: 'Server Functions', icon: 'Code2', group: 'Development', order: 1 },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['USER'] },
    });

    const labels = groups.flatMap((group) =>
      group.items.filter((item) => item.type !== 'separator').map((item) => item.label),
    );

    expect(labels).toEqual(['Dashboard']);
  });

  it('includes package-owned bindings and marks them as package nav items', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: 'inventory/items',
        pageKey: 'inventory-items',
        enabled: true,
        ownerPackageId: 'inventory',
        ownerPluginVersion: '1.0.0',
        nav: { label: 'Inventory Items', icon: 'Database', group: 'Extensions', order: 1 },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    const extensionGroup = groups.find((group) => group.heading === 'Extensions');
    expect(extensionGroup?.items[0]).toMatchObject({
      label: 'Inventory Items',
      path: '/studio/inventory/items',
      isPlugin: true,
      isCore: false,
    });
  });

  it('returns empty navigation when registry has no navigable bindings', () => {
    const config = buildStudioConfig([]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    expect(groups).toEqual([]);
  });

  it('inherits studio navigation bindings for experience mounts', () => {
    const config: PlatformRuntimeConfig = {
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
        {
          id: 'ir',
          pathPrefix: '/ir',
          name: 'Iran',
          enabled: true,
          defaultRoute: '/ir',
          designerRoutePropagation: 'auto',
          authProfile: {},
          experienceConfig: {
            locale: 'fa-IR',
            calendar: 'jalali',
            direction: 'rtl',
          },
        },
      ],
      shells: [],
      shellRules: [],
      pageModules: [],
      navigations: [],
      bindings: [
        {
          id: 1,
          mountId: 'studio',
          routePattern: '',
          pageKey: 'dashboard',
          enabled: true,
          nav: { label: 'Dashboard', icon: 'LayoutDashboard' },
        },
        {
          id: 2,
          mountId: 'studio',
          routePattern: 'users',
          pageKey: 'users',
          enabled: true,
          auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
          nav: { label: 'Users', icon: 'Users', group: 'Records', order: 1 },
        },
      ],
    };

    const groups = buildAdminShellNav({
      config,
      mountId: 'ir',
      mountPathPrefix: '/ir',
      currentUser: { roles: ['ADMIN'] },
    });

    const labels = groups.flatMap((group) =>
      group.items.filter((item) => item.type !== 'separator').map((item) => item.label),
    );

    expect(labels).toEqual(['Dashboard', 'Users']);
    expect(findAdminShellNavItemByPath(groups, '/ir/studio')?.path).toBe('/ir/studio');
    expect(findAdminShellNavItemByPath(groups, '/ir/studio/users')?.path).toBe('/ir/studio/users');
    expect(labels.filter((label) => label === 'Dashboard')).toHaveLength(1);
  });

  it('builds navigation from an explicit manifest with binding fallback paths', () => {
    const bindings = [
      {
        id: 1,
        mountId: 'studio',
        routePattern: 'users',
        pageKey: 'users',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: { label: 'Users', icon: 'Users', group: 'Records', order: 1 },
      },
    ];
    const config = buildStudioConfig(bindings);
    const manifest = buildNavigationManifestFromBindings({ bindings, id: 'studio-nav' });

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
      manifest,
    });

    expect(groups[0]?.items[0]).toMatchObject({
      label: 'Users',
      path: '/studio/users',
    });
    expect(findAdminShellNavItemByPath(groups, '/studio/users')?.label).toBe('Users');
  });

  it('resolves nested sandbox paths to the Sandbox nav item on culture mounts', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: 'sandbox/*',
        pageKey: 'sandbox',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Sandbox',
          icon: 'tabler:IconSandbox',
          group: 'Development',
          order: 6,
        },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'us',
      mountPathPrefix: '/us',
      currentUser: { roles: ['ADMIN'] },
    });

    expect(findAdminShellNavItemByPath(groups, '/us/studio/sandbox/dialog')?.label).toBe('Sandbox');
    expect(findAdminShellNavItemContextByPath(groups, '/us/studio/sandbox/grid')).toEqual({
      item: expect.objectContaining({ label: 'Sandbox' }),
      groupHeading: 'Dev',
    });
  });

  it('points Base Components menu at the default catalog section', () => {
    const config = buildStudioConfig([
      {
        id: 24,
        mountId: 'studio',
        routePattern: 'base-components/*',
        pageKey: 'base-components',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Base Components',
          icon: 'tabler:IconComponents',
          group: 'Development',
          order: 5,
        },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    expect(findAdminShellNavItemByPath(groups, '/studio/base-components/crud-set')?.path).toBe(
      '/studio/base-components/crud-set',
    );
    expect(findAdminShellNavItemByPath(groups, '/studio/base-components/dialog')?.label).toBe('Base Components');
    expect(findAdminShellNavItemByPath(groups, '/studio/base-components')?.label).toBe('Base Components');
  });

  it('points Base Components menu at the default catalog section on culture mounts', () => {
    const config = buildStudioConfig([
      {
        id: 24,
        mountId: 'studio',
        routePattern: 'base-components/*',
        pageKey: 'base-components',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Base Components',
          icon: 'tabler:IconComponents',
          group: 'Development',
          order: 5,
        },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'us',
      mountPathPrefix: '/us',
      currentUser: { roles: ['ADMIN'] },
    });

    expect(findAdminShellNavItemByPath(groups, '/us/studio/base-components/crud-set')?.path).toBe(
      '/us/studio/base-components/crud-set',
    );
    expect(findAdminShellNavItemByPath(groups, '/us/studio/base-components/buttons')?.label).toBe(
      'Base Components',
    );
  });

  it('points Settings menu at the default catalog section', () => {
    const config = buildStudioConfig([
      {
        id: 7,
        mountId: 'studio',
        routePattern: 'settings/*',
        pageKey: 'settings',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Settings',
          icon: 'Settings',
          group: 'Operations',
          order: 10,
        },
      },
    ]);

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    expect(findAdminShellNavItemByPath(groups, '/studio/settings/server-functions')?.path).toBe(
      '/studio/settings/server-functions',
    );
    expect(findAdminShellNavItemByPath(groups, '/studio/settings/pwa')?.label).toBe('Settings');
    expect(findAdminShellNavItemByPath(groups, '/studio/settings')?.label).toBe('Settings');
  });

  it('builds breadcrumb trail from manifest group and item ancestry', () => {
    const bindings = [
      {
        id: 1,
        mountId: 'studio',
        routePattern: 'settings',
        pageKey: 'settings',
        enabled: true,
        nav: { label: 'Settings', icon: 'Settings', group: 'Operations', order: 1 },
      },
    ];
    const config = buildStudioConfig(bindings);
    const manifest = buildNavigationManifestFromBindings({ bindings, id: 'studio-nav' });

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
      manifest,
    });

    const trail = findAdminShellNavBreadcrumbTrail(groups, '/studio/settings');
    expect(trail.map((segment) => segment.label)).toEqual(['Ops', 'Settings']);
  });

  it('builds workflows list nav link and matches designer editor paths', () => {
    const bindings = [
      {
        id: 27,
        mountId: 'studio',
        routePattern: 'workflows',
        pageKey: 'workflows',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Workflows',
          icon: 'GitBranch',
          group: 'Operations',
          order: 8,
        },
      },
      {
        id: 31,
        mountId: 'studio',
        routePattern: 'workflows/edit/*',
        pageKey: 'workflows',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: null,
      },
    ];
    const config = buildStudioConfig(bindings);
    config.navigations = [{
      id: 'studio',
      version: '1',
      portalSegment: 'studio',
      groups: [{
        heading: 'Operations',
        order: 2,
        items: [{
          pageKey: 'workflows',
          routePattern: 'workflows',
          label: 'Workflows',
          icon: 'GitBranch',
          order: 1,
          auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        }],
      }],
    }];

    const groups = buildAdminShellNav({
      config,
      mountId: 'us',
      mountPathPrefix: '/us',
      currentUser: { roles: ['ADMIN'] },
      navigationRef: 'studio',
      currentCultureId: 'us',
      currentPortalSegment: 'studio',
    });

    const workflows = groups
      .flatMap((group) => group.items)
      .find((item) => item.type !== 'separator' && item.label === 'Workflows');

    expect(workflows).toMatchObject({
      label: 'Workflows',
      path: '/us/studio/workflows',
    });

    const groupsForDesigner = buildAdminShellNav({
      config,
      mountId: 'us',
      mountPathPrefix: '/us',
      currentUser: { roles: ['ADMIN'] },
      navigationRef: 'studio',
      currentCultureId: 'us',
      currentPortalSegment: 'studio',
    });

    expect(findAdminShellNavItemContextByPath(
      groupsForDesigner,
      '/us/studio/workflows/edit/order-approval',
    )?.item).toMatchObject({
      label: 'Workflows',
      path: '/us/studio/workflows',
    });

    const editHeader = resolveAdminShellHeaderContext({
      groups: buildAdminShellNav({
        config,
        mountId: 'studio',
        mountPathPrefix: STUDIO_MOUNT_PREFIX,
        currentUser: { roles: ['ADMIN'] },
      }),
      pathname: '/studio/workflows/edit/order-approval',
      config,
      mountId: 'studio',
    });
    expect(editHeader).toMatchObject({
      groupHeading: 'Ops',
      item: {
        pageKey: 'workflows',
        label: 'Workflows',
        icon: 'GitBranch',
      },
    });

    const strippedListConfig = buildStudioConfig([
      {
        id: 27,
        mountId: 'studio',
        routePattern: 'workflows',
        pageKey: 'workflows',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: {
          label: 'Workflows',
          description: 'Author, validate, publish and simulate workflow definitions.',
        },
      },
      {
        id: 31,
        mountId: 'studio',
        routePattern: 'workflows/edit/*',
        pageKey: 'workflows',
        enabled: true,
        auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
        nav: null,
      },
    ]);
    strippedListConfig.navigations = config.navigations;
    strippedListConfig.pageModules = [{
      pageKey: 'workflows',
      title: 'Workflows',
      loaderKind: 'core',
      loaderRef: 'core:Workflows',
      defaultRoles: null,
      enabled: true,
      ownerPackageId: null,
      ownerPluginVersion: null,
      source: 'manual',
      createdAt: '2026-07-17T00:00:00.000Z',
      createdBy: null,
      updatedAt: '2026-07-17T00:00:00.000Z',
      updatedBy: null,
    }];

    const strippedGroups = buildAdminShellNav({
      config: strippedListConfig,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
      navigationRef: 'studio',
      currentCultureId: 'us',
      currentPortalSegment: 'studio',
    });

    const listHeader = resolveAdminShellHeaderContext({
      groups: strippedGroups,
      pathname: '/studio/workflows',
      config: strippedListConfig,
      mountId: 'studio',
    });
    expect(listHeader).toMatchObject({
      groupHeading: 'Ops',
      item: {
        pageKey: 'workflows',
        label: 'Workflows',
        icon: 'GitBranch',
      },
    });
  });

  it('resolves header title from route binding when manifest nav only matches a parent path', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: '',
        pageKey: 'dashboard',
        enabled: true,
        nav: {
          label: 'Home',
          icon: 'LayoutDashboard',
          description: 'System overview and core metrics tracking.',
        },
      },
      {
        id: 33,
        mountId: 'studio',
        routePattern: 'my-feedback',
        pageKey: 'my-feedback',
        enabled: true,
        nav: null,
      },
    ]);
    config.pageModules = [
      {
        pageKey: 'my-feedback',
        title: 'My Feedback',
        loaderKind: 'core',
        loaderRef: 'core:MyFeedback',
        defaultRoles: null,
        enabled: true,
        ownerPackageId: null,
        ownerPluginVersion: null,
        source: 'manual',
        createdAt: '2026-07-18T00:00:00.000Z',
        createdBy: null,
        updatedAt: '2026-07-18T00:00:00.000Z',
        updatedBy: null,
      },
    ];

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    const header = resolveAdminShellHeaderContext({
      groups,
      pathname: '/studio/my-feedback',
      config,
      mountId: 'studio',
    });

    expect(header.item).toMatchObject({
      pageKey: 'my-feedback',
      label: 'My Feedback',
      icon: 'MessageSquare',
    });
    expect(findAdminShellNavItemContextByPath(groups, '/studio/my-feedback')?.item.label).toBe('Home');
  });

  it('resolves header title on culture mount canonical /us/studio/* paths', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: '',
        pageKey: 'dashboard',
        enabled: true,
        nav: {
          label: 'Home',
          icon: 'LayoutDashboard',
          description: 'System overview and core metrics tracking.',
        },
      },
      {
        id: 33,
        mountId: 'studio',
        routePattern: 'my-feedback',
        pageKey: 'my-feedback',
        enabled: true,
        nav: null,
      },
    ]);
    config.mounts.push({
      id: 'us',
      pathPrefix: '/us',
      name: 'US',
      enabled: true,
      defaultRoute: '/us/studio',
      designerRoutePropagation: 'auto',
      authProfile: {},
    });
    config.pageModules = [
      {
        pageKey: 'my-feedback',
        title: 'My Feedback',
        loaderKind: 'core',
        loaderRef: 'core:MyFeedback',
        defaultRoles: null,
        enabled: true,
        ownerPackageId: null,
        ownerPluginVersion: null,
        source: 'manual',
        createdAt: '2026-07-18T00:00:00.000Z',
        createdBy: null,
        updatedAt: '2026-07-18T00:00:00.000Z',
        updatedBy: null,
      },
    ];

    const groups = buildAdminShellNav({
      config,
      mountId: 'us',
      mountPathPrefix: '/us',
      currentUser: { roles: ['ADMIN'] },
    });

    const header = resolveAdminShellHeaderContext({
      groups,
      pathname: '/us/studio/my-feedback',
      config,
      mountId: 'us',
    });

    expect(header.item).toMatchObject({
      pageKey: 'my-feedback',
      label: 'My Feedback',
      icon: 'MessageSquare',
    });
    expect(findAdminShellNavItemContextByPath(groups, '/us/studio/my-feedback')?.item.label).toBe('Home');
  });

  it('resolves nested Development children for active path and flatten', () => {
    const config = buildStudioConfig([]);
    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
      manifest: {
        id: 'studio',
        groups: [{
          heading: 'Development',
          items: [
            {
              pageKey: 'data-studio',
              routePattern: 'data-studio',
              label: 'Data Studio',
              children: [
                { pageKey: 'sql-console', routePattern: 'sql-console', label: 'SQL Console' },
                { pageKey: 'sources', routePattern: 'data-sources', label: 'Data Sources' },
              ],
            },
          ],
        }],
      },
    });

    expect(findAdminShellNavItemByPath(groups, '/studio/sql-console')?.label).toBe('SQL Console');
    expect(findAdminShellNavItemByPath(groups, '/studio/data-sources')?.label).toBe('Data Sources');
    expect(findAdminShellNavItemByPath(groups, '/studio/data-studio')?.label).toBe('Data Studio');
    expect(flattenAdminShellNavItems(groups).map((item) => item.pageKey)).toEqual([
      'data-studio',
      'sql-console',
      'sources',
    ]);
    expect(findAdminShellNavBreadcrumbTrail(groups, '/studio/sql-console').map((segment) => segment.label)).toEqual([
      'Dev',
      'Data Studio',
      'SQL Console',
    ]);
  });

  it('uses portal-scoped bindings when multiple route bindings share a pageKey', () => {
    const bindings = [
      {
        id: 16,
        mountId: 'studio',
        routePattern: 'base-info',
        pageKey: 'base-info',
        enabled: true,
        nav: { label: 'Studio Base Info', group: 'Records', order: 1 },
      },
      {
        id: 95,
        mountId: 'studio',
        routePattern: 'hawiety/base-info',
        pageKey: 'base-info',
        enabled: true,
        nav: { label: 'Hawiety Base Info', group: 'System management', order: 1 },
      },
    ];
    const config = buildStudioConfig(bindings);
    config.mounts.push({
      id: 'iq',
      pathPrefix: '/iq',
      name: 'IQ',
      enabled: true,
      defaultRoute: '/iq',
      designerRoutePropagation: 'auto',
      authProfile: {},
    });
    config.navigations = [{
      id: 'hawiety',
      version: '1',
      portalSegment: 'hawiety',
      groups: [{
        heading: 'System management',
        order: 1,
        items: [{
          pageKey: 'base-info',
          routePattern: 'base-info',
          label: 'Base Info',
          order: 1,
        }],
      }],
    }];

    const groups = buildAdminShellNav({
      config,
      mountId: 'iq',
      mountPathPrefix: '/iq',
      currentUser: { roles: ['ADMIN'] },
      navigationRef: 'hawiety',
      currentCultureId: 'iq',
      currentPortalSegment: 'hawiety',
    });

    const item = flattenAdminShellNavItems(groups).find((navItem) => navItem.pageKey === 'base-info');
    expect(item).toMatchObject({
      path: '/iq/hawiety/base-info',
      label: 'Base Info',
    });

    const header = resolveAdminShellHeaderContext({
      groups,
      pathname: '/iq/hawiety/base-info',
      config,
      mountId: 'iq',
    });
    expect(header.groupHeading).toBe('System management');
  });
});
