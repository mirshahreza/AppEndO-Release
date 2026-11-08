import type { HybridRetrievalMode, HybridRetrievalResult } from '../../../shared/api/contracts/appendoo/semanticRetrieval.types';
import { searchCodeChunks } from '../../../core/ai/tools/native/codeChunkIndex';
import { resolveFeatureSearchRoots } from '../../../shared/lib/featureGraphStore';
import type { FeatureGraphNode } from '../../../shared/lib/aiIndexCodegen';
import {
  buildSemanticDocumentsFromSymbols,
  formatHybridHitEvidence,
  hybridRetrieveFromCandidates,
} from '../../../shared/lib/appendoo/semanticRetrievalScaffold';
import {
  findSymbol,
  getCodebaseIntelligenceHealth,
  getSourceSlice,
  indexStructuralFile,
  queryStructuralIntelligence,
  resetCodebaseStructuralIndexForTests,
} from '../../../shared/lib/appendoo/codebaseStructuralScaffold';
import { getSemanticRetrievalHealth, resetSemanticRetrievalStoreForTests } from '../../../shared/lib/appendoo/semanticRetrievalScaffold';
import { embedTextLocally, cosineSimilarity } from '../../../shared/lib/appendoo/localLexicalVectorProvider';

/** V5 P05 § V5-7 Stage F — real vectorScore weight in the exactBoost+lexicalScore+vectorScore
 * formula (`rankHybridRetrievalHits`). Kept modest relative to `lexicalScore` (structural
 * symbols score 12, chunk matches vary) so this phase's real-but-lexical vector signal nudges
 * ranking rather than dominating it — a neural embedding provider swapped in later (same
 * `VectorProvider` interface) could reasonably use a different weight. */
const VECTOR_SCORE_WEIGHT = 4;

export type HybridRetrieveInput = {
  query: string;
  applicationScopeRef: string;
  scopePaths?: string[];
  mode?: HybridRetrievalMode;
  maxResults?: number;
};

export class CodebaseRetrievalService {
  hybridRetrieve(input: HybridRetrieveInput): HybridRetrievalResult {
    const scopePaths = input.scopePaths;
    const structural = queryStructuralIntelligence(input.query, scopePaths);
    const chunkMatches = searchCodeChunks(
      input.query,
      scopePaths,
      input.maxResults ?? 20,
    );

    // V5 P05 § V5-7 Stage F — real vectorScore, populated for the first time (previously
    // structurally always 0 — doc § 7.1 cited evidence). Local lexical-hash cosine similarity
    // (see localLexicalVectorProvider.ts doc comment) between the query and each candidate's
    // real text (symbol name+kind, or actual chunk source content).
    const queryVector = embedTextLocally(input.query);

    const candidates = [
      ...structural.symbols.map((symbol) => ({
        path: symbol.path,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        symbol: symbol.name,
        lexicalScore: 12,
        vectorScore: cosineSimilarity(queryVector, embedTextLocally(`${symbol.kind} ${symbol.name}`)) * VECTOR_SCORE_WEIGHT,
        exactMatch: symbol.name === input.query.trim(),
        sourceRefs: [symbol.path],
      })),
      ...chunkMatches.map((chunk) => ({
        path: chunk.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbol: chunk.symbol,
        lexicalScore: chunk.score ?? 1,
        // `searchCodeChunks` intentionally strips chunk `.text` from its public result (memory/
        // token-budget reasons) — embed the path+symbol instead, still real signal (distinct
        // from the always-0 baseline this phase fixes), just coarser than full chunk content.
        vectorScore: cosineSimilarity(queryVector, embedTextLocally(`${chunk.symbol ?? ''} ${chunk.path}`)) * VECTOR_SCORE_WEIGHT,
        exactMatch: chunk.symbol === input.query.trim(),
        sourceRefs: [chunk.path],
      })),
    ];

    const result = hybridRetrieveFromCandidates({
      query: input.query,
      applicationScopeRef: input.applicationScopeRef,
      candidates,
      mode: input.mode ?? 'hybrid',
      maxResults: input.maxResults,
    });

    buildSemanticDocumentsFromSymbols(structural.symbols, input.applicationScopeRef);
    return result;
  }

  enrichStructuralEvidence(input: {
    query?: string;
    applicationScopeRef: string;
    scopePaths?: string[];
    maxResults?: number;
  }): string[] {
    const query = input.query?.trim();
    if (!query) return [];

    const retrieval = this.hybridRetrieve({
      query,
      applicationScopeRef: input.applicationScopeRef,
      scopePaths: input.scopePaths,
      maxResults: input.maxResults ?? 5,
      mode: 'hybrid',
    });

    return retrieval.hits.map(formatHybridHitEvidence);
  }

  resolveScopePathsFromFeatureNode(node: FeatureGraphNode): string[] {
    return resolveFeatureSearchRoots(node);
  }

  indexFile(path: string, content: string) {
    return indexStructuralFile(path, content);
  }

  findSymbol(name: string, scopePaths?: string[]) {
    return findSymbol(name, scopePaths);
  }

  getSourceSlice(path: string, startLine: number, endLine: number) {
    return getSourceSlice(path, startLine, endLine);
  }

  getHealth() {
    return {
      codebase: getCodebaseIntelligenceHealth(),
      retrieval: getSemanticRetrievalHealth(),
    };
  }

  resetForTests(): void {
    resetCodebaseStructuralIndexForTests();
    resetSemanticRetrievalStoreForTests();
  }
}

export const codebaseRetrievalService = new CodebaseRetrievalService();
