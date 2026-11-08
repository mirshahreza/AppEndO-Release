import { beforeEach, describe, expect, it } from 'vitest';
import type { FeatureGraph } from '../../../../shared/lib/aiIndexCodegen';
import { applicationIntelligenceService } from '../applicationIntelligence.service';
import { listIntelligenceIndexJobs } from '../../../../shared/lib/appendoo/intelligenceIndexCoordinator';

const TEST_GRAPH: FeatureGraph = {
  version: 'reindex-graph-v1',
  generatedAt: '2026-07-11T00:00:00.000Z',
  source: { navigation: 'test', pageModulesDir: 'test' },
  nodes: [{
    pageKey: 'users',
    label: 'Users',
    menuGroup: null,
    routePattern: '/studio/users',
    inStudioMenu: true,
    ui: {
      pageModule: 'users',
      loaderRef: 'usersLoader',
      page: 'src/features/users/UsersPage.tsx',
      feature: 'src/features/users',
      domain: null,
      workspace: null,
    },
    api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
    tests: null,
    notes: null,
  }],
};

describe('applicationIntelligenceService AE-3.3', () => {
  beforeEach(() => {
    applicationIntelligenceService.resetForTests();
  });

  it('reindexes artifact on pageContext pageKey change', () => {
    const scope = 'platform:studio:page:users';
    const first = applicationIntelligenceService.reindexOnPageContextChange({
      applicationScopeRef: scope,
      pageKey: 'users',
      graph: TEST_GRAPH,
    });
    const second = applicationIntelligenceService.reindexOnPageContextChange({
      applicationScopeRef: scope,
      pageKey: 'users',
      graph: TEST_GRAPH,
    });

    expect(first?.kind).toBe('reindex_artifact');
    expect(second).toBeUndefined();
    expect(listIntelligenceIndexJobs().filter((job) => job.kind === 'reindex_artifact')).toHaveLength(1);
  });

  it('reindexes again when pageKey changes', () => {
    const scope = 'platform:studio';
    applicationIntelligenceService.reindexOnPageContextChange({
      applicationScopeRef: scope,
      pageKey: 'users',
      graph: TEST_GRAPH,
    });
    const serverFns = applicationIntelligenceService.reindexOnPageContextChange({
      applicationScopeRef: scope,
      pageKey: 'server-functions',
      graph: TEST_GRAPH,
    });

    expect(serverFns?.kind).toBe('reindex_artifact');
    expect(listIntelligenceIndexJobs().filter((job) => job.kind === 'reindex_artifact')).toHaveLength(2);
  });
});
