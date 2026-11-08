import { describe, expect, it } from 'vitest';
import {
  nextWorkflowDefinitionLifecycle,
  nextPublicationBindingState,
  nextWorkflowInstanceStatus,
  nextWorkflowNodeInstanceStatus,
  nextWorkflowExecutionAttemptStatus,
  nextWorkflowWaitStatus,
  nextWorkflowEventInboxStatus,
  nextWorkItemStatus,
  nextWorkflowBranchTokenStatus,
  nextWorkflowSimulationRunStatus,
  type WorkflowDefinitionLifecycle,
  type WorkflowDefinitionLifecycleCommand,
  type PublicationBindingState,
  type PublicationBindingCommand,
  type PublicationStatus,
  type BindingStatus,
  type WorkflowInstanceStatus,
  type WorkflowInstanceCommand,
  type WorkflowNodeInstanceStatus,
  type WorkflowNodeInstanceCommand,
  type WorkflowExecutionAttemptCommand,
  type WorkflowExecutionAttemptStatus,
  type WorkflowWaitStatus,
  type WorkflowWaitCommand,
  type WorkflowEventInboxStatus,
  type WorkflowEventInboxCommand,
  type WorkItemStatus,
  type WorkItemCommand,
  type WorkflowBranchTokenStatus,
  type WorkflowBranchTokenCommand,
  type WorkflowSimulationRunStatus,
  type WorkflowSimulationRunCommand,
} from '../transitions';

/** Cross-product exhaustive check: every row in `legalRows` returns exactly `to`; every other (from, command) pair returns null. */
function assertExhaustiveTransitionTable<TState extends string, TCommand extends string>(
  guard: (from: TState, command: TCommand) => TState | null,
  states: readonly TState[],
  commands: readonly TCommand[],
  legalRows: ReadonlyArray<readonly [TState, TCommand, TState]>,
): void {
  const legalMap = new Map<string, TState>();
  for (const [from, command, to] of legalRows) {
    legalMap.set(`${from}::${command}`, to);
  }
  for (const from of states) {
    for (const command of commands) {
      const expected = legalMap.get(`${from}::${command}`) ?? null;
      expect(guard(from, command)).toBe(expected);
    }
  }
}

describe('WorkflowDefinition lifecycle (doc 03 section 2)', () => {
  const states: WorkflowDefinitionLifecycle[] = ['DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED'];
  const commands: WorkflowDefinitionLifecycleCommand[] = ['FIRST_REVISION_PUBLISHED', 'UNPUBLISH', 'DISABLE', 'RE_ENABLE', 'ARCHIVE'];
  const legalRows: ReadonlyArray<readonly [WorkflowDefinitionLifecycle, WorkflowDefinitionLifecycleCommand, WorkflowDefinitionLifecycle]> = [
    ['DRAFT', 'FIRST_REVISION_PUBLISHED', 'ACTIVE'],
    ['ACTIVE', 'UNPUBLISH', 'DRAFT'],
    ['ACTIVE', 'DISABLE', 'DISABLED'],
    ['DISABLED', 'UNPUBLISH', 'DRAFT'],
    ['DISABLED', 'RE_ENABLE', 'ACTIVE'],
    ['DRAFT', 'ARCHIVE', 'ARCHIVED'],
    ['ACTIVE', 'ARCHIVE', 'ARCHIVED'],
    ['DISABLED', 'ARCHIVE', 'ARCHIVED'],
  ];

  it('matches doc 03 section 2 exactly; every other pair is illegal', () => {
    assertExhaustiveTransitionTable(nextWorkflowDefinitionLifecycle, states, commands, legalRows);
  });

  it('ARCHIVED is terminal — no command escapes it', () => {
    for (const command of commands) {
      expect(nextWorkflowDefinitionLifecycle('ARCHIVED', command)).toBeNull();
    }
  });
});

