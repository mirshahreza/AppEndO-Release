import type { FeatureGraph } from '../aiIndexCodegen';
import {
  buildContextPackScaffold,
  enrichContextPackWithApplicationIntelligence,
  enrichContextPackWithCodebaseRetrieval,
  enrichContextPackWithMemoryKnowledge,
} from './contextPackBuilder';
import { resolveApplicationIntelligenceEnrichment } from './contextPackApplicationIntelligence';
import { resetSemanticGraphStoreForTests } from './semanticGraphStore';

const PROBE_FEATURE_GRAPH: FeatureGraph = {
  version: 'fg-probe-1',
  generatedAt: '2026-07-11T00:00:00.000Z',
  source: { navigation: 'test', pageModulesDir: 'test' },
  nodes: [{
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
  }],
};

export type ContextPackBuilderHealthProbe = {
  ok: boolean;
  builderVersion: string;
  failures: string[];
};

export type ContextPackEnrichmentProductionProbe = {
  ok: boolean;
  builderVersion: string;
  applicationIntelligenceOk: boolean;
  codebaseRetrievalOk: boolean;
  memoryKnowledgeOk: boolean;
  failures: string[];
};

const basePackInput = () => ({
  applicationScope: {
    kind: 'platform' as const,
    scopeKey: 'platform:studio:page:users',
    mountId: 'studio',
    pageKey: 'users',
  },
  pageContext: {
    pageKey: 'users',
    pageLabel: 'Users',
  },
  userPrompt: 'Add export to users grid',
});

/** AE-3.2 — health probe for application intelligence context pack enrichment. */
export const probeContextPackApplicationIntelligenceEnrichment = (input?: {
  graph?: FeatureGraph;
}): ContextPackBuilderHealthProbe => {
  const failures: string[] = [];
  resetSemanticGraphStoreForTests();

  const pack = buildContextPackScaffold(basePackInput());
  const enrichment = resolveApplicationIntelligenceEnrichment({
    graph: input?.graph ?? PROBE_FEATURE_GRAPH,
    applicationScope: basePackInput().applicationScope,
    pageKey: 'users',
  });
  const enriched = enrichContextPackWithApplicationIntelligence(pack, enrichment);

  if (!enriched.indexVersions.featureGraph) {
    failures.push('Feature graph version missing after enrichment.');
  }
  if (!enriched.selectionExplanations.some((entry) => entry.reasonCode === 'GRAPH_DEPENDENCY')) {
    failures.push('Expected GRAPH_DEPENDENCY selection explanations from ASG hints.');
  }

  return {
    ok: failures.length === 0,
    builderVersion: '1.1.0',
    failures,
  };
};

/** AE-4.2 — health probe for codebase retrieval context pack enrichment. */
export const probeContextPackCodebaseRetrievalEnrichment = (): ContextPackBuilderHealthProbe => {
  const failures: string[] = [];
  const pack = buildContextPackScaffold(basePackInput());
  const enriched = enrichContextPackWithCodebaseRetrieval(pack, {
    structuralEvidence: ['src/features/users/UsersPage.tsx:10#UsersPage'],
    similarImplementations: ['src/features/settings/SettingsPage.tsx'],
    codebaseIndexVersion: 'codebase:1.0.0',
  });

  if (enriched.structuralEvidence.length === 0) {
    failures.push('Structural evidence missing after retrieval enrichment.');
  }
  if (!enriched.selectionExplanations.some((entry) => entry.reasonCode === 'DIRECT_CALLER')) {
    failures.push('Expected DIRECT_CALLER explanation from structural evidence.');
  }

  return {
    ok: failures.length === 0,
    builderVersion: '1.1.0',
    failures,
  };
};

/** AE-5.2 — health probe for memory/knowledge/capability context pack enrichment. */
export const probeContextPackMemoryKnowledgeEnrichment = (): ContextPackBuilderHealthProbe => {
  const failures: string[] = [];
  const pack = buildContextPackScaffold(basePackInput());
  const enriched = enrichContextPackWithMemoryKnowledge(pack, {
    governance: ['Engineering changes require V3 pipeline.'],
    capabilityEvidence: ['capability:appendo-files'],
    trustedPatterns: ['pattern.crud-grid-export'],
    decisionMemoryVersion: '1.0.0',
    capabilitySnapshotVersion: '1.0.0:agent:',
  });

  if (enriched.capabilityEvidence.length === 0) {
    failures.push('Capability evidence missing after memory enrichment.');
  }
  if (!enriched.indexVersions.decisionMemory) {
    failures.push('Decision memory version missing after enrichment.');
  }
  if (!enriched.selectionExplanations.some((entry) => entry.reasonCode === 'GOVERNING_DECISION')) {
    failures.push('Expected GOVERNING_DECISION explanation from governance terms.');
  }

  return {
    ok: failures.length === 0,
    builderVersion: '1.1.0',
    failures,
  };
};

/** AE-3.2/4.2/5.2 — combined production-depth probe for context pack enrichment layers. */
export const probeContextPackEnrichmentProductionDepth = (input?: {
  graph?: FeatureGraph;
}): ContextPackEnrichmentProductionProbe => {
  const appIntel = probeContextPackApplicationIntelligenceEnrichment(input);
  const codebase = probeContextPackCodebaseRetrievalEnrichment();
  const memory = probeContextPackMemoryKnowledgeEnrichment();
  const failures = [
    ...appIntel.failures.map((failure) => `[app-intel] ${failure}`),
    ...codebase.failures.map((failure) => `[codebase] ${failure}`),
    ...memory.failures.map((failure) => `[memory] ${failure}`),
  ];

  return {
    ok: appIntel.ok && codebase.ok && memory.ok,
    builderVersion: '1.1.0',
    applicationIntelligenceOk: appIntel.ok,
    codebaseRetrievalOk: codebase.ok,
    memoryKnowledgeOk: memory.ok,
    failures,
  };
};
