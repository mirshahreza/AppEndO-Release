/**
 * Pure state-machine guard functions — sole transition authority per
 * docs/standards/workflow-engine-testing.md
 * sections 10 and 15. No persistence here; repositories call these
 * guards and apply the result under an expected-version CAS mutation.
 *
 * Every table below is exhaustive for the named aggregate: any
 * (state, command) pair not listed is illegal and the guard returns
 * `null`. Recovery/operator paths invoke the same guards — there is no
 * second transition authority.
 */

const buildLookup = <TState extends string, TCommand extends string>(
  rows: ReadonlyArray<readonly [TState | readonly TState[], TCommand, TState]>,
): Map<string, TState> => {
  const map = new Map<string, TState>();
  for (const [fromOrFroms, command, to] of rows) {
    const froms = Array.isArray(fromOrFroms) ? fromOrFroms : [fromOrFroms];
    for (const from of froms as readonly TState[]) {
      map.set(`${from}::${command}`, to);
    }
  }
  return map;
};

// ---------------------------------------------------------------------------
// WorkflowDefinition lifecycle (doc 03 section 2)
// ---------------------------------------------------------------------------

export type WorkflowDefinitionLifecycle = 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
export type WorkflowDefinitionLifecycleCommand = 'FIRST_REVISION_PUBLISHED' | 'UNPUBLISH' | 'DISABLE' | 'RE_ENABLE' | 'ARCHIVE';

const DEFINITION_LIFECYCLE_ROWS = [
  ['DRAFT', 'FIRST_REVISION_PUBLISHED', 'ACTIVE'],
  ['ACTIVE', 'UNPUBLISH', 'DRAFT'],
  ['ACTIVE', 'DISABLE', 'DISABLED'],
  ['DISABLED', 'UNPUBLISH', 'DRAFT'],
  ['DISABLED', 'RE_ENABLE', 'ACTIVE'],
  [['DRAFT', 'ACTIVE', 'DISABLED'], 'ARCHIVE', 'ARCHIVED'],
] as const satisfies ReadonlyArray<
  readonly [WorkflowDefinitionLifecycle | readonly WorkflowDefinitionLifecycle[], WorkflowDefinitionLifecycleCommand, WorkflowDefinitionLifecycle]
>;

const DEFINITION_LIFECYCLE_LOOKUP = buildLookup(DEFINITION_LIFECYCLE_ROWS);