describe('Publication/binding matrix (doc 03 section 10)', () => {
  const publicationStatuses: PublicationStatus[] = ['VALIDATING', 'ACTIVATING_BINDING', 'PUBLISHED', 'REJECTED'];
  const bindingStatuses: BindingStatus[] = ['NOT_REQUIRED', 'PENDING', 'ACTIVE', 'FAILED', 'INACTIVE'];
  const commands: PublicationBindingCommand[] = [
    'VALIDATION_FAILS',
    'PUBLISH_MANUAL_API',
    'VALIDATION_AND_SNAPSHOT_SUCCEED',
    'ACTIVATE_OR_RETRY_ACTIVATION',
    'ACTIVATION_SUCCEEDS',
    'ACTIVATION_FAILS',
    'DISABLE_DEFINITION',
    'ARCHIVE_DEFINITION',
    'REENABLE_OR_RECONCILE',
  ];

  const legalRows: ReadonlyArray<readonly [PublicationStatus, BindingStatus, PublicationBindingCommand, PublicationBindingState]> = [
    ['VALIDATING', 'PENDING', 'VALIDATION_FAILS', { publicationStatus: 'REJECTED', bindingStatus: 'PENDING' }],
    ['VALIDATING', 'NOT_REQUIRED', 'VALIDATION_FAILS', { publicationStatus: 'REJECTED', bindingStatus: 'NOT_REQUIRED' }],
    ['VALIDATING', 'NOT_REQUIRED', 'PUBLISH_MANUAL_API', { publicationStatus: 'PUBLISHED', bindingStatus: 'NOT_REQUIRED' }],
    ['VALIDATING', 'PENDING', 'VALIDATION_AND_SNAPSHOT_SUCCEED', { publicationStatus: 'ACTIVATING_BINDING', bindingStatus: 'PENDING' }],
    ['ACTIVATING_BINDING', 'PENDING', 'ACTIVATE_OR_RETRY_ACTIVATION', { publicationStatus: 'ACTIVATING_BINDING', bindingStatus: 'PENDING' }],
    ['ACTIVATING_BINDING', 'FAILED', 'ACTIVATE_OR_RETRY_ACTIVATION', { publicationStatus: 'ACTIVATING_BINDING', bindingStatus: 'PENDING' }],
    ['ACTIVATING_BINDING', 'PENDING', 'ACTIVATION_SUCCEEDS', { publicationStatus: 'PUBLISHED', bindingStatus: 'ACTIVE' }],
    ['ACTIVATING_BINDING', 'PENDING', 'ACTIVATION_FAILS', { publicationStatus: 'ACTIVATING_BINDING', bindingStatus: 'FAILED' }],
    ['PUBLISHED', 'ACTIVE', 'DISABLE_DEFINITION', { publicationStatus: 'PUBLISHED', bindingStatus: 'INACTIVE' }],
    ['PUBLISHED', 'NOT_REQUIRED', 'DISABLE_DEFINITION', { publicationStatus: 'PUBLISHED', bindingStatus: 'NOT_REQUIRED' }],
    ['PUBLISHED', 'ACTIVE', 'ARCHIVE_DEFINITION', { publicationStatus: 'PUBLISHED', bindingStatus: 'INACTIVE' }],
    ['PUBLISHED', 'INACTIVE', 'ARCHIVE_DEFINITION', { publicationStatus: 'PUBLISHED', bindingStatus: 'INACTIVE' }],
    ['PUBLISHED', 'INACTIVE', 'REENABLE_OR_RECONCILE', { publicationStatus: 'PUBLISHED', bindingStatus: 'ACTIVE' }],
  ];

  it('matches doc 03 section 10 exactly; every other state-pair/command combination is illegal', () => {
    const legalMap = new Map<string, PublicationBindingState>();
    for (const [publicationStatus, bindingStatus, command, result] of legalRows) {
      legalMap.set(`${publicationStatus}::${bindingStatus}::${command}`, result);
    }
    for (const publicationStatus of publicationStatuses) {
      for (const bindingStatus of bindingStatuses) {
        for (const command of commands) {
          const expected = legalMap.get(`${publicationStatus}::${bindingStatus}::${command}`) ?? null;
          expect(nextPublicationBindingState({ publicationStatus, bindingStatus }, command)).toEqual(expected);
        }
      }
    }
  });

  it('impossible state pairs never appear as a documented row (VALIDATING+ACTIVE, PUBLISHED+PENDING, REJECTED+ACTIVE, ACTIVATING_BINDING+ACTIVE)', () => {
    const impossiblePairs: ReadonlyArray<readonly [PublicationStatus, BindingStatus]> = [
      ['VALIDATING', 'ACTIVE'],
      ['PUBLISHED', 'PENDING'],
      ['REJECTED', 'ACTIVE'],
      ['ACTIVATING_BINDING', 'ACTIVE'],
    ];
    for (const [publicationStatus, bindingStatus] of impossiblePairs) {
      for (const command of commands) {
        expect(nextPublicationBindingState({ publicationStatus, bindingStatus }, command)).toBeNull();
      }
    }
  });
});

