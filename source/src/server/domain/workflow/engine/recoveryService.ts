import { prisma } from '../prismaHelpers';
import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { listRunningNodesWithExpiredLease, reclaimStaleRunningNode } from '../workflowNodeInstanceRepository';
import { getLatestAttemptForNode } from '../workflowExecutionAttemptRepository';
import { getActionDefinition } from '../actions/registry';
import { resolveEffectiveRetryPolicy, matchesRetryPolicy, findMatchingRetrySelectorIdentity, applyAttemptRetryContinuation, applyAttemptUnhandledFailureContinuation, applyAttemptCaughtFailureContinuation, computeRetryDelayMs } from './attemptService';
import { runSagaCompensationForFailedInstance } from './sagaCompensationService';
import { logger } from '../../../../core/logging/Logger';
import { emitTraceAutoRevision } from './traceEmission';
import { errorEdgeOf, applyOutputAssignments } from './nodeExecution';
import { resolveJoinTargetInfo } from './parallelResolution';
import { buildEvaluationContext, loadNodeOutputsForInstance, parseJsonOrNull, parseVariables } from './evaluationContext';
import { dispatchClaimedNode, type DispatchResult } from './dispatchService';
import type { WorkflowModel, ActionNodeDefinition, JsonValue } from '../awm/types';
import type { WorkflowNodeInstanceRecord, WorkflowExecutionAttemptRecord } from '../types';
import { isWorkflowDomainError } from '../errors';

/**
 * `RECOVERY_CLAIMED` (doc 03 section 29) — its own small transaction, same "extra write, not folded
 * into the resolution transaction" trade-off as `attemptService.ts`'s `ACTION_RESOLVED`/
 * `ACTION_ATTEMPT_STARTED`: recovery's own resolution transaction (`applyAttemptRetryContinuation`/
 * `applyAttemptUnhandledFailureContinuation`/`dispatchClaimedNode`'s reclaim CAS) is fenced by
 * expected node/attempt version and can legitimately lose a race (`SKIPPED_RACE`) — emitting this
 * evidence *before* attempting resolution, unconditionally, would misrepresent a race loss as a
 * completed recovery claim. Emitted right before the resolution attempt so it's always paired with
 * an actual resolution attempt, win or lose (a `SKIPPED_RACE` still means recovery *did* claim
 * scanning ownership of that stale lease this pass — the trace records the claim, not the outcome).
 */
async function emitRecoveryClaimedTrace(input: { workflowInstanceId: number; nodeInstanceId: number; nodeOrAttemptIdentity: string; priorLeaseExpiry: string | null; recoveryPathClassification: string }): Promise<void> {
  await prisma().$transaction(async (tx) => {
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'RECOVERY_CLAIMED',
      actorType: 'SYSTEM',
      corePayload: { nodeOrAttemptIdentity: input.nodeOrAttemptIdentity, priorLeaseExpiry: input.priorLeaseExpiry, recoveryPathClassification: input.recoveryPathClassification },
    });
  });
}

/**
 * Recovery Scanner (doc 06 sections 2, 6, 16) — the Repository Reality Audit for Slice 5's
 * canonical clock boundary (doc 06 section 17) found no DB-native transaction-clock primitive
 * anywhere in this repository; the established, already-reviewed convention (`jobRepository.ts`'s
 * `claimNextPendingJob`, and every Slice 1 Workflow CAS helper) is the application-process
 * `new Date()` UTC wall clock. This is not a stop-the-slice gap — it is the identified canonical
 * convention — so recovery compares `leaseExpiresAt` against that same clock rather than a
 * database-side `NOW()`.
 *
 * Two independent recovery paths, both fenced by expected attempt/node `stateVersion` in the same
 * transaction as the resolution (doc 06 section 16: "claims recovery ownership by expected
 * attempt/node versions" and resolves in that same act — there is no separate claim-then-resolve
 * window for a second recoverer to race into):
 *
 * - a `RUNNING` node whose latest attempt is still `STARTED` (a crash mid-ACTION-execution) —
 *   `recoverExpiredActionAttempt`, doc 06 section 6/16 uncertainty resolution;
 * - a `RUNNING` node with an expired lease and no `STARTED` attempt (a crash before or after the
 *   attempt-begin transaction, or a non-ACTION node kind that has no attempts at all) —
 *   `recoverStaleRunningNode`, doc 06 section 16: "resumes... completes the missing atomic
 *   repository decision if no semantic commit occurred." Because DECISION/SWITCH/END/FAIL
 *   evaluation is a pure function of already-durable, unchanged context, redriving it is safe and
 *   idempotent even though no attempt row exists to key off of.
 */

const DEFAULT_RECOVERY_LEASE_DURATION_MS = 30_000;

