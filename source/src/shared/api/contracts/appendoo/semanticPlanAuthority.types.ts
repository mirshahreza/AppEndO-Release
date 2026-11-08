/** Artifact maturity — scaffold outputs must never acquire executable authority. */
export type ArtifactAuthority =
  | 'SCAFFOLD'
  | 'INFERRED'
  | 'EVIDENCE_BACKED'
  | 'VALIDATED'
  | 'APPROVED';

export type SemanticPlanStatus =
  | 'DRAFT'
  | 'RESOLVING'
  | 'NEEDS_CLARIFICATION'
  | 'CONTEXT_BLOCKED'
  | 'PLANNING'
  | 'VALIDATING'
  | 'INVALID'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'STALE'
  | 'SUPERSEDED';

export type PlanningBlockerCode =
  | 'PLANNING_NOT_IMPLEMENTED'
  | 'CONTEXT_NOT_SUFFICIENT'
  | 'TARGET_NOT_FOUND'
  | 'AMBIGUOUS_TARGET'
  | 'UNRESOLVED_OUTCOME'
  | 'CONFLICTING_AUTHORITY'
  | 'MISSING_REQUIRED_CONTEXT'
  | 'CAPABILITY_GAP'
  | 'SEMANTIC_DESIGN_INCOMPLETE'
  | 'CHANGE_GRAPH_COMPILE_FORBIDDEN'
  | 'BUILDER_INPUT_INSUFFICIENT'
  /** V5 Phase P11 § V5-18 — independent, deterministic critic-check rejection of a target binding. */
  | 'CRITIC_TARGET_BINDING_REJECTED';

export type PlanningBlockerStage = 'INTENT' | 'CONTEXT' | 'COMPOSITION' | 'PLANNING';

export type ClarificationOption = {
  optionId: string;
  label: string;
  value: string;
};

export type PlanningBlocker = {
  code: PlanningBlockerCode;
  stage: PlanningBlockerStage;
  materiality: 'BLOCKING' | 'NON_BLOCKING';
  question?: string;
  options?: ClarificationOption[];
  evidenceRefs: string[];
};

export type PlanActionPolicy = {
  canApprove: boolean;
  canRevise: boolean;
  canExecute: boolean;
  blockingReasonCodes: string[];
};

export type ResolvedTargetBinding = {
  artifactRef: {
    targetKind: 'function' | 'page' | 'component' | 'configuration';
    targetId: string;
    ref?: string;
  };
  artifactType: 'SERVER_FUNCTION' | 'PAGE' | 'COMPONENT' | 'CONFIGURATION';
  canonicalId: string;
  versionOrFingerprint: string;
  resolutionMethod: string;
  evidenceRefs: string[];
  confidence: number;
};

export type RequestedOutcome = {
  actor?: string;
  goal: string;
  successMeaning: string;
  interactionExpectation?: string;
  confidence: number;
  evidenceRefs: string[];
};

export type BoundOperation = {
  serverFunctionRef: {
    targetKind: 'function';
    targetId: string;
    ref: string;
  };
  fingerprint: string;
  inputContractRef: string;
  outputContractRef: string;
  errorContractRefs: string[];
  permissionRefs: string[];
};

export type UIInputBinding = {
  fieldId: string;
  contractPath: string;
  label: string;
  required: boolean;
  excluded?: boolean;
  exclusionReason?: string;
};

export type UIOutputBinding = {
  outputId: string;
  contractPath: string;
  renderAs: 'text' | 'table' | 'json' | 'badge';
};

export type UIStateSpec = {
  label: string;
  userVisibleMessage: string;
  evidenceRefs: string[];
};

export type UIActionSpec = {
  actionId: string;
  label: string;
  trigger: 'submit' | 'reset' | 'retry';
  evidenceRefs: string[];
};

export type PermissionBinding = {
  permissionId: string;
  behavior: 'hide' | 'disable' | 'show_denied';
  evidenceRefs: string[];
};

export type UISemanticDesign = {
  purpose: string;
  userOutcome: string;
  boundOperations: BoundOperation[];
  interactionModel: {
    trigger: string;
    inputFlow: string[];
    submissionBehavior: string;
    resultBehavior: string;
  };
  inputBindings: UIInputBinding[];
  outputBindings: UIOutputBinding[];
  states: {
    initial: UIStateSpec;
    loading: UIStateSpec;
    success: UIStateSpec;
    empty?: UIStateSpec;
    validationError: UIStateSpec;
    operationError: UIStateSpec;
    permissionDenied?: UIStateSpec;
  };
  actions: UIActionSpec[];
  placement: {
    artifactKind: 'PAGE' | 'COMPONENT';
    portal?: string;
    route?: string;
    parentContext?: ResolvedTargetBinding['artifactRef'];
    rationale: string;
  };
  permissions: PermissionBinding[];
  responsiveRequirements: string[];
  accessibilityRequirements: string[];
  rtlRequirements?: string[];
  evidenceRefs: string[];
};

export type PlanDecision = {
  decisionId: string;
  kind: string;
  value: unknown;
  evidenceRefs: string[];
  inferenceClass: 'DETERMINISTIC' | 'HUMAN_AUTHORITY' | 'AI_INFERENCE';
};

export type SemanticPlanEvidenceMetrics = {
  materialDecisionEvidenceCoverage: number;
  requirementTraceCoverage: number;
  targetBindingCoverage: number;
  acceptanceCriterionTraceCoverage: number;
};

export type GoldenEvalEvidence = {
  scenarioId: string;
  prompt: string;
  intentSnapshot: unknown;
  contextPackSnapshot: unknown;
  planSnapshot: unknown;
  validationReport: unknown;
  changeGraphSnapshot?: unknown;
  stageMetrics: Record<string, number>;
  failureCodes: string[];
};

export const MIN_AUTHORITY_FOR_APPROVAL: ArtifactAuthority[] = ['VALIDATED', 'APPROVED'];
export const MIN_AUTHORITY_FOR_COMPILE: ArtifactAuthority[] = ['VALIDATED', 'APPROVED'];
export const MIN_AUTHORITY_FOR_EXECUTE: ArtifactAuthority[] = ['APPROVED'];