describe('WorkflowInstance (doc 03 section 15)', () => {
  const states: WorkflowInstanceStatus[] = ['CREATED', 'RUNNING', 'SUSPENDED', 'SUCCEEDED', 'FAILED', 'CANCELLED'];
  const commands: WorkflowInstanceCommand[] = ['START_COMMIT', 'SUSPEND', 'RESUME', 'COMPLETE', 'FAIL', 'CANCEL'];
  const legalRows: ReadonlyArray<readonly [WorkflowInstanceStatus, WorkflowInstanceCommand, WorkflowInstanceStatus]> = [
    ['CREATED', 'START_COMMIT', 'RUNNING'],
    ['RUNNING', 'SUSPEND', 'SUSPENDED'],
    ['SUSPENDED', 'RESUME', 'RUNNING'],
    ['RUNNING', 'COMPLETE', 'SUCCEEDED'],
    ['RUNNING', 'FAIL', 'FAILED'],
    ['CREATED', 'CANCEL', 'CANCELLED'],
    ['RUNNING', 'CANCEL', 'CANCELLED'],
    ['SUSPENDED', 'CANCEL', 'CANCELLED'],
  ];

  it('matches doc 03 section 15 exactly; every other pair is illegal', () => {
    assertExhaustiveTransitionTable(nextWorkflowInstanceStatus, states, commands, legalRows);
  });

  it('SUCCEEDED, FAILED, CANCELLED are terminal', () => {
    for (const terminal of ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const) {
      for (const command of commands) {
        expect(nextWorkflowInstanceStatus(terminal, command)).toBeNull();
      }
    }
  });
});

describe('WorkflowNodeInstance (doc 03 section 15) — COMPENSATING/COMPENSATED unreachable', () => {
  const states: WorkflowNodeInstanceStatus[] = [
    'PENDING', 'READY', 'RUNNING', 'WAITING', 'WAITING_HUMAN', 'RETRYING', 'COMPENSATING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'COMPENSATED',
  ];
  const commands: WorkflowNodeInstanceCommand[] = [
    'ELIGIBILITY_SATISFIED', 'BRANCH_NON_SELECTED', 'CLAIM', 'CREATE_WAIT', 'CREATE_HUMAN_WAIT', 'RETRYABLE_FAILURE', 'COMPLETE', 'TERMINAL_FAILURE', 'CANCEL', 'WAIT_WINNER_COMPLETES', 'COMPENSATE_CREATION_FAILURE',
  ];
  const legalRows: ReadonlyArray<readonly [WorkflowNodeInstanceStatus, WorkflowNodeInstanceCommand, WorkflowNodeInstanceStatus]> = [
    ['PENDING', 'ELIGIBILITY_SATISFIED', 'READY'],
    ['PENDING', 'BRANCH_NON_SELECTED', 'SKIPPED'],
    ['READY', 'CLAIM', 'RUNNING'],
    ['RETRYING', 'CLAIM', 'RUNNING'],
    ['RUNNING', 'CREATE_WAIT', 'WAITING'],
    ['RUNNING', 'CREATE_HUMAN_WAIT', 'WAITING_HUMAN'],
    ['RUNNING', 'RETRYABLE_FAILURE', 'RETRYING'],
    ['RUNNING', 'COMPLETE', 'SUCCEEDED'],
    ['RUNNING', 'TERMINAL_FAILURE', 'FAILED'],
    ['WAITING', 'TERMINAL_FAILURE', 'FAILED'],
    ['WAITING_HUMAN', 'TERMINAL_FAILURE', 'FAILED'],
    ['RETRYING', 'TERMINAL_FAILURE', 'FAILED'],
    ['PENDING', 'CANCEL', 'CANCELLED'],
    ['READY', 'CANCEL', 'CANCELLED'],
    ['RUNNING', 'CANCEL', 'CANCELLED'],
    ['WAITING', 'CANCEL', 'CANCELLED'],
    ['WAITING_HUMAN', 'CANCEL', 'CANCELLED'],
    ['RETRYING', 'CANCEL', 'CANCELLED'],
    ['WAITING', 'WAIT_WINNER_COMPLETES', 'SUCCEEDED'],
    ['WAITING_HUMAN', 'WAIT_WINNER_COMPLETES', 'SUCCEEDED'],
    ['RUNNING', 'COMPENSATE_CREATION_FAILURE', 'READY'],
  ];

  it('matches doc 03 section 15 exactly; every other pair is illegal', () => {
    assertExhaustiveTransitionTable(nextWorkflowNodeInstanceStatus, states, commands, legalRows);
  });

  it('COMPENSATING and COMPENSATED never appear as a return value (unreachable in V1)', () => {
    for (const from of states) {
      for (const command of commands) {
        const result = nextWorkflowNodeInstanceStatus(from, command);
        expect(result).not.toBe('COMPENSATING');
        expect(result).not.toBe('COMPENSATED');
      }
    }
  });

  it('SUCCEEDED, FAILED, SKIPPED, CANCELLED are terminal', () => {
    for (const terminal of ['SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED'] as const) {
      for (const command of commands) {
        expect(nextWorkflowNodeInstanceStatus(terminal, command)).toBeNull();
      }
    }
  });
});

