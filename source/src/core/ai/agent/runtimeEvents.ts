import { randomUUID } from 'crypto';

/**
 * V5 Phase P01 (`PHASE-01-RUNTIME-STATE-AND-EVENTS.md` § 5) — canonical runtime event catalog
 * for the whole V5 runtime. Not every type below is emitted yet: `AgentOrchestrator` today only
 * emits the subset listed in `AgentEventStore.ts`'s doc comment. The rest
 * belong to later phases (Hypothesis/Evidence → P02, ContextItem* → P04, PatchIntent* and
 * Verification* → P06/P07) and are reserved here so the type union doesn't need to change shape
 * when those phases start emitting them.
 */
export type AgentRuntimeEventType =
  | 'TaskCreated'
  | 'TaskContractResolved'
  | 'ClarificationRequested'
  | 'ClarificationResolved'
  | 'PhaseEntered'
  | 'ContextItemDiscovered'
  | 'ContextItemSelected'
  | 'ContextItemPresented'
  | 'ContextItemUtilized'
  | 'ContextCompactionStarted'
  | 'ContextCompactionValidated'
  | 'ContextRehydrated'
  | 'HypothesisProposed'
  | 'HypothesisSupported'
  | 'HypothesisConfirmed'
  | 'HypothesisContradicted'
  | 'HypothesisRejected'
  | 'ModelInvocationStarted'
  | 'ModelInvocationCompleted'
  | 'ActionProposed'
  | 'ActionAllowed'
  | 'ActionDeferred'
  | 'ActionRejected'
  | 'ToolExecutionStarted'
  | 'ToolExecutionCompleted'
  | 'ToolExecutionFailed'
  | 'ToolOutcomeUnknown'
  | 'PatchIntentCreated'
  | 'PatchApplied'
  | 'PatchRejected'
  | 'VerificationStarted'
  | 'EvidenceProduced'
  | 'ClaimSupported'
  | 'ClaimContradicted'
  | 'VerificationCompleted'
  | 'ProgressRecorded'
  | 'StallDetected'
  | 'RecoveryStrategySelected'
  | 'TaskCompleted'
  | 'TaskAbstained'
  | 'TaskBlocked'
  | 'TaskFailed';

export interface AgentRuntimeEvent<T = unknown> {
  eventId: string;
  sequence: number;
  taskId: string;
  attemptId: string;
  sessionId?: string;
  type: AgentRuntimeEventType;
  payload: T;
  causationId?: string;
  correlationId?: string;
  createdAt: string;
}

/**
 * Monotonic per-(taskId,attemptId) sequence generator — one instance per orchestrator run.
 * `startAt` (V5 Phase P09 § V5-13) lets a *resumed* run continue numbering after a prior
 * attempt's persisted log instead of colliding back at 1 — pass the prior log's max sequence.
 */
export class RuntimeEventSequencer {
  private next: number;

  constructor(startAt = 0) {
    this.next = startAt;
  }

  nextSequence(): number {
    this.next += 1;
    return this.next;
  }
}

export const createRuntimeEvent = <T>(
  params: {
    taskId: string;
    attemptId: string;
    sessionId?: string;
    type: AgentRuntimeEventType;
    payload: T;
    sequencer: RuntimeEventSequencer;
    causationId?: string;
    correlationId?: string;
  },
): AgentRuntimeEvent<T> => ({
  eventId: randomUUID(),
  sequence: params.sequencer.nextSequence(),
  taskId: params.taskId,
  attemptId: params.attemptId,
  sessionId: params.sessionId,
  type: params.type,
  payload: params.payload,
  causationId: params.causationId,
  correlationId: params.correlationId,
  createdAt: new Date().toISOString(),
});
