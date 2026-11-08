/** Governed engineering knowledge trust levels (Phase 09). */
export type KnowledgeTrustLevel =
  | 'PLATFORM_VERIFIED'
  | 'ARCHITECT_APPROVED'
  | 'EXTRACTED_CANDIDATE'
  | 'AI_INFERRED';

/** Engineering knowledge record kinds (Phase 09). */
export type KnowledgeKind =
  | 'STANDARD'
  | 'PATTERN'
  | 'EXAMPLE'
  | 'ANTI_PATTERN'
  | 'CONSTRAINT'
  | 'BUILDER_GUIDANCE'
  | 'VERIFICATION_GUIDANCE';

export type KnowledgeSourceType = 'project_standards';

export type EngineeringKnowledgeRecord = {
  recordId: string;
  kind: KnowledgeKind;
  trust: KnowledgeTrustLevel;
  title: string;
  statement: string;
  appliesTo: string[];
  sourceType: KnowledgeSourceType;
  sourceId: string;
  sourceVersion: string;
  updatedAt: string;
};

export type EngineeringKnowledgeRegistryHealth = {
  registryVersion: string;
  sourceVersion: string;
  updatedAt: string;
  recordCount: number;
  normativeCount: number;
};

export type FindStandardsOptions = {
  query?: string;
  appliesTo?: string;
  maxResults?: number;
  normativeOnly?: boolean;
};

export const ENGINEERING_KNOWLEDGE_REGISTRY_VERSION = '1.0.0';
