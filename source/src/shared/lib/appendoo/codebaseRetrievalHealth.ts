import type { FeatureGraph } from '../aiIndexCodegen';
import { resolveFeatureSearchRoots } from '../featureGraphStore';
import { getCodebaseExtractorRegistry } from './codebaseExtractorRegistry';
import {
  getCodebaseIntelligenceHealth,
  indexStructuralFile,
  queryStructuralIntelligence,
  resetCodebaseStructuralIndexForTests,
} from './codebaseStructuralScaffold';
import {
  getSemanticRetrievalHealth,
  hybridRetrieveFromCandidates,
  resetSemanticRetrievalStoreForTests,
} from './semanticRetrievalScaffold';

export const APPENDOO_CODEBASE_RETRIEVAL_HEALTH_VERSION = '1.1.0';

export type CodebaseRetrievalHealthProbe = {
  ok: boolean;
  codebaseVersion: string;
  retrievalVersion: string;
  extractorCount: number;
  failures: string[];
};

/** AE-4.1 — health probe for golden eval / ops. */
export const probeCodebaseRetrievalScaffold = (input?: {
  sampleFiles?: Array<{ path: string; content: string }>;
  applicationScopeRef?: string;
  featureGraph?: FeatureGraph;
}): CodebaseRetrievalHealthProbe => {
  const failures: string[] = [];
  resetCodebaseStructuralIndexForTests();
  resetSemanticRetrievalStoreForTests();

  const registry = getCodebaseExtractorRegistry();
  if (registry.extractors.length < 8) {
    failures.push('Expected at least 8 codebase extractors in registry.');
  }

  let runtimeScopePaths: string[] | undefined;
  if (input?.featureGraph) {
    const graphNode = input.featureGraph.nodes.find((node) => node.pageKey === 'users')
      ?? input.featureGraph.nodes[0];
    if (!graphNode) {
      failures.push('Feature graph has no nodes for runtime scope path resolution.');
    } else {
      runtimeScopePaths = resolveFeatureSearchRoots(graphNode);
      if (runtimeScopePaths.length === 0) {
        failures.push('Feature graph node produced no runtime scope paths.');
      }
    }
  }

  if (input?.sampleFiles?.length) {
    for (const sample of input.sampleFiles) {
      indexStructuralFile(sample.path, sample.content);
    }

    const scopePaths = runtimeScopePaths ?? ['src/shared/lib/appendoo'];
    const query = queryStructuralIntelligence('buildContextPackScaffold', scopePaths);
    if (query.symbols.length === 0 && query.references.length === 0) {
      failures.push('Structural query returned no symbols or references for sample fixture.');
    }

    const hybrid = hybridRetrieveFromCandidates({
      query: 'buildContextPackScaffold',
      applicationScopeRef: input.applicationScopeRef ?? 'platform:studio',
      candidates: query.symbols.map((symbol) => ({
        path: symbol.path,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        symbol: symbol.name,
        lexicalScore: 4,
        exactMatch: true,
      })),
      mode: 'hybrid',
    });

    if (hybrid.hits.length === 0) {
      failures.push('Hybrid retrieval returned no hits for exact symbol fixture.');
    }
    if (hybrid.exactMatchCount === 0) {
      failures.push('Hybrid retrieval did not prioritize exact symbol matches.');
    }
  }

  const codebaseHealth = getCodebaseIntelligenceHealth();
  const retrievalHealth = getSemanticRetrievalHealth();

  if (!codebaseHealth.intelligenceVersion) {
    failures.push('Missing codebase intelligence version.');
  }
  if (!retrievalHealth.retrievalVersion) {
    failures.push('Missing semantic retrieval version.');
  }

  if (input?.featureGraph && !input.featureGraph.version.trim()) {
    failures.push('Feature graph version missing for retrieval health probe.');
  }

  return {
    ok: failures.length === 0,
    codebaseVersion: codebaseHealth.intelligenceVersion,
    retrievalVersion: retrievalHealth.retrievalVersion,
    extractorCount: registry.extractors.length,
    failures,
  };
};