/**
 * Doc 06 section 16's three-way choice, resolved for Slice 5 (no registered reconciliation adapter
 * exists in this repository's V1 built-ins — Slice 4 already found no event-bus/webhook primitive
 * to build one on, so that path is never taken here):
 *
 * "safe same-logical-invocation replay under the DEDUPLICATED-window contract" is implemented as:
 * the provider's registered idempotency guarantee is exactly `DEDUPLICATED` (calling the same
 * idempotency key again is provider-guaranteed not to duplicate the external effect), the resolved
 * retry policy still has attempts remaining, and a `TIMEOUT` selector matches (an expired lease
 * with no committed result is classified as a timeout-class uncertainty for retry-selector matching
 * — the frozen text does not name a distinct selector for this case, and doc 06 section 16 places
 * the recovery-replay sentence immediately after the TIMEOUT retry-matching paragraph). The stale
 * attempt is honestly recorded `UNKNOWN` either way — recovery never infers success from absence of
 * an error (doc 06 section 6) — and the *node* is allowed to retry only in the safe-replay branch.
 * Otherwise the attempt is `UNKNOWN` and the node/instance fail with `WF_ACTION_OUTCOME_UNKNOWN`.
 */
export async function recoverExpiredActionAttempt(node: WorkflowNodeInstanceRecord, attempt: WorkflowExecutionAttemptRecord): Promise<'SAFE_REPLAY_SCHEDULED' | 'UNKNOWN_FAILED' | 'SKIPPED_RACE'> {
  const instance = await getWorkflowInstanceById(node.workflowInstanceId);
  if (!instance) return 'SKIPPED_RACE';
  const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
  if (!revision) return 'SKIPPED_RACE';
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const nodeDef = model.nodes.find((n) => n.key === node.semanticNodeKey) as ActionNodeDefinition | undefined;
  if (!nodeDef || nodeDef.kind !== 'ACTION') return 'SKIPPED_RACE';

  const retryPolicy = resolveEffectiveRetryPolicy(nodeDef, model);
  const registered = attempt.actionKey && attempt.actionVersion ? getActionDefinition(attempt.actionKey, attempt.actionVersion) : undefined;
  const guarantee = registered?.definition.idempotency.guarantee;
  const classification = { isTimeout: true };
  const isSafeReplay = guarantee === 'DEDUPLICATED' && matchesRetryPolicy(retryPolicy, classification) && attempt.attemptNumber < retryPolicy.maxAttempts;
  const terminalPatch = { command: 'UNSAFE_UNCERTAINTY' as const, errorCode: 'WF_ACTION_OUTCOME_UNKNOWN', errorMessage: 'Recovery detected an expired lease with an uncommitted STARTED attempt.' };

  try {
    await emitRecoveryClaimedTrace({
      workflowInstanceId: instance.id,
      nodeInstanceId: node.id,
      nodeOrAttemptIdentity: `attempt:${attempt.id}`,
      priorLeaseExpiry: node.leaseExpiresAt ?? null,
      recoveryPathClassification: isSafeReplay ? 'SAFE_REPLAY' : 'UNSAFE_UNCERTAINTY',
    });

    if (isSafeReplay) {
      const delayMs = computeRetryDelayMs(retryPolicy, attempt.attemptNumber);
      await applyAttemptRetryContinuation({
        workflowInstanceId: instance.id,
        nodeInstanceId: node.id,
        sourceNodeKey: nodeDef.key,
        attemptId: attempt.id,
        expectedAttemptStateVersion: attempt.stateVersion,
        expectedNodeStateVersion: node.stateVersion,
        terminalPatch,
        nextEligibleAt: new Date(Date.now() + delayMs),
        matchedRetrySelectorIdentity: findMatchingRetrySelectorIdentity(retryPolicy, classification),
      });
      return 'SAFE_REPLAY_SCHEDULED';
    }

    // WFV2-1 — an uncertain (crash-recovered) outcome is still an "it didn't reliably work" case
    // from the author's point of view; route it through the same ON_ERROR edge a confirmed failure
    // would use, rather than always failing the whole instance, if one is declared.
    const errorEdge = errorEdgeOf(model, nodeDef.key);
    if (errorEdge) {
      const errorOutput: JsonValue = { errorCode: terminalPatch.errorCode, errorClass: null, safeMessage: terminalPatch.errorMessage ?? 'Recovery could not confirm this attempt\'s outcome.', isTimeout: false };
      const workflowInput = parseJsonOrNull(instance.inputJson);
      const variables = parseVariables(instance.contextJson);
      const nodeOutputs = await loadNodeOutputsForInstance(instance.id);
      const evaluationContext = buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null });
      const updatedVariables = nodeDef.outputAssignments?.length
        ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, errorOutput)
        : undefined;
      const joinInfo = resolveJoinTargetInfo(model, errorEdge.toNodeKey);
      await applyAttemptCaughtFailureContinuation({
        workflowInstanceId: instance.id,
        nodeInstanceId: node.id,
        sourceNodeKey: nodeDef.key,
        attemptId: attempt.id,
        expectedAttemptStateVersion: attempt.stateVersion,
        expectedNodeStateVersion: node.stateVersion,
        terminalPatch,
        nodeOutput: errorOutput,
        edgeKey: errorEdge.key,
        targetNodeKey: errorEdge.toNodeKey,
        updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
        targetIsJoin: joinInfo.targetIsJoin,
        join: joinInfo.join,
        sourceBranchTokenId: node.branchTokenId,
      });
      return 'UNKNOWN_FAILED';
    }

    await applyAttemptUnhandledFailureContinuation({
      workflowInstanceId: instance.id,
      nodeInstanceId: node.id,
      sourceNodeKey: nodeDef.key,
      attemptId: attempt.id,
      expectedAttemptStateVersion: attempt.stateVersion,
      expectedNodeStateVersion: node.stateVersion,
      expectedInstanceStateVersion: instance.stateVersion,
      terminalPatch,
    });
    try {
      await runSagaCompensationForFailedInstance(instance.id);
    } catch (error) {
      logger.error('SagaCompensation', `Saga compensation pass threw for instance ${instance.id}: ${error instanceof Error ? error.message : String(error)}`, { workflowInstanceId: instance.id });
    }
    return 'UNKNOWN_FAILED';
  } catch (error) {
    if (isWorkflowDomainError(error) && error.code === 'WF_EXEC_STALE_STATE_VERSION') return 'SKIPPED_RACE';
    throw error;
  }
}

