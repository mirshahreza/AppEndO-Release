import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../runtime/RuntimeFileStore';
import type { AgentRuntimeEvent } from './runtimeEvents';
import type { AgentToolIdempotency } from './operationalPolicyEngine';

/**
 * V5 Phase P01 § 4.3 — `OperationalState`.
 *
 * Scoped to what `AgentOrchestrator` can populate for real today (iteration/token/retrieval/draft
 * counters that previously lived only as local `run()` variables — see `PHASE-01-...md` § 4.1 —
 * plus failure-signature tracking, which is new). The full canonical shape in the phase doc also
 * includes `taskContract`, `activeHypotheses`, `patch`, `workspace`, `acceptance`, `risk`, `budget`,
 * `health` — those require `TaskContract`/`Evidence`/`PatchIntent`/`Verification` types that don't
 * exist until Phases 02/06/07, so they're deferred (see PHASE-EVIDENCE-REPORT-P01.md § Remaining).
 */
export type AgentPhase = 'EXPLORE' | 'PLAN' | 'EDIT' | 'VERIFY' | 'COMPLETE' | 'BLOCKED' | 'FAILED';
export type TaskOutcomeState = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'ABSTAINED';

export type FailureSignatureRef = {
  /** `${toolName}:${normalizedTarget}` — coarser than exact-args-hash repetition (orchestrationPolicy.ts). */
  signature: string;
  toolName: string;
  target: string;
  occurrences: number;
  lastError?: string;
  /** Set once a VERIFY-class tool (run_tests/test_server_function) succeeds after this signature. */
  recoveredAt?: string;
};

/** V5 Phase P09 § V5-13 — a tool call whose ToolExecutionStarted has no matching resolution. */
export type PendingUnknownOutcome = {
  toolName: string;
  target: string;
  idempotency: AgentToolIdempotency;
  detectedAt: string;
};

export interface OperationalState {
  taskId: string;
  attemptId: string;
  phase: AgentPhase;
  outcomeState: TaskOutcomeState;
  iteration: number;
  retrievalOperationCount: number;
  draftToolCount: number;
  tokensEstimate: number;
  failureSignatures: FailureSignatureRef[];
  clarificationPending: boolean;
  stallDetected: boolean;
  lastEventSequence: number;
  updatedAt: string;
  pendingUnknownOutcomes: PendingUnknownOutcome[];
}

export const createInitialOperationalState = (taskId: string, attemptId: string): OperationalState => ({
  taskId,
  attemptId,
  phase: 'EXPLORE',
  outcomeState: 'IN_PROGRESS',
  iteration: 0,
  retrievalOperationCount: 0,
  draftToolCount: 0,
  tokensEstimate: 0,
  failureSignatures: [],
  clarificationPending: false,
  stallDetected: false,
  lastEventSequence: 0,
  updatedAt: new Date(0).toISOString(),
  pendingUnknownOutcomes: [],
});

const VERIFY_TOOL_NAMES = new Set(['run_tests', 'test_server_function']);

const clearPendingUnknownOutcome = (
  pending: PendingUnknownOutcome[],
  toolName: string,
  target: string | undefined,
): PendingUnknownOutcome[] => (
  pending.some((entry) => entry.toolName === toolName && entry.target === target)
    ? pending.filter((entry) => !(entry.toolName === toolName && entry.target === target))
    : pending
);

const withSignature = (
  signatures: FailureSignatureRef[],
  signature: string,
  mutate: (existing: FailureSignatureRef | undefined) => FailureSignatureRef,
): FailureSignatureRef[] => {
  const idx = signatures.findIndex((entry) => entry.signature === signature);
  const next = mutate(idx >= 0 ? signatures[idx] : undefined);
  if (idx >= 0) {
    const copy = [...signatures];
    copy[idx] = next;
    return copy;
  }
  return [...signatures, next];
};

/**
 * Pure reducer: `(state, event) => nextState`. Deterministic given a deterministic event stream —
 * see `hashOperationalState` for what "deterministic" means here (state transitions, not raw
 * model text — model responses are inherently non-deterministic even against the same prompt).
 */
