import { describe, expect, it, beforeEach } from 'vitest';
import type { FeatureGraph } from '../../aiIndexCodegen';
import { buildArtifactRef } from '../../../api/contracts/appendoo/artifactRef.types';
import {
  bootstrapApplicationIntelligenceFromFeatureGraph,
  findUsages,
  getApplicationMap,
  getArtifact,
  getArtifactContext,
  getDependencies,
  getImpactAnalysis,
} from '../applicationIntelligenceScaffold';
import { importFeatureGraphIntoSemanticGraph } from '../featureGraphSemanticImporter';
import { resetSemanticGraphStoreForTests } from '../semanticGraphStore';

const TEST_GRAPH: FeatureGraph = {
  version: 'test-graph-v1',
  generatedAt: '2026-07-11T00:00:00.000Z',
  source: {
    navigation: 'test',
    pageModulesDir: 'test',
  },
  nodes: [
    {
      pageKey: 'users',
      label: 'Users',
      menuGroup: 'admin',
      routePattern: '/studio/users',
      inStudioMenu: true,
      ui: {
        pageModule: 'users',
        loaderRef: 'usersLoader',
        page: 'src/features/users/UsersPage.tsx',
        feature: 'src/features/users',
        domain: 'src/server/domain/users',
        workspace: null,
      },
      api: {
        routes: ['/api/users'],
        apiPrefixes: ['/api/users'],
        contracts: null,
        services: ['src/server/services/users/users.service.ts'],
      },
      tests: null,
      notes: null,
    },
  ],
};

describe('applicationIntelligenceScaffold', () => {
  beforeEach(() => {
    resetSemanticGraphStoreForTests();
  });

  it('bootstraps application map from feature graph', () => {
    bootstrapApplicationIntelligenceFromFeatureGraph(TEST_GRAPH, 'platform:studio');

    const map = getApplicationMap('platform:studio');
    expect(map.entries.some((entry) => entry.kind === 'Page' && entry.label === 'Users')).toBe(true);
    expect(map.indexVersion).toBeGreaterThan(0);
  });

  it('resolves artifact context and dependencies', () => {
    importFeatureGraphIntoSemanticGraph(TEST_GRAPH, 'platform:studio');

    const ref = buildArtifactRef({
      applicationScopeRef: 'platform:studio',
      artifactType: 'page',
      canonicalName: 'users',
    });

    const artifact = getArtifact(ref);
    expect(artifact?.nodeId).toBe('page:users');

    const context = getArtifactContext(ref);
    expect(context.nodeId).toBe('page:users');
    expect(context.dependencies.some((entry) => entry.kind === 'Service')).toBe(true);

    const dependencies = getDependencies('page:users');
    expect(dependencies.length).toBeGreaterThan(0);
  });

  it('computes impact paths and reverse usages', () => {
    importFeatureGraphIntoSemanticGraph(TEST_GRAPH, 'platform:studio');

    const impact = getImpactAnalysis('page:users', 2);
    expect(impact.impactedNodeIds.length).toBeGreaterThan(0);

    const serviceNodeId = 'service:users:src/server/services/users/users.service.ts';
    const usages = findUsages(serviceNodeId);
    expect(usages.some((entry) => entry.nodeId === 'page:users')).toBe(true);
  });

  it('replaces facts by source idempotently on re-import', () => {
    const first = importFeatureGraphIntoSemanticGraph(TEST_GRAPH, 'platform:studio');
    const second = importFeatureGraphIntoSemanticGraph(TEST_GRAPH, 'platform:studio');

    expect(second.nodesReplaced).toBe(first.nodesReplaced);
    expect(second.indexVersion).toBeGreaterThan(first.indexVersion);
  });
});
