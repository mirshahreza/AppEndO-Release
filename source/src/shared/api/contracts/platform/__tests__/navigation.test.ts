import { describe, expect, it } from 'vitest';
import studioNavJson from '../../../../../config/platform-registry/navigation/studio.json';
import {
  buildNavigationManifestFromBindings,
  compareNavigationManifestSummaries,
  getNavigationManifestById,
  mergeNavigationTargetOverrides,
  validateNavigationManifest,
  type NavigationManifest,
} from '../navigation';

const studioNav = studioNavJson as NavigationManifest;
import type { PlatformRouteBinding } from '../types';

const bindings: PlatformRouteBinding[] = [
  {
    id: 1,
    mountId: 'studio',
    routePattern: '',
    pageKey: 'dashboard',
    enabled: true,
    nav: { label: 'Dashboard', icon: 'LayoutDashboard', order: 0 },
  },
  {
    id: 2,
    mountId: 'studio',
    routePattern: 'users',
    pageKey: 'users',
    enabled: true,
    nav: { label: 'Users', icon: 'Users', group: 'Records', order: 1 },
  },
];

describe('navigation contract', () => {
  it('sorts Extensions between Development and Records', () => {
    const manifest = buildNavigationManifestFromBindings({
      bindings: [
        {
          id: 1,
          mountId: 'studio',
          routePattern: 'data-studio',
          pageKey: 'data-studio',
          enabled: true,
          nav: { label: 'Data Studio', group: 'Development', order: 1 },
        },
        {
          id: 2,
          mountId: 'studio',
          routePattern: 'package-manager',
          pageKey: 'package-manager',
          enabled: true,
          nav: { label: 'Package Manager', group: 'Extensions', order: 1 },
        },
        {
          id: 3,
          mountId: 'studio',
          routePattern: 'workflows',
          pageKey: 'workflows',
          enabled: true,
          nav: { label: 'Workflows', group: 'Development', order: 5 },
        },
        {
          id: 4,
          mountId: 'studio',
          routePattern: 'users',
          pageKey: 'users',
          enabled: true,
          nav: { label: 'Users', group: 'Records', order: 1 },
        },
      ],
      id: 'studio',
    });

    expect(manifest.groups.map((group) => group.heading)).toEqual([
      'Development',
      'Extensions',
      'Records',
    ]);
  });

  it('sorts Remote Hubs after Records', () => {
    const manifest = buildNavigationManifestFromBindings({
      bindings: [
        {
          id: 1,
          mountId: 'studio',
          routePattern: 'data-studio',
          pageKey: 'data-studio',
          enabled: true,
          nav: { label: 'Data Studio', group: 'Development', order: 1 },
        },
        {
          id: 2,
          mountId: 'studio',
          routePattern: 'file-hub/*',
          pageKey: 'file-hub',
          enabled: true,
          nav: { label: 'Sftp', group: 'Remote Hubs', order: 1 },
        },
        {
          id: 3,
          mountId: 'studio',
          routePattern: 'package-manager',
          pageKey: 'package-manager',
          enabled: true,
          nav: { label: 'Package Manager', group: 'Extensions', order: 1 },
        },
        {
          id: 4,
          mountId: 'studio',
          routePattern: 'workflows',
          pageKey: 'workflows',
          enabled: true,
          nav: { label: 'Workflows', group: 'Development', order: 5 },
        },
        {
          id: 5,
          mountId: 'studio',
          routePattern: 'users',
          pageKey: 'users',
          enabled: true,
          nav: { label: 'Users', group: 'Records', order: 1 },
        },
      ],
      id: 'studio',
    });

    expect(manifest.groups.map((group) => group.heading)).toEqual([
      'Development',
      'Extensions',
      'Records',
      'Remote Hubs',
    ]);
  });

  it('builds grouped navigation manifests from route bindings', () => {
    const manifest = buildNavigationManifestFromBindings({ bindings, id: 'studio' });
    expect(manifest.groups).toHaveLength(2);
    expect(manifest.groups[1]?.heading).toBe('Records');
  });

  it('finds navigation manifests by id', () => {
    const manifest = buildNavigationManifestFromBindings({ bindings, id: 'studio' });
    expect(getNavigationManifestById([manifest], 'studio')?.id).toBe('studio');
  });

  it('sorts navigation summaries with built-in manifests first, then by id', () => {
    const rows = [
      { id: 'my-test', builtIn: false },
      { id: 'studio', builtIn: true },
      { id: 'alpha', builtIn: false },
    ].sort(compareNavigationManifestSummaries);

    expect(rows.map((row) => row.id)).toEqual(['studio', 'alpha', 'my-test']);
  });

  it('rejects legacy renderer field on navigation manifests', () => {
    const result = validateNavigationManifest({
      id: 'custom',
      groups: [],
      renderer: 'core:TreeNavTwoLevel',
    });
    expect(result.valid).toBe(false);
    if (result.valid) {
      throw new Error('expected invalid manifest');
    }
    expect(result.errors.some((error) => error.includes('renderer'))).toBe(true);
  });

  it('accepts culture and portal target overrides on items', () => {
    const result = validateNavigationManifest({
      id: 'custom',
      groups: [{
        items: [{
          label: 'Users',
          pageKey: 'users',
          routePattern: 'users',
          cultureId: 'ir',
          portalSegment: null,
        }],
      }],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.manifest.groups[0]?.items[0]?.cultureId).toBe('ir');
      expect(result.manifest.groups[0]?.items[0]?.portalSegment).toBeNull();
    }
  });

  it('preserves group icon on validate (regression: was silently dropped on every save)', () => {
    const result = validateNavigationManifest({
      id: 'custom',
      groups: [{
        heading: 'Development',
        icon: 'tabler:IconBraces',
        items: [],
      }],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.manifest.groups[0]?.icon).toBe('tabler:IconBraces');
    }
  });

  it('keeps shipped Platform Transfer out of the Studio sidebar', () => {
    const items = studioNav.groups.flatMap((group) => group.items);
    expect(items.some((item) => item.pageKey === 'platform-transfer')).toBe(false);
    const development = studioNav.groups.find((group) => group.heading === 'Development');
    const developmentKeys = (development?.items ?? []).map((item) => item.pageKey);
    expect(developmentKeys).toEqual([
      'idea-foundry',
      'data-studio',
      'server-functions',
      'client-components',
      'base-components',
      'platform-portals',
      'workflows',
      'scheduled-tasks',
      'jobs',
      'cache',
      'git',
      'file-manager',
      'appearance',
      'settings',
    ]);
    expect(studioNav.groups.find((group) => group.heading === 'Operations')).toBeUndefined();
    const dataStudio = development?.items.find((item) => item.pageKey === 'data-studio');
    expect(dataStudio?.separatorBefore).toBe(true);
    expect(dataStudio?.children?.map((item) => item.pageKey)).toEqual(['sql-console', 'sources']);
    const serverFunctions = development?.items.find((item) => item.pageKey === 'server-functions');
    expect(serverFunctions?.children?.map((item) => item.pageKey)).toEqual(['api-talk', 'dev-reference']);
    const clientComponents = development?.items.find((item) => item.pageKey === 'client-components');
    expect(clientComponents?.children).toBeUndefined();
    const records = studioNav.groups.find((group) => group.heading === 'Records');
    const recordsKeys = (records?.items ?? []).map((item) => item.pageKey);
    expect(recordsKeys).not.toContain('organization-chart');
    expect(recordsKeys).not.toContain('geographic-divisions');
    const baseInfo = records?.items.find((item) => item.pageKey === 'base-info');
    expect(baseInfo?.children?.map((item) => item.pageKey)).toEqual([
      'organization-chart',
      'geographic-divisions',
    ]);
    expect(studioNav.groups.find((group) => group.heading === 'Remote Hubs')).toBeUndefined();
    expect(studioNav.groups.find((group) => group.heading === 'Workshops')).toBeUndefined();
    const settings = items.find((item) => item.pageKey === 'settings');
    expect(settings?.region).toBe('sidebar-footer');
  });

  it('accepts item region for the three live shell locations', () => {
    const result = validateNavigationManifest({
      id: 'custom',
      groups: [{
        items: [
          { label: 'Workflows', pageKey: 'workflows', routePattern: 'workflows' },
          { label: 'Help', pageKey: 'help', routePattern: 'help', region: 'sidebar-footer' },
          { label: 'Account', pageKey: 'account', routePattern: 'account', region: 'header' },
        ],
      }],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.manifest.groups[0]?.items[0]?.region).toBeUndefined();
      expect(result.manifest.groups[0]?.items[1]?.region).toBe('sidebar-footer');
      expect(result.manifest.groups[0]?.items[2]?.region).toBe('header');
    }
  });

  it('rejects unknown item region values', () => {
    const result = validateNavigationManifest({
      id: 'custom',
      groups: [{
        items: [{ label: 'Help', region: 'footer' }],
      }],
    });
    expect(result.valid).toBe(false);
    if (result.valid) {
      throw new Error('expected invalid manifest');
    }
    expect(result.errors.some((error) => error.includes('region'))).toBe(true);
  });

  it('preserves item region when regenerating from route bindings', () => {
    const previous = {
      id: 'studio',
      groups: [{
        heading: null,
        items: [{
          label: 'Users',
          pageKey: 'users',
          routePattern: 'users',
          region: 'header' as const,
        }],
      }],
    };
    const next = buildNavigationManifestFromBindings({ bindings, id: 'studio' });
    const merged = mergeNavigationTargetOverrides(previous, next);
    const users = merged.groups.flatMap((group) => group.items)
      .find((item) => item.pageKey === 'users');
    expect(users?.region).toBe('header');
  });

  it('preserves leading unheaded sidebar chrome when compile rebuilds from bindings', () => {
    const previous = {
      id: 'hawiety',
      groups: [
        {
          heading: null,
          order: 0,
          items: [
            { pageKey: 'dashboard', label: 'Home', routePattern: '', portalSegment: 'studio' },
            {
              pageKey: 'appearance',
              label: 'Theme Designer',
              routePattern: 'appearance/*',
              portalSegment: 'studio',
              region: 'sidebar-footer' as const,
            },
          ],
        },
        {
          heading: 'Persons management',
          order: 1,
          items: [{ pageKey: 'hwy-members-all', label: 'All People', routePattern: 'hawiety/members-all' }],
        },
      ],
    };
    const next = {
      id: 'hawiety',
      groups: [{
        heading: 'Persons management',
        order: 1,
        items: [{ pageKey: 'hwy-members-all', label: 'All People', routePattern: 'hawiety/members-all' }],
      }],
    };

    const merged = mergeNavigationTargetOverrides(previous, next);
    expect(merged.groups[0]?.heading).toBeNull();
    expect(merged.groups[0]?.items.map((item) => item.pageKey)).toEqual(['dashboard', 'appearance']);
  });

  it('keeps a package-only Remote Hubs group when core compile omits that heading', () => {
    const previous = {
      id: 'studio',
      groups: [
        {
          heading: 'Development',
          order: 1,
          items: [
            { pageKey: 'api-talk', label: 'API Talk', routePattern: 'api-talk', order: 3 },
          ],
        },
        {
          heading: 'Remote Hubs',
          order: 4,
          items: [
            { pageKey: 'file-hub', label: 'Sftp', routePattern: 'file-hub/*', order: 1 },
            { pageKey: 'ssh-hub', label: 'SSH', routePattern: 'ssh-hub/*', order: 2 },
          ],
        },
      ],
    };
    const next = {
      id: 'studio',
      groups: [{
        heading: 'Development',
        order: 1,
        items: [
          { pageKey: 'api-talk', label: 'API Talk', routePattern: 'api-talk', order: 3 },
        ],
      }],
    };

    const merged = mergeNavigationTargetOverrides(previous, next);
    expect(merged.groups.map((group) => group.heading)).toEqual(['Development', 'Remote Hubs']);
    expect(merged.groups[0]?.items.map((item) => item.pageKey)).toEqual(['api-talk']);
    expect(merged.groups[1]?.items.map((item) => item.pageKey)).toEqual(['file-hub', 'ssh-hub']);
  });
});
