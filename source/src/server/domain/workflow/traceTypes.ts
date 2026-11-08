/**
 * Canonical WorkflowTrace V1 type registry — sole authority per
 * docs/standards/workflow-engine-testing.md
 * sections 12 and 29. Closed set; later additions require a new
 * registered payload schema version and cannot reinterpret V1.
 *
 * Slice 1 scope: type/authority registry only. Emission call sites
 * (actually writing WorkflowTrace rows during execution) belong to
 * later delivery slices per doc 11 section 1.
 */
export const WORKFLOW_TRACE_TYPES = [
  'INSTANCE_STARTED',
  'INSTANCE_SUSPENDED',
  'INSTANCE_RESUMED',
  'INSTANCE_CANCELLED',
  'INSTANCE_SUCCEEDED',
  'INSTANCE_FAILED',
  'NODE_READY',
  'NODE_CLAIMED',
  'EXPRESSION_EVALUATED',
  'EDGE_SELECTED',
  'PARALLEL_SPLIT_CREATED',
  'PARALLEL_JOIN_ARRIVAL',
  'PARALLEL_JOIN_WON',
  'PARALLEL_SIBLINGS_CANCELLED',
  'ACTION_RESOLVED',
  'ACTION_ATTEMPT_STARTED',
  'ACTION_ATTEMPT_SUCCEEDED',
  'ACTION_ATTEMPT_FAILED',
  'ACTION_ATTEMPT_TIMED_OUT',
  'ACTION_ATTEMPT_UNKNOWN',
  'ACTION_ATTEMPT_CANCELLED',
  'ACTION_RETRY_SCHEDULED',
  'RECOVERY_CLAIMED',
  'WAIT_CREATED',
  'WAIT_SATISFIED',
  'WAIT_EXPIRED',
  'WAIT_CANCELLED',
  'EVENT_CORRELATED',
  'EVENT_FINAL_UNMATCHED',
  'WORK_ITEM_CREATED',
  'WORK_ITEM_CLAIMED',
  'WORK_ITEM_REASSIGNED',
  'WORK_ITEM_COMPLETED',
  'WORK_ITEM_CANCELLED',
  'WORK_ITEM_FAILED',
  'WORK_ITEM_ESCALATION_STARTED',
  'WORK_ITEM_ESCALATION_SUCCEEDED',
  'WORK_ITEM_ESCALATION_FAILED',
  'SUBFLOW_STARTED',
  'SUBFLOW_COMPLETED',
  'LATE_ACTION_RESULT_IGNORED',
  'ENGINE_INVARIANT',
  /** WFV2-14 — Saga/compensation (F-6). */
  'COMPENSATION_STARTED',
  'COMPENSATION_SUCCEEDED',
  'COMPENSATION_FAILED',
  'SAGA_COMPENSATION_COMPLETED',
] as const;

export type WorkflowTraceType = (typeof WORKFLOW_TRACE_TYPES)[number];

export const isWorkflowTraceType = (value: string): value is WorkflowTraceType =>
  (WORKFLOW_TRACE_TYPES as readonly string[]).includes(value);

/** Base core-evidence fields every V1 trace payload carries (doc 03 section 29, opening paragraph). */
export type WorkflowTraceCoreEvidenceBase = {
  workflowRevisionId: string;
  nodeKey?: string;
  edgeKey?: string;
  waitId?: string;
  workItemId?: string;
  attemptId?: string;
  branchTokenId?: string;
};

/**
 * Mandatory additional causal fields per trace type (doc 03 section 29). Slice 1 registers the
 * shape/typing authority; emission (constructing and persisting these payloads at runtime) is a
 * later delivery slice.
 */
