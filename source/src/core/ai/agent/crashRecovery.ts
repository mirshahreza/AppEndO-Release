import type { AgentRuntimeEvent } from './runtimeEvents';
import { createRuntimeEvent, RuntimeEventSequencer } from './runtimeEvents';
import { resolveToolIdempotency } from './operationalPolicyEngine';

/**
 * V5 Phase P09 § V5-13 — crash-safe task runtime.
 *
 * `AgentOrchestrator.run()`'s tool-call loop is strictly sequential (one `await
 * toolRegistry.execute(...)` at a time — confirmed by direct inspection), so at most one
 * `ToolExecutionStarted` can ever be unresolved at the moment a process crashes: whichever one was
 * durably persisted (see `AgentEventStore.append`'s per-event persistence) last, with no later
 * `ToolExecutionCompleted`/`ToolExecutionFailed`/`ToolOutcomeUnknown` for the same tool.
 */
export type OrphanedToolExecution = {
  toolName: string;
  target: string;
  startedEvent: AgentRuntimeEvent;
};

/** Pure scan — walks the log in sequence order, tracks the single in-flight Started, if any. */
export const detectOrphanedToolExecution = (
  events: readonly AgentRuntimeEvent[],
): OrphanedToolExecution | undefined => {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  let pending: AgentRuntimeEvent | undefined;

  for (const event of ordered) {
    if (event.type === 'ToolExecutionStarted') {
      pending = event;
    } else if (
      event.type === 'ToolExecutionCompleted'
      || event.type === 'ToolExecutionFailed'
      || event.type === 'ToolOutcomeUnknown'
    ) {
      const payload = event.payload as { toolName: string; target: string };
      if (pending) {
        const pendingPayload = pending.payload as { toolName: string; target: string };
        if (pendingPayload.toolName === payload.toolName && pendingPayload.target === payload.target) {
          pending = undefined;
        }
      }
    }
  }

  if (!pending) return undefined;
  const payload = pending.payload as { toolName: string; target: string };
  return { toolName: payload.toolName, target: payload.target, startedEvent: pending };
};

export type ReconcileResult = {
  orphan?: OrphanedToolExecution;
  reconciliationEvent?: AgentRuntimeEvent;
};

/**
 * Called once at the start of a resumed `AgentOrchestrator.run()` (i.e. `config.taskId`/
 * `attemptId` refer to a prior attempt with a persisted event log). If the log ends on an
 * unresolved `ToolExecutionStarted`, synthesizes the `ToolOutcomeUnknown` event that closes it —
 * this is what `reduceOperationalState` consumes to populate `pendingUnknownOutcomes`, which
 * `DefaultOperationalPolicyEngine.validateProposal` then refuses to let a NOT_SAFE tool bypass.
 * Does not itself persist or replay state — the caller (`AgentOrchestrator.run()`) does that
 * through the same `recordRuntimeEvent`/`AgentEventStore` path every other event goes through, so
 * this reconciliation is indistinguishable from a normally-recorded event to every downstream
 * consumer (reducer, hash, persistence).
 */
export const reconcileEventLogOnResume = (
  taskId: string,
  attemptId: string,
  priorEvents: readonly AgentRuntimeEvent[],
  sequencer: RuntimeEventSequencer,
): ReconcileResult => {
  const orphan = detectOrphanedToolExecution(priorEvents);
  if (!orphan) return {};

  const reconciliationEvent = createRuntimeEvent({
    taskId,
    attemptId,
    type: 'ToolOutcomeUnknown',
    payload: {
      toolName: orphan.toolName,
      target: orphan.target,
      idempotency: resolveToolIdempotency(orphan.toolName),
    },
    sequencer,
    causationId: orphan.startedEvent.eventId,
  });

  return { orphan, reconciliationEvent };
};
