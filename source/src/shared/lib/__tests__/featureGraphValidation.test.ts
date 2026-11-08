import { describe, expect, it } from 'vitest';
import { validateFeatureGraph } from '../featureGraphValidation';

describe('validateFeatureGraph', () => {
  it('accepts a minimal valid graph', () => {
    const graph = validateFeatureGraph({
      version: '1',
      generatedAt: '2026-07-11T00:00:00.000Z',
      source: {
        navigation: 'src/config/platform-registry/navigation/studio.json',
        pageModulesDir: 'src/config/platform-registry/page-modules',
      },
      nodes: [{
        pageKey: 'users',
        label: 'Users',
        menuGroup: 'Administration',
        routePattern: 'users',
        inStudioMenu: true,
        ui: {
          pageModule: null,
          loaderRef: 'core:Users',
          page: null,
          feature: 'users',
          domain: null,
          workspace: null,
        },
        api: {
          routes: ['/api/users'],
          apiPrefixes: [],
          contracts: null,
          services: [],
        },
        tests: null,
        notes: null,
      }],
    });

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].pageKey).toBe('users');
  });

  it('rejects missing source', () => {
    expect(() => validateFeatureGraph({ version: '1', generatedAt: 'x', nodes: [] })).toThrow(/source/);
  });
});