export type WorkflowTracePayloadMapV1 = {
  INSTANCE_STARTED: WorkflowTraceCoreEvidenceBase & {
    startType: string;
    startedByType: string;
    startedByRef: string;
    inputSchemaIdentity: string;
    inputSchemaFingerprint: string;
  };
  EXPRESSION_EVALUATED: WorkflowTraceCoreEvidenceBase & {
    expressionFingerprint: string;
    evaluationContextFingerprints: string[];
    result: { kind: 'VALUE'; typedResult: unknown } | { kind: 'FAILURE'; failureCode: string };
  };
  EDGE_SELECTED: WorkflowTraceCoreEvidenceBase & {
    sourceNodeKey: string;
    selectionMode: string;
    selectionReason: string;
    selectedEdgeKey: string;
  };
  ACTION_RESOLVED: WorkflowTraceCoreEvidenceBase & {
    actionKey: string;
    actionVersion: string;
    actionFingerprint: string;
    bindingMode: 'CAPABILITY_RESOLVED' | 'EXACT_PROVIDER';
    policyVersion: string;
    selectedProviderId: string;
    selectedProviderVersion: string;
    selectedProviderFingerprint: string;
    rejectedHigherRankedReasons: string[];
  };
  ACTION_ATTEMPT_STARTED: WorkflowTraceCoreEvidenceBase & {
    logicalInvocationId: string;
    attemptNumber: number;
    idempotencyKeyFingerprint: string;
    providerIdentity: string;
  };
  ACTION_ATTEMPT_SUCCEEDED: WorkflowTraceCoreEvidenceBase & {
    logicalInvocationId: string;
    attemptNumber: number;
    idempotencyKeyFingerprint: string;
    providerIdentity: string;
  };
  ACTION_ATTEMPT_FAILED: WorkflowTraceCoreEvidenceBase & {
    logicalInvocationId: string;
    attemptNumber: number;
    idempotencyKeyFingerprint: string;
    providerIdentity: string;
    machineErrorCode: string;
  };
  ACTION_ATTEMPT_TIMED_OUT: WorkflowTraceCoreEvidenceBase & {
    logicalInvocationId: string;
    attemptNumber: number;
    idempotencyKeyFingerprint: string;
    providerIdentity: string;
  };
  ACTION_ATTEMPT_UNKNOWN: WorkflowTraceCoreEvidenceBase & {
    logicalInvocationId: string;
    attemptNumber: number;
    idempotencyKeyFingerprint: string;
    providerIdentity: string;
    machineErrorCode: string;
  };
  ACTION_ATTEMPT_CANCELLED: WorkflowTraceCoreEvidenceBase & {
    logicalInvocationId: string;
    attemptNumber: number;
    idempotencyKeyFingerprint: string;
    providerIdentity: string;
  };
  ACTION_RETRY_SCHEDULED: WorkflowTraceCoreEvidenceBase & {
    attemptNumber: number;
    matchedRetrySelectorIdentity: string;
    nextEligibleAt: string;
  };
  WAIT_CREATED: WorkflowTraceCoreEvidenceBase & {
    waitType: string;
    owningNodeKey: string;
    dueAt?: string;
    timeoutAt?: string;
    eventName?: string;
    correlationEncoderVersion?: string;
    correlationHashAlgorithm?: string;
  };
  WAIT_SATISFIED: WorkflowTraceCoreEvidenceBase & { waitType: string; priorWaitVersion: number; winnerReason: string; owningNodeKey: string };
  WAIT_EXPIRED: WorkflowTraceCoreEvidenceBase & { waitType: string; priorWaitVersion: number; winnerReason: string; owningNodeKey: string };
  WAIT_CANCELLED: WorkflowTraceCoreEvidenceBase & { waitType: string; priorWaitVersion: number; winnerReason: string; owningNodeKey: string };
  EVENT_CORRELATED: WorkflowTraceCoreEvidenceBase & {
    inboxId: string;
    eventName: string;
    correlationEncoderVersion: string;
    correlationHashAlgorithm: string;
    candidateOrderPosition: number;
  };
  EVENT_FINAL_UNMATCHED: WorkflowTraceCoreEvidenceBase & { inboxId: string; eventName: string; recheckUntil: string };
  PARALLEL_SPLIT_CREATED: WorkflowTraceCoreEvidenceBase & { joinGroupKey: string; splitNodeKey: string; joinNodeKey: string };
  PARALLEL_JOIN_ARRIVAL: WorkflowTraceCoreEvidenceBase & { joinGroupKey: string; splitNodeKey: string; joinNodeKey: string };
  PARALLEL_JOIN_WON: WorkflowTraceCoreEvidenceBase & { joinGroupKey: string; splitNodeKey: string; joinNodeKey: string; winnerTokenId: string };
  PARALLEL_SIBLINGS_CANCELLED: WorkflowTraceCoreEvidenceBase & { joinGroupKey: string; splitNodeKey: string; joinNodeKey: string };
  WORK_ITEM_CREATED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: string; resultingWorkItemStateVersion: number };
  WORK_ITEM_CLAIMED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: string; resultingWorkItemStateVersion: number };
  WORK_ITEM_REASSIGNED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: string; resultingWorkItemStateVersion: number };
  WORK_ITEM_COMPLETED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: string; outcomeKey?: string; resultingWorkItemStateVersion: number };
  WORK_ITEM_CANCELLED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: string; resultingWorkItemStateVersion: number };
  WORK_ITEM_FAILED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: string; resultingWorkItemStateVersion: number };
  WORK_ITEM_ESCALATION_STARTED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: 'SYSTEM_ESCALATION'; resultingWorkItemStateVersion: number };
  WORK_ITEM_ESCALATION_SUCCEEDED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: 'SYSTEM_ESCALATION'; resultingWorkItemStateVersion: number };
  WORK_ITEM_ESCALATION_FAILED: WorkflowTraceCoreEvidenceBase & { workItemType: string; transitionType: string; actorType: 'SYSTEM_ESCALATION'; resultingWorkItemStateVersion: number };
  RECOVERY_CLAIMED: WorkflowTraceCoreEvidenceBase & { nodeOrAttemptIdentity: string; priorLeaseExpiry: string | null; recoveryPathClassification: string };
  LATE_ACTION_RESULT_IGNORED: WorkflowTraceCoreEvidenceBase & { attemptId: string; persistedTerminalAttemptStatus: string; ignoredSettlementClassification: string };
  INSTANCE_FAILED: WorkflowTraceCoreEvidenceBase & { machineErrorCode: string; causalIdentity: string };
  ENGINE_INVARIANT: WorkflowTraceCoreEvidenceBase & { machineErrorCode: string; causalIdentity: string };
  // Remaining V1 types (NODE_READY, NODE_CLAIMED, INSTANCE_SUSPENDED/RESUMED/CANCELLED/SUCCEEDED,
  // SUBFLOW_STARTED/COMPLETED) carry exactly the base shape — no additional mandatory fields are
  // specified in doc 03 section 29 beyond the opening paragraph's base evidence.
  NODE_READY: WorkflowTraceCoreEvidenceBase;
  NODE_CLAIMED: WorkflowTraceCoreEvidenceBase;
  INSTANCE_SUSPENDED: WorkflowTraceCoreEvidenceBase;
  INSTANCE_RESUMED: WorkflowTraceCoreEvidenceBase;
  INSTANCE_CANCELLED: WorkflowTraceCoreEvidenceBase;
  INSTANCE_SUCCEEDED: WorkflowTraceCoreEvidenceBase;
  SUBFLOW_STARTED: WorkflowTraceCoreEvidenceBase;
  SUBFLOW_COMPLETED: WorkflowTraceCoreEvidenceBase;
  // WFV2-14 — Saga/compensation (F-6): one STARTED/SUCCEEDED-or-FAILED pair per compensated ACTION
  // node, LIFO order, plus one summary row per failed instance once the whole pass finishes.
  COMPENSATION_STARTED: WorkflowTraceCoreEvidenceBase & { compensatedNodeKey: string; actionKey: string; actionVersion: string };
  COMPENSATION_SUCCEEDED: WorkflowTraceCoreEvidenceBase & { compensatedNodeKey: string; actionKey: string; actionVersion: string };
  COMPENSATION_FAILED: WorkflowTraceCoreEvidenceBase & { compensatedNodeKey: string; actionKey: string; actionVersion: string; errorCode: string; safeMessage: string };
  SAGA_COMPENSATION_COMPLETED: WorkflowTraceCoreEvidenceBase & { compensatedCount: number; failedCount: number };
};

// Compile-time proof that every WORKFLOW_TRACE_TYPES member has a payload map entry, and vice versa.
type _AssertPayloadMapCoversAllTypes = WorkflowTraceType extends keyof WorkflowTracePayloadMapV1 ? true : never;
type _AssertPayloadMapHasNoExtraKeys = keyof WorkflowTracePayloadMapV1 extends WorkflowTraceType ? true : never;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeCoverageProof: [_AssertPayloadMapCoversAllTypes, _AssertPayloadMapHasNoExtraKeys] = [true, true];
