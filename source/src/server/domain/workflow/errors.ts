/**
 * Canonical Workflow machine-error registry — sole authority per
 * docs/standards/workflow-engine-testing.md
 * sections 14 and 30. Every code exists exactly once. Clients/tests
 * branch on `code`, never on `message` text.
 */
export const WORKFLOW_ERROR_REGISTRY = {
  // doc 03 section 14
  ACTION_OUTCOME_UNKNOWN: 'WF_ACTION_OUTCOME_UNKNOWN',
  ACTION_IMPLEMENTATION_UNAVAILABLE: 'WF_ACTION_IMPLEMENTATION_UNAVAILABLE',
  WORKFLOW_PAYLOAD_LIMIT_EXCEEDED: 'WF_EXEC_PAYLOAD_LIMIT_EXCEEDED',
  ENGINE_INVARIANT: 'WF_EXEC_ENGINE_INVARIANT',
  MISSING_CANONICAL_PLATFORM_CONTRACT: 'WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT',
  PATH_ENUMERATION_TRUNCATED: 'WF_SIM_PATH_ENUMERATION_TRUNCATED',
  AMBIGUOUS_DECISION_VALIDATION: 'WF_DEF_AMBIGUOUS_DECISION',
  AMBIGUOUS_DECISION_RUNTIME: 'WF_EXEC_AMBIGUOUS_DECISION',
  ACTION_IDEMPOTENCY_INCOMPATIBLE: 'WF_ACTION_IDEMPOTENCY_INCOMPATIBLE',

  // doc 03 section 30
  DEF_INVALID_AWM: 'WF_DEF_INVALID_AWM',
  DEF_INVALID_EDGE_SHAPE: 'WF_DEF_INVALID_EDGE_SHAPE',
  DEF_INVALID_REFERENCE: 'WF_DEF_INVALID_REFERENCE',
  DEF_INVALID_PARALLEL_STRUCTURE: 'WF_DEF_INVALID_PARALLEL_STRUCTURE',
  DEF_INVALID_RETRY_POLICY: 'WF_DEF_INVALID_RETRY_POLICY',
  DEF_STALE_DRAFT_VERSION: 'WF_DEF_STALE_DRAFT_VERSION',
  DEF_STALE_REVISION_VERSION: 'WF_DEF_STALE_REVISION_VERSION',
  DEF_NOT_STARTABLE: 'WF_DEF_NOT_STARTABLE',
  DEF_ACTION_UNAVAILABLE: 'WF_DEF_ACTION_UNAVAILABLE',
  EXEC_STALE_STATE_VERSION: 'WF_EXEC_STALE_STATE_VERSION',
  EXEC_INSTANCE_NOT_EXECUTABLE: 'WF_EXEC_INSTANCE_NOT_EXECUTABLE',
  EXEC_NODE_NOT_ELIGIBLE: 'WF_EXEC_NODE_NOT_ELIGIBLE',
  EXEC_EXPRESSION_FAILED: 'WF_EXEC_EXPRESSION_FAILED',
  EXEC_ACTION_OUTPUT_INVALID: 'WF_EXEC_ACTION_OUTPUT_INVALID',
  EXEC_WAIT_NOT_ACTIVE: 'WF_EXEC_WAIT_NOT_ACTIVE',
  EXEC_WORK_ITEM_NOT_ACTIVE: 'WF_EXEC_WORK_ITEM_NOT_ACTIVE',
  EXEC_WORK_ITEM_OUTCOME_INVALID: 'WF_EXEC_WORK_ITEM_OUTCOME_INVALID',
  EXEC_ASSIGNMENT_RESOLUTION_FAILED: 'WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED',
  EXEC_UNHANDLED_NODE_FAILURE: 'WF_EXEC_UNHANDLED_NODE_FAILURE',
  EXEC_SUBFLOW_FAILED: 'WF_EXEC_SUBFLOW_FAILED',
  EXEC_SUBFLOW_CANCELLED: 'WF_EXEC_SUBFLOW_CANCELLED',
  /** WFV2-4 — self-referencing SUBFLOW recursion depth guardrail (policies.limits.maxSubflowRecursionDepth). */
  EXEC_SUBFLOW_RECURSION_LIMIT_EXCEEDED: 'WF_EXEC_SUBFLOW_RECURSION_LIMIT_EXCEEDED',
  /** WFV2-2 — a FOR_EACH node's `items` expression evaluated to something other than a JSON array. */
  EXEC_FOR_EACH_ITEMS_NOT_ARRAY: 'WF_EXEC_FOR_EACH_ITEMS_NOT_ARRAY',
  /** WFV2-2 — a FOR_EACH node's runtime-evaluated `items` array exceeded `policies.limits.maxForEachItems`. */
  EXEC_FOR_EACH_ITEM_LIMIT_EXCEEDED: 'WF_EXEC_FOR_EACH_ITEM_LIMIT_EXCEEDED',
  /** In-process LOOP hit `maxIterations` / `policies.limits.maxLoopIterations` while the condition was still true. */
  EXEC_LOOP_LIMIT_EXCEEDED: 'WF_EXEC_LOOP_LIMIT_EXCEEDED',
  /** HWF-1.2 — a WORK_ITEM completion's `output` does not satisfy the node's `outputSchema` (same `validateAgainstJsonSchema` gate `EXEC_ACTION_OUTPUT_INVALID` already uses for ACTION outputs). */
  EXEC_WORK_ITEM_OUTPUT_INVALID: 'WF_EXEC_WORK_ITEM_OUTPUT_INVALID',
  /** HWF-4.5 — the completed outcome is listed in the node's `requireReasonOutcomes`, but `output.reason` is missing/blank. */
  EXEC_WORK_ITEM_REASON_REQUIRED: 'WF_EXEC_WORK_ITEM_REASON_REQUIRED',
  AUTH_FORBIDDEN: 'WF_AUTH_FORBIDDEN',
  SIM_INVALID_SOURCE: 'WF_SIM_INVALID_SOURCE',
  SIM_MISSING_FIXTURE: 'WF_SIM_MISSING_FIXTURE',
} as const;

export type WorkflowMachineErrorCode = (typeof WORKFLOW_ERROR_REGISTRY)[keyof typeof WORKFLOW_ERROR_REGISTRY];

export class WorkflowDomainError extends Error {
  readonly code: WorkflowMachineErrorCode;

  readonly details?: Record<string, unknown>;

  constructor(code: WorkflowMachineErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'WorkflowDomainError';
    this.code = code;
    this.details = details;
  }
}

export const isWorkflowDomainError = (error: unknown): error is WorkflowDomainError =>
  error instanceof WorkflowDomainError;
