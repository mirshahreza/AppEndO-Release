import { describe, expect, it, beforeEach } from 'vitest';
import type { FeatureGraph } from '../../aiIndexCodegen';
import { probeApplicationIntelligenceScaffold } from '../applicationIntelligenceHealth';
import { resetSemanticGraphStoreForTests } from '../semanticGraphStore';

const TEST_GRAPH: FeatureGraph = {
  version: 'health-graph-v1',
  generatedAt: '2026-07-11T00:00:00.000Z',
  source: {
    navigation: 'test',
    pageModulesDir: 'test',
  },
  nodes: [
    {
      pageKey: 'dashboard',
      label: 'Dashboard',
      menuGroup: null,
      routePattern: '/studio/dashboard',
      inStudioMenu: true,
      ui: {
        pageModule: 'dashboard',
        loaderRef: 'dashboardLoader',
        page: 'src/features/dashboard/DashboardPage.tsx',
        feature: 'src/features/dashboard',
        domain: null,
        workspace: null,
      },
      api: {
        routes: [],
        apiPrefixes: [],
        contracts: null,
        services: [],
      },
      tests: null,
      notes: null,
    },
  ],
};

describe('applicationIntelligenceHealth', () => {
  beforeEach(() => {
    resetSemanticGraphStoreForTests();
  });

  it('passes scaffold health probe after feature graph bootstrap', () => {
    const probe = probeApplicationIntelligenceScaffold({
      graph: TEST_GRAPH,
      applicationScopeRef: 'platform:studio',
    });

    expect(probe.ok).toBe(true);
    expect(probe.nodeCount).toBeGreaterThan(0);
    expect(probe.failures).toEqual([]);
  });
});
