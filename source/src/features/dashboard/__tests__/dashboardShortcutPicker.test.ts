import { describe, expect, it } from 'vitest';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import type { AdminShellNavGroup } from '../../../layouts/adminShell/types';
import {
  composeDashboardShortcutPath,
  createDashboardShortcutFromTarget,
  filterDashboardShortcutTargets,
  listDashboardShortcutTargets,
  resolveDashboardShortcutItemMode,
} from '../dashboardShortcutPicker';

const adminUser = { role: 'ADMIN', roles: ['ADMIN'] };

const config: PlatformRuntimeConfig = {
  version: 'v1',
  mounts: [{
    id: 'studio',
    pathPrefix: '/us/studio',
    name: 'Studio',
    enabled: true,
    defaultRoute: '/us/studio',
    designerRoutePropagation: 'none',
    authProfile: {},
  }],
  shells: [],
  shellRules: [],
  navigations: [],
  pageModules: [{
    pageKey: 'studio-insights-ops',
    title: 'Operations',
    loaderKind: 'core',
    loaderRef: 'core:StudioInsightsOps',
    enabled: true,
  }],
  bindings: [
    {
      id: 1,
      mountId: 'studio',
      routePattern: 'workflows',
      pageKey: 'workflows',
      enabled: true,
      nav: { label: 'Workflows' },
    },
    {
      id: 2,
      mountId: 'studio',
      routePattern: 'workflows/edit/*',
      pageKey: 'workflows',
      enabled: true,
    },
    {
      id: 3,
      mountId: 'studio',
      routePattern: 'data-studio/*',
      pageKey: 'data-studio',
      enabled: true,
      nav: { label: 'Data Studio' },
    },
    {
      id: 4,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
      nav: { label: 'Users' },
    },
  ],
};

const navGroups: AdminShellNavGroup[] = [
  {
    heading: 'Development',
    items: [
      { pageKey: 'dashboard', label: 'Home', path: '/us/studio' },
      { pageKey: 'workflows', label: 'Workflows', path: '/us/studio/workflows', icon: 'Workflow' },
      {
        pageKey: 'data-studio',
        label: 'Data Studio',
        path: '/us/studio/data-studio',
        children: [
          { pageKey: 'sql-console', label: 'SQL Console', path: '/us/studio/sql-console' },
        ],
      },
    ],
  },
];

describe('dashboardShortcutPicker', () => {
  it('detects nested-editor vs remainder path params from route bindings', () => {
    expect(resolveDashboardShortcutItemMode(config.bindings, 'workflows')).toBe('edit');
    expect(resolveDashboardShortcutItemMode(config.bindings, 'data-studio')).toBe('remainder');
    expect(resolveDashboardShortcutItemMode(config.bindings, 'users')).toBeNull();
  });

  it('composes record, extra path, and query parameters onto a landing path', () => {
    expect(composeDashboardShortcutPath({
      basePath: '/us/studio/workflows',
      itemMode: 'edit',
      itemSlug: 'order-approval',
      queryPairs: [],
    })).toBe('/us/studio/workflows/edit/order-approval');

    expect(composeDashboardShortcutPath({
      basePath: '/us/studio/data-studio',
      itemMode: 'remainder',
      itemSlug: 'edit/Orders',
      queryPairs: [{ key: 'tab', value: 'fields' }, { key: ' ', value: 'skip' }],
    })).toBe('/us/studio/data-studio/edit/Orders?tab=fields');
  });

  it('lists navigable sidebar pages, skips Home, and includes routed pages missing from nav', () => {
    const targets = listDashboardShortcutTargets({
      navGroups,
      config,
      mountId: 'us',
      pathPrefix: '/us',
      currentUser: adminUser,
    });

    expect(targets.map((target) => target.pageKey)).toEqual([
      'workflows',
      'data-studio',
      'sql-console',
      'studio-insights-ops',
    ]);
    expect(targets.find((target) => target.pageKey === 'workflows')?.itemMode).toBe('edit');
    expect(targets.find((target) => target.pageKey === 'studio-insights-ops')?.path).toBe(
      '/us/studio/insights/operations',
    );
  });

  it('filters by label, path, or page key and builds a custom shortcut with params', () => {
    const targets = listDashboardShortcutTargets({
      navGroups,
      config,
      mountId: 'us',
      pathPrefix: '/us',
      currentUser: adminUser,
    });
    const workflows = targets.find((target) => target.pageKey === 'workflows');
    expect(workflows).toBeDefined();
    expect(filterDashboardShortcutTargets(targets, 'sql')).toEqual([
      expect.objectContaining({ pageKey: 'sql-console' }),
    ]);

    expect(createDashboardShortcutFromTarget(workflows!, {
      label: 'Order approval',
      icon: 'lucide:workflow',
      itemSlug: 'order-approval',
      queryPairs: [{ key: 'tab', value: 'graph' }],
    })).toEqual({
      id: 'custom:/us/studio/workflows/edit/order-approval?tab=graph',
      kind: 'custom',
      pageKey: 'workflows',
      path: '/us/studio/workflows/edit/order-approval?tab=graph',
      label: 'Order approval',
      icon: 'lucide:workflow',
    });
  });
});
