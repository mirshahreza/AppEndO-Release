import type {
  WorkflowDefinitionLifecycle,
  PublicationStatus,
  BindingStatus,
  WorkflowInstanceStatus,
  WorkflowNodeInstanceStatus,
  WorkflowExecutionAttemptStatus,
  WorkflowWaitStatus,
  WorkflowEventInboxStatus,
  WorkItemStatus,
  WorkflowBranchTokenStatus,
  WorkflowSimulationRunStatus,
} from './transitions';

/** Canonical actor-category union (doc 03 section 21) — reused wherever the contract says "canonical categories". */
export type WorkflowActorType = 'USER' | 'SYSTEM' | 'WORKFLOW' | 'EXTERNAL_CONSUMER';

/** Fixed literal actor type for escalation-produced transitions (doc 03 section 17) — not a member of WorkflowActorType. */
export type WorkItemEscalationActorType = 'SYSTEM_ESCALATION';

export type WorkflowCreationMode = 'NEW' | 'DUPLICATE' | 'TEMPLATE' | 'IMPORT';

export type WorkflowDefinitionRecord = {
  id: number;
  scopeKey: string;
  key: string;
  lifecycleStatus: WorkflowDefinitionLifecycle;
  draftDefinitionJson: string;
  draftVersion: number;
  currentPublishedRevisionId: number | null;
  nextRevisionNumber: number;
  createdFromDefinitionId: number | null;
  createdFromRevisionId: number | null;
  creationMode: WorkflowCreationMode;
  stateVersion: number;
  createdAt: string | null;
  createdBy: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
  lastPublishedAt: string | null;
  lastPublishedBy: number | null;
  lastUnpublishedAt: string | null;
  lastUnpublishedBy: number | null;
};

export type WorkflowRevisionRecord = {
  id: number;
  workflowDefinitionId: number;
  revisionNumber: number;
  sourceDraftVersion: number;
  definitionJson: string;
  actionBindingsJson: string;
  schemaProjectionsJson: string | null;
  semanticFingerprint: string;
  publicationStatus: PublicationStatus;
  bindingStatus: BindingStatus;
  validationReportId: number | null;
  stateVersion: number;
  publishedAt: string | null;
  createdAt: string | null;
  createdBy: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
};

