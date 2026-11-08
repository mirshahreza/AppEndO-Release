import type {
  HybridRetrievalCandidate,
  HybridRetrievalHit,
  HybridRetrievalMode,
  HybridRetrievalResult,
  SemanticDocument,
  SemanticRetrievalHealth,
  SemanticVectorRecord,
  SemanticVectorSearchHit,
  SemanticVectorSearchRequest,
} from '../../api/contracts/appendoo/semanticRetrieval.types';
import {
  HYBRID_RETRIEVAL_POLICY_VERSION,
  SEMANTIC_RETRIEVAL_VERSION,
} from '../../api/contracts/appendoo/semanticRetrieval.types';
import type { StructuralSymbolRef } from '../../api/contracts/appendoo/codebaseIntelligence.types';

const semanticDocuments = new Map<string, SemanticDocument>();
const semanticVectors = new Map<string, SemanticVectorRecord>();

export const resetSemanticRetrievalStoreForTests = (): void => {
  semanticDocuments.clear();
  semanticVectors.clear();
};

const hashText = (text: string): string => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return `doc-${Math.abs(hash)}`;
};

export const buildSemanticDocumentsFromSymbols = (
  symbols: StructuralSymbolRef[],
  applicationScopeRef: string,
): SemanticDocument[] => symbols.map((symbol) => {
  const body = `${symbol.kind} ${symbol.name} defined in ${symbol.path}:${symbol.startLine}`;
  const doc: SemanticDocument = {
    docId: `sem:${symbol.symbolId}`,
    kind: symbol.kind === 'component' ? 'COMPONENT_SUMMARY' : 'CODE_SYMBOL_SUMMARY',
    title: symbol.name,
    body,
    trust: 'EXTRACTED_CANDIDATE',
    contentHash: hashText(body),
    applicationScopeRef,
    sourceRefs: [symbol.path],
  };
  semanticDocuments.set(doc.docId, doc);
  return doc;
});

export const upsertSemanticVectorRecords = (records: SemanticVectorRecord[]): number => {
  for (const record of records) {
    semanticVectors.set(record.docId, record);
  }
  return records.length;
};

export const searchSemanticVectors = (
  request: SemanticVectorSearchRequest,
): SemanticVectorSearchHit[] => {
  const maxResults = request.maxResults ?? 10;
  const query = request.queryVector;
  if (query.length === 0) return [];

  const scored = [...semanticVectors.values()].map((record) => {
    const size = Math.min(query.length, record.vector.length);
    let dot = 0;
    for (let index = 0; index < size; index += 1) {
      dot += query[index]! * record.vector[index]!;
    }
    return {
      docId: record.docId,
      score: dot,
      contentHash: record.contentHash,
    };
  });

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults);
};

export const rankHybridRetrievalHits = (
  query: string,
  candidates: HybridRetrievalCandidate[],
  mode: HybridRetrievalMode = 'hybrid',
): HybridRetrievalHit[] => {
  const normalizedQuery = query.trim().toLowerCase();

  const ranked = candidates.map((candidate) => {
    const exactMatch = candidate.exactMatch
      ?? Boolean(candidate.symbol && candidate.symbol.toLowerCase() === normalizedQuery);
    const vectorScore = mode === 'exact' ? 0 : (candidate.vectorScore ?? 0);
    const lexicalScore = mode === 'semantic' ? 0 : candidate.lexicalScore;
    const exactBoost = exactMatch ? 100 : 0;
    const finalScore = exactBoost + lexicalScore + vectorScore;

    return {
      docId: `${candidate.path}:${candidate.startLine}`,
      path: candidate.path,
      startLine: candidate.startLine,
      endLine: candidate.endLine,
      symbol: candidate.symbol,
      vectorScore,
      lexicalScore,
      exactMatch,
      finalScore,
      trust: candidate.trust ?? 'EXTRACTED_CANDIDATE',
      sourceRefs: candidate.sourceRefs ?? [candidate.path],
    } satisfies HybridRetrievalHit;
  });

  return ranked
    .filter((hit) => hit.finalScore > 0 || mode === 'hybrid')
    .sort((left, right) => right.finalScore - left.finalScore || Number(right.exactMatch) - Number(left.exactMatch));
};

export const hybridRetrieveFromCandidates = (input: {
  query: string;
  applicationScopeRef: string;
  candidates: HybridRetrievalCandidate[];
  mode?: HybridRetrievalMode;
  maxResults?: number;
}): HybridRetrievalResult => {
  const mode = input.mode ?? 'hybrid';
  const hits = rankHybridRetrievalHits(input.query, input.candidates, mode)
    .slice(0, input.maxResults ?? 20);

  return {
    query: input.query,
    mode,
    applicationScopeRef: input.applicationScopeRef,
    hits,
    exactMatchCount: hits.filter((hit) => hit.exactMatch).length,
    policyVersion: HYBRID_RETRIEVAL_POLICY_VERSION,
  };
};

export const getSemanticRetrievalHealth = (): SemanticRetrievalHealth => ({
  retrievalVersion: SEMANTIC_RETRIEVAL_VERSION,
  policyVersion: HYBRID_RETRIEVAL_POLICY_VERSION,
  documentCount: semanticDocuments.size,
  indexedVectorCount: semanticVectors.size,
  staleVectorCount: 0,
});

export const listSemanticDocuments = (): SemanticDocument[] => [...semanticDocuments.values()];

export const formatHybridHitEvidence = (hit: HybridRetrievalHit): string => (
  `${hit.path}:${hit.startLine}${hit.symbol ? `#${hit.symbol}` : ''}`
);
