import type { ApplicationScopeRef } from './applicationScope.types';
import type { ContextPack } from './contextPack.types';
import type { ChangeGraph } from './changeGraph.types';
import type {
  ArtifactAuthority,
  PlanningBlocker,
  PlanDecision,
  RequestedOutcome,
  ResolvedTargetBinding,
  SemanticPlanEvidenceMetrics,
  SemanticPlanStatus,
  UISemanticDesign,
} from './semanticPlanAuthority.types';

export type SemanticPlanArtifactKind =
  | 'server_function'
  | 'page'
  | 'component'
  | 'entity'
  | 'relation'
  | 'permission'
  | 'route'
  | 'workflow'
  | 'package_manifest'
  | 'configuration';

export type SemanticPlanArtifact = {
  artifactId: string;
  kind: SemanticPlanArtifactKind;
  title: string;
  action: 'create' | 'modify' | 'remove';
  targetRef?: string;
  evidenceIds: string[];
};

export type SemanticPlanCapabilityGap = {
  gapId: string;
  capabilityId: string;
  description: string;
  resolution: 'reuse' | 'adapt' | 'new_build' | 'unresolved';
};

export type SemanticPlanReuseSummary = {
  capabilityReuseRatio?: number;
  artifactReuseRatio?: number;
  changeScopeReuseRatio?: number;
  compositeReuseScore?: number;
};

export type SemanticPlanCompositionCandidate = {
  compositionCandidateId: string;
  requestedOutcomeRefs: string[];
  capabilityRefs: string[];
  providerBindings: string[];
  fitnessScore: number;
  trustScore: number;
  compositionContractVersion: string;
};

export type SemanticPlanValidationIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning';
};

export type SemanticPlanValidationResult = {
  ok: boolean;
  issues: SemanticPlanValidationIssue[];
};

/** AppEndO Semantic Plan — ASP (Phase 13). */
export type AppEndooSemanticPlan = {
  planId: string;
  revision: number;
  applicationScopeRef: string;
  contextPackId: string;
  objective: string;
  scope: string;
  resolvedTargets: string[];
  requirements: string[];
  assumptions: string[];
  nonGoals: string[];
  proposedArtifacts: SemanticPlanArtifact[];
  artifactModifications: SemanticPlanArtifact[];
  permissions: string[];
  requiredCapabilities: string[];
  capabilityGaps: SemanticPlanCapabilityGap[];
  appliedStandards: string[];
  selectedPatterns: string[];
  acceptanceCriteria: string[];
  risks: string[];
  conflicts: string[];
  reuseSummary?: SemanticPlanReuseSummary;
  requestedOutcomes?: string[];
  compositionCandidates?: SemanticPlanCompositionCandidate[];
  validation?: SemanticPlanValidationResult;
  changeGraphProposal?: ChangeGraph;
  createdAt: string;
  /** Authority maturity — scaffold plans must not acquire approval or execution authority. */
  authority?: ArtifactAuthority;
  status?: SemanticPlanStatus;
  producer?: 'scaffold' | 'server_function_ui_planner' | 'create_server_function_planner' | 'planner' | 'reverse_audit';
  resolvedTargetBindings?: ResolvedTargetBinding[];
  requestedOutcome?: RequestedOutcome;
  uiSemanticDesign?: UISemanticDesign;
  planDecisions?: PlanDecision[];
  blockingIssues?: PlanningBlocker[];
  validationFingerprint?: string;
  contextPackRevision?: number;
  evidenceMetrics?: SemanticPlanEvidenceMetrics;
  /**
   * V5 Phase P11 section V5-24 "why this plan" panel — audit trail of context items behind this plan,
   * distinguishing actually-`utilized` (cited by a `proposedArtifacts[].evidenceIds` entry) from
   * merely-discovered (present in the source `ContextPack.selectionExplanations` but never cited
   * by any artifact). See `planContextCitations.ts`.
   */
  contextItemRefs?: ContextItemRef[];
};

/** V5 Phase P11 § V5-24 — one citable context item behind a plan. */
export type ContextItemRef = {
  contextItemId: string;
  reasonCode: string;
  summary: string;
  utilized: boolean;
};

export type BuildSemanticPlanInput = {
  applicationScope: ApplicationScopeRef | null;
  contextPack: ContextPack;
  userPrompt?: string;
  intentId?: string;
};

export const SEMANTIC_PLAN_COMPILER_VERSION = '1.0.0';
