import { describe, expect, it } from 'vitest';
import type { FeatureGraph } from '../../aiIndexCodegen';
import { probeCodebaseRetrievalScaffold } from '../codebaseRetrievalHealth';

const SAMPLE = `
export function buildContextPackScaffold(input: unknown) {
  return input;
}
`.trim();

const USERS_GRAPH: FeatureGraph = {
  version: 'retrieval-health-v1',
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

describe('codebaseRetrievalHealth', () => {
  it('passes retrieval scaffold health probe', () => {
    const probe = probeCodebaseRetrievalScaffold({
      applicationScopeRef: 'platform:studio',
      sampleFiles: [
        {
          path: 'src/shared/lib/appendoo/contextPackBuilder.ts',
          content: SAMPLE,
        },
      ],
    });

    expect(probe.ok).toBe(true);
    expect(probe.extractorCount).toBeGreaterThanOrEqual(8);
    expect(probe.failures).toEqual([]);
  });

  it('uses feature graph runtime scope paths (not fixture-only)', () => {
    const probe = probeCodebaseRetrievalScaffold({
      applicationScopeRef: 'platform:studio',
      featureGraph: USERS_GRAPH,
      sampleFiles: [{
        path: 'src/features/users/UsersPage.tsx',
        content: SAMPLE,
      }],
    });

    expect(probe.ok).toBe(true);
  });
});