describe('WorkflowExecutionAttempt (doc 03 section 15)', () => {
  const commands: WorkflowExecutionAttemptCommand[] = [
    'COMMIT_SUCCESS', 'COMMIT_FAILURE', 'DEADLINE_TRANSITION_WINS', 'UNSAFE_UNCERTAINTY', 'OWNING_CANCELLATION_WINS',
  ];
  const legalRows: ReadonlyArray<readonly [WorkflowExecutionAttemptCommand, WorkflowExecutionAttemptStatus]> = [
    ['COMMIT_SUCCESS', 'SUCCEEDED'],
    ['COMMIT_FAILURE', 'FAILED'],
    ['DEADLINE_TRANSITION_WINS', 'TIMED_OUT'],
    ['UNSAFE_UNCERTAINTY', 'UNKNOWN'],
    ['OWNING_CANCELLATION_WINS', 'CANCELLED'],
  ];

  it('every command from STARTED matches doc 03 section 15 exactly', () => {
    const legalMap = new Map(legalRows.map(([command, to]) => [command, to]));
    for (const command of commands) {
      expect(nextWorkflowExecutionAttemptStatus('STARTED', command)).toBe(legalMap.get(command));
    }
  });
});

describe('WorkflowWait (doc 03 section 6, 15) — ACTIVE is the only non-terminal state', () => {
  const states: WorkflowWaitStatus[] = ['ACTIVE', 'SATISFIED', 'CANCELLED', 'EXPIRED'];
  const commands: WorkflowWaitCommand[] = ['SATISFY', 'CANCEL', 'EXPIRE'];
  const legalRows: ReadonlyArray<readonly [WorkflowWaitStatus, WorkflowWaitCommand, WorkflowWaitStatus]> = [
    ['ACTIVE', 'SATISFY', 'SATISFIED'],
    ['ACTIVE', 'CANCEL', 'CANCELLED'],
    ['ACTIVE', 'EXPIRE', 'EXPIRED'],
  ];

  it('matches doc 03 exactly; terminal states accept no command', () => {
    assertExhaustiveTransitionTable(nextWorkflowWaitStatus, states, commands, legalRows);
  });
});

describe('WorkflowEventInbox (doc 03 section 15)', () => {
  const states: Array<WorkflowEventInboxStatus | null> = [null, 'RECEIVED', 'CORRELATED', 'UNMATCHED', 'REJECTED'];
  const commands: WorkflowEventInboxCommand[] = ['ACCEPT_INGRESS', 'CORRELATION_WINS', 'RECHECK_EXHAUSTED', 'INGRESS_REJECTED', 'BOUNDED_RECHECK_MATCH'];
  const legalRows: ReadonlyArray<readonly [WorkflowEventInboxStatus | null, WorkflowEventInboxCommand, WorkflowEventInboxStatus]> = [
    [null, 'ACCEPT_INGRESS', 'RECEIVED'],
    ['RECEIVED', 'CORRELATION_WINS', 'CORRELATED'],
    ['RECEIVED', 'RECHECK_EXHAUSTED', 'UNMATCHED'],
    [null, 'INGRESS_REJECTED', 'REJECTED'],
    ['UNMATCHED', 'BOUNDED_RECHECK_MATCH', 'CORRELATED'],
  ];

  it('matches doc 03 exactly; every other pair is illegal', () => {
    const legalMap = new Map(legalRows.map(([from, command, to]) => [`${from}::${command}`, to]));
    for (const from of states) {
      for (const command of commands) {
        const expected = legalMap.get(`${from}::${command}`) ?? null;
        expect(nextWorkflowEventInboxStatus(from, command)).toBe(expected);
      }
    }
  });

  it('CORRELATED and REJECTED are terminal; UNMATCHED only accepts BOUNDED_RECHECK_MATCH', () => {
    for (const command of commands) {
      expect(nextWorkflowEventInboxStatus('CORRELATED', command)).toBeNull();
      expect(nextWorkflowEventInboxStatus('REJECTED', command)).toBeNull();
    }
  });
});

