import type { KnowledgeTrustLevel } from './knowledgeRegistry.types';

export const SEMANTIC_RETRIEVAL_VERSION = '1.0.0';
export const HYBRID_RETRIEVAL_POLICY_VERSION = '1.0.0';

export type SemanticDocumentKind =
  | 'ENTITY_SUMMARY'
  | 'SERVER_FUNCTION_SUMMARY'
  | 'PAGE_SUMMARY'
  | 'COMPONENT_SUMMARY'
  | 'CODE_SYMBOL_SUMMARY'
  | 'SOURCE_CODE_SLICE'
  | 'STANDARD'
  | 'PATTERN';

export type SemanticDocument = {
  docId: string;
  kind: SemanticDocumentKind;
  title: string;
  body: string;
  trust: KnowledgeTrustLevel;
  contentHash: string;
  applicationScopeRef: string;
  sourceRefs: string[];
};

export type HybridRetrievalMode = 'exact' | 'semantic' | 'hybrid';

export type HybridRetrievalCandidate = {
  path: string;
  startLine: number;
  endLine: number;
  symbol?: string;
  lexicalScore: number;
  vectorScore?: number;
  exactMatch?: boolean;
  trust?: KnowledgeTrustLevel;
  sourceRefs?: string[];
};

export type HybridRetrievalHit = {
  docId: string;
  path: string;
  startLine: number;
  endLine: number;
  symbol?: string;
  vectorScore: number;
  lexicalScore: number;
  exactMatch: boolean;
  finalScore: number;
  trust: KnowledgeTrustLevel;
  sourceRefs: string[];
};

export type HybridRetrievalResult = {
  query: string;
  mode: HybridRetrievalMode;
  applicationScopeRef: string;
  hits: HybridRetrievalHit[];
  exactMatchCount: number;
  policyVersion: string;
};

export type SemanticRetrievalHealth = {
  retrievalVersion: string;
  policyVersion: string;
  documentCount: number;
  indexedVectorCount: number;
  staleVectorCount: number;
};

export type EmbeddingProviderCapabilities = {
  providerId: string;
  supportsBatch: boolean;
  dimensions: number;
};

export type EmbeddingProviderRequest = {
  texts: string[];
  modelId?: string;
};

export type EmbeddingProviderResult = {
  vectors: number[][];
  modelId: string;
};

export type EmbeddingProvider = {
  getCapabilities(): EmbeddingProviderCapabilities;
  embedDocuments(request: EmbeddingProviderRequest): Promise<EmbeddingProviderResult>;
  embedQuery(text: string, modelId?: string): Promise<number[]>;
};

export type SemanticVectorRecord = {
  docId: string;
  contentHash: string;
  vector: number[];
  updatedAt: string;
};

export type SemanticVectorSearchRequest = {
  queryVector: number[];
  applicationScopeRef: string;
  maxResults?: number;
};

export type SemanticVectorSearchHit = {
  docId: string;
  score: number;
  contentHash: string;
};