/** Reclaims a stale `RUNNING` node with no in-flight attempt and safely redrives its (pure, not-yet-committed) evaluation. */
export async function recoverStaleRunningNode(node: WorkflowNodeInstanceRecord, leaseOwnerId: string, leaseDurationMs = DEFAULT_RECOVERY_LEASE_DURATION_MS): Promise<DispatchResult | 'SKIPPED_RACE' | 'INSTANCE_NOT_EXECUTABLE'> {
  let reclaimed;
  try {
    reclaimed = await reclaimStaleRunningNode(node.id, node.stateVersion, leaseOwnerId, leaseDurationMs);
  } catch (error) {
    if (isWorkflowDomainError(error) && error.code === 'WF_EXEC_STALE_STATE_VERSION') return 'SKIPPED_RACE';
    throw error;
  }
  const instance = await getWorkflowInstanceById(reclaimed.workflowInstanceId);
  if (!instance || instance.status !== 'RUNNING') return 'INSTANCE_NOT_EXECUTABLE';
  await emitRecoveryClaimedTrace({
    workflowInstanceId: instance.id,
    nodeInstanceId: reclaimed.id,
    nodeOrAttemptIdentity: `node:${reclaimed.id}`,
    priorLeaseExpiry: node.leaseExpiresAt ?? null,
    recoveryPathClassification: 'STALE_NODE_REDRIVE',
  });
  return dispatchClaimedNode(reclaimed, instance);
}

export type RecoveryScanSummary = { scanned: number; safeReplayScheduled: number; unknownFailed: number; staleReclaimed: number; skipped: number };

/** The Recovery Scanner entry point (doc 06 section 2) — intended to be invoked periodically by AppEndO Job infrastructure; exposed here as a plain importable function per doc 06 section 2 ("worker deployment topology is not semantic authority"). */
export async function scanAndRecoverExpiredLeases(leaseOwnerId: string): Promise<RecoveryScanSummary> {
  const staleNodes = await listRunningNodesWithExpiredLease();
  const summary: RecoveryScanSummary = { scanned: staleNodes.length, safeReplayScheduled: 0, unknownFailed: 0, staleReclaimed: 0, skipped: 0 };

  for (const node of staleNodes) {
    const latestAttempt = await getLatestAttemptForNode(node.id);
    if (latestAttempt && latestAttempt.status === 'STARTED') {
      const outcome = await recoverExpiredActionAttempt(node, latestAttempt);
      if (outcome === 'SAFE_REPLAY_SCHEDULED') summary.safeReplayScheduled += 1;
      else if (outcome === 'UNKNOWN_FAILED') summary.unknownFailed += 1;
      else summary.skipped += 1;
    } else {
      const outcome = await recoverStaleRunningNode(node, leaseOwnerId);
      if (outcome === 'SKIPPED_RACE' || outcome === 'INSTANCE_NOT_EXECUTABLE') summary.skipped += 1;
      else summary.staleReclaimed += 1;
    }
  }

  return summary;
}