export function nextWorkflowDefinitionLifecycle(
  from: WorkflowDefinitionLifecycle,
  command: WorkflowDefinitionLifecycleCommand,
): WorkflowDefinitionLifecycle | null {
  return DEFINITION_LIFECYCLE_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// Publication/binding matrix (doc 03 section 10)
// ---------------------------------------------------------------------------

export type PublicationStatus = 'VALIDATING' | 'ACTIVATING_BINDING' | 'PUBLISHED' | 'REJECTED';
export type BindingStatus = 'NOT_REQUIRED' | 'PENDING' | 'ACTIVE' | 'FAILED' | 'INACTIVE';
export type PublicationBindingState = { publicationStatus: PublicationStatus; bindingStatus: BindingStatus };
export type PublicationBindingCommand =
  | 'VALIDATION_FAILS'
  | 'PUBLISH_MANUAL_API'
  | 'VALIDATION_AND_SNAPSHOT_SUCCEED'
  | 'ACTIVATE_OR_RETRY_ACTIVATION'
  | 'ACTIVATION_SUCCEEDS'
  | 'ACTIVATION_FAILS'
  | 'DISABLE_DEFINITION'
  | 'ARCHIVE_DEFINITION'
  | 'REENABLE_OR_RECONCILE';

type PublicationBindingRow = readonly [PublicationStatus, BindingStatus | readonly BindingStatus[], PublicationBindingCommand, PublicationBindingState];

const PUBLICATION_BINDING_ROWS: readonly PublicationBindingRow[] = [
  ['VALIDATING', ['PENDING', 'NOT_REQUIRED'], 'VALIDATION_FAILS', null as unknown as PublicationBindingState], // special-cased below ("unchanged" binding)
  ['VALIDATING', 'NOT_REQUIRED', 'PUBLISH_MANUAL_API', { publicationStatus: 'PUBLISHED', bindingStatus: 'NOT_REQUIRED' }],
  ['VALIDATING', 'PENDING', 'VALIDATION_AND_SNAPSHOT_SUCCEED', { publicationStatus: 'ACTIVATING_BINDING', bindingStatus: 'PENDING' }],
  ['ACTIVATING_BINDING', ['PENDING', 'FAILED'], 'ACTIVATE_OR_RETRY_ACTIVATION', { publicationStatus: 'ACTIVATING_BINDING', bindingStatus: 'PENDING' }],
  ['ACTIVATING_BINDING', 'PENDING', 'ACTIVATION_SUCCEEDS', { publicationStatus: 'PUBLISHED', bindingStatus: 'ACTIVE' }],
  ['ACTIVATING_BINDING', 'PENDING', 'ACTIVATION_FAILS', { publicationStatus: 'ACTIVATING_BINDING', bindingStatus: 'FAILED' }],
  ['PUBLISHED', 'ACTIVE', 'DISABLE_DEFINITION', { publicationStatus: 'PUBLISHED', bindingStatus: 'INACTIVE' }],
  ['PUBLISHED', 'NOT_REQUIRED', 'DISABLE_DEFINITION', { publicationStatus: 'PUBLISHED', bindingStatus: 'NOT_REQUIRED' }],
  ['PUBLISHED', ['ACTIVE', 'INACTIVE'], 'ARCHIVE_DEFINITION', { publicationStatus: 'PUBLISHED', bindingStatus: 'INACTIVE' }],
  ['PUBLISHED', 'INACTIVE', 'REENABLE_OR_RECONCILE', { publicationStatus: 'PUBLISHED', bindingStatus: 'ACTIVE' }],
];

const PUBLICATION_BINDING_LOOKUP = new Map<string, PublicationBindingState>();
for (const [publicationStatus, bindingOrBindings, command, result] of PUBLICATION_BINDING_ROWS) {
  const bindings = Array.isArray(bindingOrBindings) ? bindingOrBindings : [bindingOrBindings];
  for (const bindingStatus of bindings as readonly BindingStatus[]) {
    const key = `${publicationStatus}::${bindingStatus}::${command}`;
    // "validation fails" leaves binding unchanged (doc 03 section 10 row 1) — resolved per-row here
    // rather than baked into the static table, since the result depends on the input bindingStatus.
    PUBLICATION_BINDING_LOOKUP.set(
      key,
      command === 'VALIDATION_FAILS' ? { publicationStatus: 'REJECTED', bindingStatus } : result,
    );
  }
}

export function nextPublicationBindingState(
  current: PublicationBindingState,
  command: PublicationBindingCommand,
): PublicationBindingState | null {
  return PUBLICATION_BINDING_LOOKUP.get(`${current.publicationStatus}::${current.bindingStatus}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkflowInstance (doc 03 section 15)
// ---------------------------------------------------------------------------

export type WorkflowInstanceStatus = 'CREATED' | 'RUNNING' | 'SUSPENDED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type WorkflowInstanceCommand = 'START_COMMIT' | 'SUSPEND' | 'RESUME' | 'COMPLETE' | 'FAIL' | 'CANCEL';

const INSTANCE_ROWS = [
  ['CREATED', 'START_COMMIT', 'RUNNING'],
  ['RUNNING', 'SUSPEND', 'SUSPENDED'],
  ['SUSPENDED', 'RESUME', 'RUNNING'],
  ['RUNNING', 'COMPLETE', 'SUCCEEDED'],
  ['RUNNING', 'FAIL', 'FAILED'],
  [['CREATED', 'RUNNING', 'SUSPENDED'], 'CANCEL', 'CANCELLED'],
] as const satisfies ReadonlyArray<
  readonly [WorkflowInstanceStatus | readonly WorkflowInstanceStatus[], WorkflowInstanceCommand, WorkflowInstanceStatus]
>;

const INSTANCE_LOOKUP = buildLookup(INSTANCE_ROWS);

export function nextWorkflowInstanceStatus(
  from: WorkflowInstanceStatus,
  command: WorkflowInstanceCommand,
): WorkflowInstanceStatus | null {
  return INSTANCE_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkflowNodeInstance (doc 03 section 15) — COMPENSATING/COMPENSATED unreachable
// ---------------------------------------------------------------------------

export type WorkflowNodeInstanceStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING'
  | 'WAITING_HUMAN'
  | 'RETRYING'
  | 'COMPENSATING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'COMPENSATED';

export type WorkflowNodeInstanceCommand =
  | 'ELIGIBILITY_SATISFIED'
  | 'BRANCH_NON_SELECTED'
  | 'CLAIM'
  | 'CREATE_WAIT'
  | 'CREATE_HUMAN_WAIT'
  | 'RETRYABLE_FAILURE'
  | 'COMPLETE'
  | 'TERMINAL_FAILURE'
  | 'CANCEL'
  | 'WAIT_WINNER_COMPLETES'
  | 'COMPENSATE_CREATION_FAILURE';

const NODE_INSTANCE_ROWS = [
  ['PENDING', 'ELIGIBILITY_SATISFIED', 'READY'],
  ['PENDING', 'BRANCH_NON_SELECTED', 'SKIPPED'],
  [['READY', 'RETRYING'], 'CLAIM', 'RUNNING'],
  ['RUNNING', 'CREATE_WAIT', 'WAITING'],
  ['RUNNING', 'CREATE_HUMAN_WAIT', 'WAITING_HUMAN'],
  ['RUNNING', 'RETRYABLE_FAILURE', 'RETRYING'],
  ['RUNNING', 'COMPLETE', 'SUCCEEDED'],
  [['RUNNING', 'WAITING', 'WAITING_HUMAN', 'RETRYING'], 'TERMINAL_FAILURE', 'FAILED'],
  [['PENDING', 'READY', 'RUNNING', 'WAITING', 'WAITING_HUMAN', 'RETRYING'], 'CANCEL', 'CANCELLED'],
  [['WAITING', 'WAITING_HUMAN'], 'WAIT_WINNER_COMPLETES', 'SUCCEEDED'],
  // F-1 (p-60): a node that was claimed (RUNNING) but whose wait/work-item creation phase failed
  // for a reason other than losing a legitimate concurrent CAS race returns to READY — additive,
  // does not touch any existing row (per p-60's own "additive union members only" risk mitigation).
  ['RUNNING', 'COMPENSATE_CREATION_FAILURE', 'READY'],
] as const satisfies ReadonlyArray<
  readonly [WorkflowNodeInstanceStatus | readonly WorkflowNodeInstanceStatus[], WorkflowNodeInstanceCommand, WorkflowNodeInstanceStatus]
>;

const NODE_INSTANCE_LOOKUP = buildLookup(NODE_INSTANCE_ROWS);

export function nextWorkflowNodeInstanceStatus(
  from: WorkflowNodeInstanceStatus,
  command: WorkflowNodeInstanceCommand,
): WorkflowNodeInstanceStatus | null {
  return NODE_INSTANCE_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkflowExecutionAttempt (doc 03 section 15) — all transitions originate at STARTED
// ---------------------------------------------------------------------------

export type WorkflowExecutionAttemptStatus = 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'UNKNOWN' | 'CANCELLED';
export type WorkflowExecutionAttemptCommand =
  | 'COMMIT_SUCCESS'
  | 'COMMIT_FAILURE'
  | 'DEADLINE_TRANSITION_WINS'
  | 'UNSAFE_UNCERTAINTY'
  | 'OWNING_CANCELLATION_WINS';

const EXECUTION_ATTEMPT_ROWS = [
  ['STARTED', 'COMMIT_SUCCESS', 'SUCCEEDED'],
  ['STARTED', 'COMMIT_FAILURE', 'FAILED'],
  ['STARTED', 'DEADLINE_TRANSITION_WINS', 'TIMED_OUT'],
  ['STARTED', 'UNSAFE_UNCERTAINTY', 'UNKNOWN'],
  ['STARTED', 'OWNING_CANCELLATION_WINS', 'CANCELLED'],
] as const satisfies ReadonlyArray<readonly ['STARTED', WorkflowExecutionAttemptCommand, WorkflowExecutionAttemptStatus]>;

const EXECUTION_ATTEMPT_LOOKUP = buildLookup(EXECUTION_ATTEMPT_ROWS);

export function nextWorkflowExecutionAttemptStatus(
  from: 'STARTED',
  command: WorkflowExecutionAttemptCommand,
): WorkflowExecutionAttemptStatus | null {
  return EXECUTION_ATTEMPT_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkflowWait (doc 03 section 6, 15) — ACTIVE is the only non-terminal state
// ---------------------------------------------------------------------------

export type WorkflowWaitStatus = 'ACTIVE' | 'SATISFIED' | 'CANCELLED' | 'EXPIRED';
export type WorkflowWaitCommand = 'SATISFY' | 'CANCEL' | 'EXPIRE';

const WAIT_ROWS = [
  ['ACTIVE', 'SATISFY', 'SATISFIED'],
  ['ACTIVE', 'CANCEL', 'CANCELLED'],
  ['ACTIVE', 'EXPIRE', 'EXPIRED'],
] as const satisfies ReadonlyArray<readonly ['ACTIVE', WorkflowWaitCommand, WorkflowWaitStatus]>;

const WAIT_LOOKUP = buildLookup(WAIT_ROWS);

export function nextWorkflowWaitStatus(from: WorkflowWaitStatus, command: WorkflowWaitCommand): WorkflowWaitStatus | null {
  return WAIT_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkflowEventInbox (doc 03 section 15) — `null` from-state models "creation"
// ---------------------------------------------------------------------------

export type WorkflowEventInboxStatus = 'RECEIVED' | 'CORRELATED' | 'UNMATCHED' | 'REJECTED';
export type WorkflowEventInboxCommand = 'ACCEPT_INGRESS' | 'CORRELATION_WINS' | 'RECHECK_EXHAUSTED' | 'INGRESS_REJECTED' | 'BOUNDED_RECHECK_MATCH';

const EVENT_INBOX_ROWS: ReadonlyArray<readonly [WorkflowEventInboxStatus | null, WorkflowEventInboxCommand, WorkflowEventInboxStatus]> = [
  [null, 'ACCEPT_INGRESS', 'RECEIVED'],
  ['RECEIVED', 'CORRELATION_WINS', 'CORRELATED'],
  ['RECEIVED', 'RECHECK_EXHAUSTED', 'UNMATCHED'],
  [null, 'INGRESS_REJECTED', 'REJECTED'],
  ['UNMATCHED', 'BOUNDED_RECHECK_MATCH', 'CORRELATED'],
];

const EVENT_INBOX_LOOKUP = new Map<string, WorkflowEventInboxStatus>();
for (const [from, command, to] of EVENT_INBOX_ROWS) {
  EVENT_INBOX_LOOKUP.set(`${from}::${command}`, to);
}

export function nextWorkflowEventInboxStatus(
  from: WorkflowEventInboxStatus | null,
  command: WorkflowEventInboxCommand,
): WorkflowEventInboxStatus | null {
  return EVENT_INBOX_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkItem (doc 03 section 15)
// ---------------------------------------------------------------------------

export type WorkItemStatus = 'OPEN' | 'CLAIMED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type WorkItemCommand = 'CLAIM' | 'COMPLETE' | 'COMPLETE_WITH_OUTCOME' | 'CANCEL' | 'FAIL' | 'REASSIGN_CLEAR_CLAIM';

const WORK_ITEM_ROWS = [
  ['OPEN', 'CLAIM', 'CLAIMED'],
  [['OPEN', 'CLAIMED'], 'COMPLETE', 'COMPLETED'],
  [['OPEN', 'CLAIMED'], 'COMPLETE_WITH_OUTCOME', 'COMPLETED'],
  [['OPEN', 'CLAIMED'], 'CANCEL', 'CANCELLED'],
  [['OPEN', 'CLAIMED'], 'FAIL', 'FAILED'],
  ['CLAIMED', 'REASSIGN_CLEAR_CLAIM', 'OPEN'],
] as const satisfies ReadonlyArray<readonly [WorkItemStatus | readonly WorkItemStatus[], WorkItemCommand, WorkItemStatus]>;

const WORK_ITEM_LOOKUP = buildLookup(WORK_ITEM_ROWS);

export function nextWorkItemStatus(from: WorkItemStatus, command: WorkItemCommand): WorkItemStatus | null {
  return WORK_ITEM_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkflowBranchToken (doc 03 section 24) — simple ACTIVE-origin terminal set
// ---------------------------------------------------------------------------

export type WorkflowBranchTokenStatus = 'ACTIVE' | 'ARRIVED' | 'FAILED' | 'CANCELLED';
export type WorkflowBranchTokenCommand = 'ARRIVE' | 'FAIL' | 'CANCEL';

const BRANCH_TOKEN_ROWS = [
  ['ACTIVE', 'ARRIVE', 'ARRIVED'],
  ['ACTIVE', 'FAIL', 'FAILED'],
  ['ACTIVE', 'CANCEL', 'CANCELLED'],
] as const satisfies ReadonlyArray<readonly ['ACTIVE', WorkflowBranchTokenCommand, WorkflowBranchTokenStatus]>;

const BRANCH_TOKEN_LOOKUP = buildLookup(BRANCH_TOKEN_ROWS);

export function nextWorkflowBranchTokenStatus(
  from: WorkflowBranchTokenStatus,
  command: WorkflowBranchTokenCommand,
): WorkflowBranchTokenStatus | null {
  return BRANCH_TOKEN_LOOKUP.get(`${from}::${command}`) ?? null;
}

// ---------------------------------------------------------------------------
// WorkflowSimulationRun (doc 03 section 9) — RUNNING is the sole non-terminal state
// ---------------------------------------------------------------------------

export type WorkflowSimulationRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type WorkflowSimulationRunCommand = 'COMPLETE_SUCCESS' | 'COMPLETE_FAILURE';

const SIMULATION_RUN_ROWS = [
  ['RUNNING', 'COMPLETE_SUCCESS', 'SUCCEEDED'],
  ['RUNNING', 'COMPLETE_FAILURE', 'FAILED'],
] as const satisfies ReadonlyArray<readonly ['RUNNING', WorkflowSimulationRunCommand, WorkflowSimulationRunStatus]>;

const SIMULATION_RUN_LOOKUP = buildLookup(SIMULATION_RUN_ROWS);

export function nextWorkflowSimulationRunStatus(
  from: WorkflowSimulationRunStatus,
  command: WorkflowSimulationRunCommand,
): WorkflowSimulationRunStatus | null {
  return SIMULATION_RUN_LOOKUP.get(`${from}::${command}`) ?? null;
}