export type WorkflowInstanceRecord = {
  id: number;
  workflowRevisionId: number;
  status: WorkflowInstanceStatus;
  inputJson: string | null;
  contextJson: string | null;
  outputJson: string | null;
  startedByType: WorkflowActorType;
  startedById: number | null;
  startType: string | null;
  nextTraceSequenceNumber: number;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkflowNodeInstanceRecord = {
  id: number;
  workflowInstanceId: number;
  semanticNodeKey: string;
  status: WorkflowNodeInstanceStatus;
  selectedIncomingEdgeKey: string | null;
  branchTokenId: number | null;
  joinGroupKey: string | null;
  inputJson: string | null;
  outputJson: string | null;
  nextEligibleAt: string | null;
  leaseOwnerId: string | null;
  leaseExpiresAt: string | null;
  nextAttemptNumber: number;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkflowExecutionAttemptRecord = {
  id: number;
  workflowInstanceId: number;
  nodeInstanceId: number;
  attemptNumber: number;
  actionKey: string | null;
  actionVersion: string | null;
  logicalInvocationId: string;
  idempotencyKey: string;
  status: WorkflowExecutionAttemptStatus;
  selectedProviderId: string | null;
  selectedProviderVersion: string | null;
  selectedProviderFingerprint: string | null;
  deadlineAt: string | null;
  logicalInvocationWindowMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorClass: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultMetadataJson: string | null;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkflowWaitType = 'TIMER' | 'EVENT' | 'HUMAN' | 'SUBFLOW';

export type WorkflowWaitRecord = {
  id: number;
  workflowInstanceId: number;
  owningNodeInstanceId: number;
  waitType: WorkflowWaitType;
  status: WorkflowWaitStatus;
  dueAt: string | null;
  timeoutAt: string | null;
  eventName: string | null;
  correlationKey: string | null;
  correlationValueHash: string | null;
  correlationEncoderVersion: string | null;
  correlationHashAlgorithm: string | null;
  childInstanceId: number | null;
  workItemId: number | null;
  satisfiedAt: string | null;
  resultPayloadJson: string | null;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkflowEventInboxRecord = {
  id: number;
  eventName: string;
  providerEventId: string | null;
  eventSourceIdentity: string;
  correlationEncoderVersion: string | null;
  correlationHashAlgorithm: string | null;
  correlationValueHash: string | null;
  payloadJson: string | null;
  source: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  status: WorkflowEventInboxStatus;
  /** `null` when no dedup key was supplied by the caller — sentinel-backed at storage (Slice 1 plan D6). */
  deduplicationKey: string | null;
  recheckUntil: string | null;
  leaseOwnerId: string | null;
  leaseExpiresAt: string | null;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkItemRecord = {
  id: number;
  workflowInstanceId: number;
  nodeInstanceId: number;
  workItemType: string;
  status: WorkItemStatus;
  assignmentStrategy: string | null;
  assignmentEvidenceJson: string | null;
  claimedByUserId: number | null;
  priority: number;
  allowedOutcomesJson: string;
  inputJson: string;
  outputSchemaJson: string | null;
  outputJson: string | null;
  outcome: string | null;
  titleText: string;
  summaryText: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  approvalGroupKey: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkItemTransitionRecord = {
  id: number;
  workItemId: number;
  fromStatus: string;
  toStatus: string;
  transitionType: string;
  actorType: WorkflowActorType | WorkItemEscalationActorType;
  actorId: number | null;
  reasonCode: string | null;
  evidenceJson: string | null;
  occurredAt: string | null;
  workItemStateVersionAfter: number;
};

export type WorkItemEscalationStatus = 'STARTED' | 'SUCCEEDED' | 'FAILED';

export type WorkItemEscalationRecord = {
  id: number;
  workItemId: number;
  policyStepKey: string;
  executionNumber: number;
  status: WorkItemEscalationStatus;
  actionType: string;
  actorType: WorkItemEscalationActorType;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  evidenceJson: string | null;
  createdAt: string | null;
};

export type WorkflowTraceRecord = {
  id: number;
  workflowInstanceId: number;
  nodeInstanceId: number | null;
  sequenceNumber: number;
  traceType: string;
  payloadSchemaVersion: number;
  occurredAt: string | null;
  actorType: WorkflowActorType;
  actorId: number | null;
  coreEvidenceJson: string;
  diagnosticPayloadJson: string | null;
  dataClassification: string;
};

export type WorkflowSimulationMode = 'FULL' | 'NODE' | 'FROM_NODE';

export type WorkflowSimulationRunRecord = {
  id: number;
  workflowDefinitionId: number;
  sourceDraftVersion: number | null;
  sourceRevisionId: number | null;
  simulationResolvedSnapshotFingerprint: string;
  mode: WorkflowSimulationMode;
  startNodeKey: string | null;
  scenarioKey: string | null;
  fixtureSetFingerprint: string;
  status: WorkflowSimulationRunStatus;
  resultSummaryJson: string | null;
  createdByType: WorkflowActorType;
  createdById: number | null;
  createdAt: string | null;
  completedAt: string | null;
  stateVersion: number;
};

export type WorkflowValidationStatus = 'PASSED' | 'FAILED';

export type WorkflowValidationReportRecord = {
  id: number;
  workflowDefinitionId: number;
  revisionId: number | null;
  draftVersion: number;
  status: WorkflowValidationStatus;
  validatorVersion: string;
  issuesJson: string;
  coverageSummaryJson: string | null;
  createdAt: string | null;
};

export type WorkflowDesignerViewRecord = {
  id: number;
  workflowDefinitionId: number;
  workflowRevisionId: number | null;
  draftVersion: number | null;
  viewSchemaVersion: number;
  viewJson: string;
  updatedBy: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** A named pointer to a server environment variable — never the secret value itself (no vault
 * exists in this platform). `configuredOnThisNode` is a live `process.env` presence check on THIS
 * process only (informational only — a multi-node deployment may have the variable set on other
 * nodes; never treat `false` as authoritative for "not configured anywhere"). */
export type WorkflowSecretReferenceRecord = {
  id: number;
  name: string;
  label: string;
  description: string | null;
  configuredOnThisNode: boolean;
  /** p-99/WFT-3 — true when an encrypted value is stored in the vault for this reference (resolved
   * in preference to `process.env[name]` at dispatch time). Never exposes the value itself. */
  hasStoredValue: boolean;
  createdAt: string | null;
  createdBy: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
};

export type WorkflowBranchTokenRecord = {
  id: number;
  workflowInstanceId: number;
  splitNodeKey: string;
  joinNodeKey: string;
  branchEdgeKey: string;
  status: WorkflowBranchTokenStatus;
  stateVersion: number;
  createdAt: string | null;
  terminalAt: string | null;
};

export type WorkflowJoinArrivalRecord = {
  id: number;
  workflowInstanceId: number;
  joinNodeInstanceId: number;
  branchTokenId: number;
  arrivedAt: string | null;
};
