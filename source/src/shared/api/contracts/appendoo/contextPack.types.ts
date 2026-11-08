import type { ApplicationScopeRef } from './applicationScope.types';
import type { EngineeringKnowledgeRecord } from './knowledgeRegistry.types';

/** Explainability reason codes (Phase 12). */
export type ContextSelectionReasonCode =
  | 'EXACT_TARGET'
  | 'DOMAIN_TERM'
  | 'GRAPH_DEPENDENCY'
  | 'GOVERNING_DECISION'
  | 'DIRECT_CALLER'
  | 'DIRECT_CALLEE'
  | 'DATA_READ'
  | 'DATA_WRITE'
  | 'PERMISSION'
  | 'STANDARD'
  | 'TRUSTED_PATTERN'
  | 'SIMILAR_FEATURE'
  | 'PRIOR_CHANGE'
  | 'CAPABILITY'
  | 'USER_PINNED'
  | 'PAGE_CONTEXT';

export type ContextSelectionExplanation = {
  reasonCode: ContextSelectionReasonCode;
  evidenceId: string;
  summary: string;
};

export type ContextPackTargetKind =
  | 'page'
  | 'function'
  | 'layout'
  | 'package'
  | 'artifact'
  | 'portal';

export type ContextPackTarget = {
  targetId: string;
  kind: ContextPackTargetKind;
  label: string;
  ref?: string;
};

export type ContextPackIndexVersions = {
  codebaseIndex?: string;
  featureGraph?: string;
  knowledgeRegistry: string;
  retrievalPolicy: string;
  decisionMemory?: string;
  capabilitySnapshot?: string;
};

/** Versioned bounded context for planning (Phase 12). */
export type ContextPack = {
  contextPackId: string;
  revision: number;
  applicationScopeRef: string;
  intentId?: string;
  correlationId?: string;
  indexVersions: ContextPackIndexVersions;
  tokenBudget: number;
  primaryTargets: ContextPackTarget[];
  dependencies: ContextPackTarget[];
  governance: string[];
  businessRules: string[];
  permissions: string[];
  structuralEvidence: string[];
  similarImplementations: string[];
  trustedPatterns: string[];
  engineeringStandards: EngineeringKnowledgeRecord[];
  capabilityEvidence: string[];
  capabilityGaps: string[];
  relevantChanges: string[];
  excludedCandidates: string[];
  unresolvedTerms: string[];
  conflicts: string[];
  selectionExplanations: ContextSelectionExplanation[];
  /** Set when hard-inclusion items exceed tokenBudget (Phase 12). */
  overflow?: 'CONTEXT_OVERFLOW';
  /**
   * V5 Phase P04 § 6.2 — per-subsystem SUCCESS/FAILED status for the retrieval steps behind
   * `structuralEvidence`/`similarImplementations`/`indexVersions.codebaseIndex` (feature graph
   * load, scope-path resolution, structural/hybrid retrieval). Optional/additive — absent means
   * this `ContextPack` was built before P04 wiring (or by a path that doesn't populate it yet).
   * An empty `structuralEvidence` array with `retrievalHealth.structuralEvidence.status ===
   * 'SUCCESS'` means "genuinely nothing relevant found"; `'FAILED'` means the subsystem threw.
   */
  retrievalHealth?: {
    featureGraph: 'SUCCESS' | 'FAILED';
    scopePaths: 'SUCCESS' | 'FAILED';
    structuralEvidence: 'SUCCESS' | 'FAILED';
  };
};

export type BuildContextPackInput = {
  applicationScope: ApplicationScopeRef | null;
  pageContext?: {
    path?: string;
    pageLabel?: string;
    pageKey?: string;
    functionId?: string | null;
    functionName?: string;
    layoutId?: string | null;
    entityType?: string;
    activeSectionId?: string;
  };
  userPrompt?: string;
  intentId?: string;
  correlationId?: string;
  featureGraphVersion?: string;
  knowledgeRegistryVersion?: string;
  tokenBudget?: number;
};

export const CONTEXT_PACK_BUILDER_VERSION = '1.1.0';
export const DEFAULT_CONTEXT_PACK_TOKEN_BUDGET = 8_000;
export const CONTEXT_RETRIEVAL_POLICY_VERSION = '1.0.0';
