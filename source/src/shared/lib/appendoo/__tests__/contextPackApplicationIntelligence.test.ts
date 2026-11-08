import { describe, expect, it, beforeEach } from 'vitest';
import type { FeatureGraph } from '../../aiIndexCodegen';
import {
  buildContextPackScaffold,
  enrichContextPackWithApplicationIntelligence,
} from '../contextPackBuilder';
import { resolveApplicationIntelligenceEnrichment } from '../contextPackApplicationIntelligence';
import { probeContextPackApplicationIntelligenceEnrichment } from '../contextPackBuilderHealth';
import { resetSemanticGraphStoreForTests } from '../semanticGraphStore';

const SAMPLE_GRAPH: FeatureGraph = {
  version: 'fg-test-1',
  generatedAt: '2026-07-11T00:00:00.000Z',
  source: { navigation: 'test', pageModulesDir: 'test' },
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

describe('AE-3.2 contextPack application intelligence enrichment', () => {
  beforeEach(() => {
    resetSemanticGraphStoreForTests();
  });
  it('enriches context pack with ASG dependency hints', () => {
    const pack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      pageContext: { pageKey: 'users', pageLabel: 'Users' },
    });

    const enrichment = resolveApplicationIntelligenceEnrichment({
      graph: SAMPLE_GRAPH,
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      pageKey: 'users',
    });

    const enriched = enrichContextPackWithApplicationIntelligence(pack, enrichment);
    expect(enriched.indexVersions.featureGraph).toBe('fg-test-1');
    expect(enriched.selectionExplanations.some((e) => e.reasonCode === 'GRAPH_DEPENDENCY')).toBe(true);
  });

  it('passes health probe', () => {
    const probe = probeContextPackApplicationIntelligenceEnrichment({ graph: SAMPLE_GRAPH });
    expect(probe.ok).toBe(true);
  });
});
