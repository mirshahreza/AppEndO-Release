import { describe, expect, it } from 'vitest';
import type { FeatureGraph } from '../aiIndexCodegen';
import {
  extractStudioRelativePathFromPathname,
  matchesRoutePattern,
  resolvePageKeyFromRelativePath,
} from '../resolvePageKeyFromPath';

const testGraph: FeatureGraph = {
  version: '1',
  generatedAt: '2026-01-01T00:00:00.000Z',
  source: { navigation: 'studio.json', pageModulesDir: 'page-modules' },
  nodes: [
    {
      pageKey: 'dashboard',
      label: 'Dashboard',
      menuGroup: null,
      routePattern: '',
      inStudioMenu: true,
      ui: { pageModule: null, loaderRef: 'core:Dashboard', page: null, feature: 'src/features/dashboard/', domain: null, workspace: null },
      api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
      tests: null,
      notes: null,
    },
    {
      pageKey: 'users',
      label: 'Users',
      menuGroup: 'Records',
      routePattern: 'users',
      inStudioMenu: true,
      ui: { pageModule: null, loaderRef: 'core:Users', page: null, feature: 'src/features/users/', domain: null, workspace: null },
      api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
      tests: null,
      notes: null,
    },
    {
      pageKey: 'settings',
      label: 'Settings',
      menuGroup: 'Operations',
      routePattern: 'settings/*',
      inStudioMenu: true,
      ui: { pageModule: null, loaderRef: 'core:Settings', page: null, feature: 'src/features/settings/', domain: null, workspace: null },
      api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
      tests: null,
      notes: null,
    },
    {
      pageKey: 'data-studio',
      label: 'Data Studio',
      menuGroup: 'Development',
      routePattern: 'data-studio',
      inStudioMenu: true,
      ui: { pageModule: null, loaderRef: 'core:DataStudio', page: null, feature: 'src/features/data-studio/', domain: null, workspace: null },
      api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
      tests: null,
      notes: null,
    },
  ],
};

describe('extractStudioRelativePathFromPathname', () => {
  it('extracts studio-relative paths across mount prefixes', () => {
    expect(extractStudioRelativePathFromPathname('/studio')).toBe('');
    expect(extractStudioRelativePathFromPathname('/studio/')).toBe('');
    expect(extractStudioRelativePathFromPathname('/studio/users')).toBe('users');
    expect(extractStudioRelativePathFromPathname('/ir/studio/users')).toBe('users');
    expect(extractStudioRelativePathFromPathname('/us/studio/settings/pwa')).toBe('settings/pwa');
  });

  it('returns null when pathname has no studio segment', () => {
    expect(extractStudioRelativePathFromPathname('/login')).toBeNull();
    expect(extractStudioRelativePathFromPathname('/home')).toBeNull();
  });
});

describe('matchesRoutePattern', () => {
  it('matches exact and splat route patterns', () => {
    expect(matchesRoutePattern('', '')).toBe(true);
    expect(matchesRoutePattern('users', 'users')).toBe(true);
    expect(matchesRoutePattern('users', 'roles')).toBe(false);
    expect(matchesRoutePattern('settings/*', 'settings')).toBe(true);
    expect(matchesRoutePattern('settings/*', 'settings/pwa')).toBe(true);
    expect(matchesRoutePattern('settings/*', 'settings/pwa/advanced')).toBe(true);
  });
});

describe('resolvePageKeyFromRelativePath', () => {
  it('resolves dashboard, exact routes, and splat routes', () => {
    expect(resolvePageKeyFromRelativePath('', testGraph)).toBe('dashboard');
    expect(resolvePageKeyFromRelativePath('users', testGraph)).toBe('users');
    expect(resolvePageKeyFromRelativePath('data-studio', testGraph)).toBe('data-studio');
    expect(resolvePageKeyFromRelativePath('settings/pwa', testGraph)).toBe('settings');
  });

  it('prefers the most specific route pattern', () => {
    const graph: FeatureGraph = {
      ...testGraph,
      nodes: [
        ...testGraph.nodes,
        {
          pageKey: 'settings-pwa',
          label: 'PWA',
          menuGroup: null,
          routePattern: 'settings/pwa',
          inStudioMenu: false,
          ui: { pageModule: null, loaderRef: 'orphan', page: null, feature: null, domain: null, workspace: null },
          api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
          tests: null,
          notes: null,
        },
      ],
    };

    expect(resolvePageKeyFromRelativePath('settings/pwa', graph)).toBe('settings-pwa');
    expect(resolvePageKeyFromRelativePath('settings/general', graph)).toBe('settings');
  });
});