export const reduceOperationalState = (
  state: OperationalState,
  event: AgentRuntimeEvent,
): OperationalState => {
  const base: OperationalState = { ...state, lastEventSequence: event.sequence, updatedAt: event.createdAt };

  switch (event.type) {
    case 'TaskCreated':
      return base;

    case 'ProgressRecorded': {
      const payload = event.payload as { iteration: number; tokensEstimate: number };
      return { ...base, iteration: payload.iteration, tokensEstimate: payload.tokensEstimate };
    }

    case 'ActionProposed': {
      const payload = event.payload as { actionClass: string };
      const phase: AgentPhase = payload.actionClass === 'EDIT' ? 'EDIT'
        : payload.actionClass === 'VERIFY' ? 'VERIFY'
          : payload.actionClass === 'PLAN' ? 'PLAN'
            : base.phase === 'EDIT' || base.phase === 'VERIFY' ? base.phase
              : 'EXPLORE';
      return { ...base, phase };
    }

    case 'ClarificationRequested':
      return { ...base, clarificationPending: true };

    case 'ClarificationResolved':
      return { ...base, clarificationPending: false };

    case 'ToolExecutionCompleted': {
      const payload = event.payload as { toolName: string; isRetrieve: boolean; isDraft: boolean; target?: string };
      let failureSignatures = base.failureSignatures;
      if (VERIFY_TOOL_NAMES.has(payload.toolName)) {
        failureSignatures = failureSignatures.map((entry) => (
          entry.recoveredAt ? entry : { ...entry, recoveredAt: event.createdAt }
        ));
      }
      return {
        ...base,
        retrievalOperationCount: base.retrievalOperationCount + (payload.isRetrieve ? 1 : 0),
        draftToolCount: base.draftToolCount + (payload.isDraft ? 1 : 0),
        failureSignatures,
        pendingUnknownOutcomes: clearPendingUnknownOutcome(base.pendingUnknownOutcomes, payload.toolName, payload.target),
      };
    }

    case 'ToolExecutionFailed': {
      const payload = event.payload as { toolName: string; target: string; error?: string };
      const signature = `${payload.toolName}:${payload.target}`;
      const failureSignatures = withSignature(base.failureSignatures, signature, (existing) => ({
        signature,
        toolName: payload.toolName,
        target: payload.target,
        occurrences: (existing?.occurrences ?? 0) + 1,
        lastError: payload.error,
        recoveredAt: undefined,
      }));
      return {
        ...base,
        failureSignatures,
        pendingUnknownOutcomes: clearPendingUnknownOutcome(base.pendingUnknownOutcomes, payload.toolName, payload.target),
      };
    }

    // V5 Phase P09 § V5-13 — emitted by `reconcileEventLogOnResume` (crashRecovery.ts) when a
    // resumed attempt's event log ends on an unresolved `ToolExecutionStarted`. Feeds the
    // `pendingUnknownOutcomes` gate `DefaultOperationalPolicyEngine.validateProposal` checks.
    case 'ToolOutcomeUnknown': {
      const payload = event.payload as { toolName: string; target: string; idempotency: AgentToolIdempotency };
      const already = base.pendingUnknownOutcomes.some(
        (entry) => entry.toolName === payload.toolName && entry.target === payload.target,
      );
      if (already) return base;
      return {
        ...base,
        pendingUnknownOutcomes: [
          ...base.pendingUnknownOutcomes,
          { toolName: payload.toolName, target: payload.target, idempotency: payload.idempotency, detectedAt: event.createdAt },
        ],
      };
    }

    case 'StallDetected':
      return { ...base, stallDetected: true };

    case 'TaskCompleted':
      return { ...base, outcomeState: 'COMPLETED', phase: 'COMPLETE' };

    case 'TaskFailed':
      return { ...base, outcomeState: 'FAILED', phase: 'FAILED' };

    case 'TaskBlocked':
      return { ...base, outcomeState: 'BLOCKED', phase: 'BLOCKED' };

    default:
      return base;
  }
};

export const replayOperationalState = (
  taskId: string,
  attemptId: string,
  events: readonly AgentRuntimeEvent[],
): OperationalState => (
  [...events]
    .sort((a, b) => a.sequence - b.sequence)
    .reduce(reduceOperationalState, createInitialOperationalState(taskId, attemptId))
);

/**
 * Hashes only deterministic state-transition fields — excludes `updatedAt` (a timestamp) and
 * `tokensEstimate` (varies with prompt-side token counting, not a state-transition decision).
 * See PHASE-01 doc § V5-2 "model non-determinism note".
 */
export const hashOperationalState = (state: OperationalState): string => {
  const stable = {
    taskId: state.taskId,
    attemptId: state.attemptId,
    phase: state.phase,
    outcomeState: state.outcomeState,
    iteration: state.iteration,
    retrievalOperationCount: state.retrievalOperationCount,
    draftToolCount: state.draftToolCount,
    failureSignatures: [...state.failureSignatures]
      .sort((a, b) => a.signature.localeCompare(b.signature))
      .map((entry) => ({
        signature: entry.signature,
        occurrences: entry.occurrences,
        recovered: Boolean(entry.recoveredAt),
      })),
    clarificationPending: state.clarificationPending,
    stallDetected: state.stallDetected,
    lastEventSequence: state.lastEventSequence,
    pendingUnknownOutcomes: [...state.pendingUnknownOutcomes]
      .sort((a, b) => `${a.toolName}:${a.target}`.localeCompare(`${b.toolName}:${b.target}`))
      .map((entry) => ({ toolName: entry.toolName, target: entry.target, idempotency: entry.idempotency })),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
};

const STATE_ROOT = 'workspace/appendoo/agent-operational-state';
const STATE_TMP_DIR = `${STATE_ROOT}/.tmp`;
const resolveStateRoot = (): string => path.join(process.cwd(), STATE_ROOT);
const sanitizeId = (id: string): string => id.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);

export const operationalStateFilePath = (taskId: string, attemptId: string): string => (
  path.join(resolveStateRoot(), `${sanitizeId(taskId)}__${sanitizeId(attemptId)}.json`)
);

export const persistOperationalState = (state: OperationalState): void => {
  const filePath = operationalStateFilePath(state.taskId, state.attemptId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  atomicWriteText(
    filePath,
    JSON.stringify({ state, hash: hashOperationalState(state) }, null, 2),
    path.join(process.cwd(), STATE_TMP_DIR),
  );
};

export const loadPersistedOperationalState = (
  taskId: string,
  attemptId: string,
): { state: OperationalState; hash: string } | undefined => {
  const filePath = operationalStateFilePath(taskId, attemptId);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as { state: OperationalState; hash: string };
  } catch {
    return undefined;
  }
};