describe('WorkItem (doc 03 section 15)', () => {
  const states: WorkItemStatus[] = ['OPEN', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'FAILED'];
  const commands: WorkItemCommand[] = ['CLAIM', 'COMPLETE', 'COMPLETE_WITH_OUTCOME', 'CANCEL', 'FAIL', 'REASSIGN_CLEAR_CLAIM'];
  const legalRows: ReadonlyArray<readonly [WorkItemStatus, WorkItemCommand, WorkItemStatus]> = [
    ['OPEN', 'CLAIM', 'CLAIMED'],
    ['OPEN', 'COMPLETE', 'COMPLETED'],
    ['CLAIMED', 'COMPLETE', 'COMPLETED'],
    ['OPEN', 'COMPLETE_WITH_OUTCOME', 'COMPLETED'],
    ['CLAIMED', 'COMPLETE_WITH_OUTCOME', 'COMPLETED'],
    ['OPEN', 'CANCEL', 'CANCELLED'],
    ['CLAIMED', 'CANCEL', 'CANCELLED'],
    ['OPEN', 'FAIL', 'FAILED'],
    ['CLAIMED', 'FAIL', 'FAILED'],
    ['CLAIMED', 'REASSIGN_CLEAR_CLAIM', 'OPEN'],
  ];

  it('matches doc 03 section 15 exactly; every other pair is illegal', () => {
    assertExhaustiveTransitionTable(nextWorkItemStatus, states, commands, legalRows);
  });

  it('COMPLETED, CANCELLED, FAILED are terminal', () => {
    for (const terminal of ['COMPLETED', 'CANCELLED', 'FAILED'] as const) {
      for (const command of commands) {
        expect(nextWorkItemStatus(terminal, command)).toBeNull();
      }
    }
  });
});

describe('WorkflowBranchToken (doc 03 section 24)', () => {
  const states: WorkflowBranchTokenStatus[] = ['ACTIVE', 'ARRIVED', 'FAILED', 'CANCELLED'];
  const commands: WorkflowBranchTokenCommand[] = ['ARRIVE', 'FAIL', 'CANCEL'];
  const legalRows: ReadonlyArray<readonly [WorkflowBranchTokenStatus, WorkflowBranchTokenCommand, WorkflowBranchTokenStatus]> = [
    ['ACTIVE', 'ARRIVE', 'ARRIVED'],
    ['ACTIVE', 'FAIL', 'FAILED'],
    ['ACTIVE', 'CANCEL', 'CANCELLED'],
  ];

  it('matches doc 03 exactly; terminal states accept no command', () => {
    assertExhaustiveTransitionTable(nextWorkflowBranchTokenStatus, states, commands, legalRows);
  });
});

describe('WorkflowSimulationRun (doc 03 section 9)', () => {
  const states: WorkflowSimulationRunStatus[] = ['RUNNING', 'SUCCEEDED', 'FAILED'];
  const commands: WorkflowSimulationRunCommand[] = ['COMPLETE_SUCCESS', 'COMPLETE_FAILURE'];
  const legalRows: ReadonlyArray<readonly [WorkflowSimulationRunStatus, WorkflowSimulationRunCommand, WorkflowSimulationRunStatus]> = [
    ['RUNNING', 'COMPLETE_SUCCESS', 'SUCCEEDED'],
    ['RUNNING', 'COMPLETE_FAILURE', 'FAILED'],
  ];

  it('RUNNING is the sole non-terminal state; SUCCEEDED/FAILED are immutable terminal', () => {
    assertExhaustiveTransitionTable(nextWorkflowSimulationRunStatus, states, commands, legalRows);
  });
});
