export const CODEBASE_INTELLIGENCE_VERSION = '1.0.0';
export const CODEBASE_EXTRACTOR_REGISTRY_VERSION = '1.0.0';

export type CodebaseExtractorKind =
  | 'server_function_registration'
  | 'experience_route'
  | 'designer_binding'
  | 'api_query_usage'
  | 'permission_check'
  | 'package_dependency'
  | 'edge_db_router'
  | 'control_plane_repository';

export type CodebaseExtractorDescriptor = {
  extractorId: string;
  kind: CodebaseExtractorKind;
  version: string;
  description: string;
};

export type StructuralSymbolKind = 'function' | 'class' | 'const' | 'type' | 'component';

export type StructuralSymbolRef = {
  symbolId: string;
  name: string;
  kind: StructuralSymbolKind;
  path: string;
  startLine: number;
  endLine: number;
};

export type SourceSlice = {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
};

export type StructuralQueryResult = {
  query: string;
  symbols: StructuralSymbolRef[];
  references: StructuralSymbolRef[];
};

export type CodebaseIntelligenceHealth = {
  intelligenceVersion: string;
  extractorRegistryVersion: string;
  extractorCount: number;
  indexedSymbolCount: number;
  staleFileCount: number;
};

export type IncrementalIndexFileRecord = {
  path: string;
  contentHash: string;
  indexedAt: string;
  symbolCount: number;
};
