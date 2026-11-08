import { prisma, toId, fromId } from '../prismaHelpers';
import { WorkflowDomainError, isWorkflowDomainError } from '../errors';
import { canonicalJsonFingerprint } from '../canonicalJson';
import { emitTraceAutoRevision } from './traceEmission';
import { readControlPlaneProvider } from '../../users/prismaHelpers';
import { revertRunningNodeToReadyAfterCreationFailure } from '../workflowNodeInstanceRepository';
import { parkDeadLetterInTx } from '../workflowDeadLetterRepository';
import type { JsonValue } from '../awm/types';
import type { Tx as SharedTx } from './txTypes';
import type { WorkflowTraceType } from '../traceTypes';

/**
 * Repository transaction methods for the `ContinuationDecision` kinds — doc 06 section 15's
 * "repositories expose semantic transaction methods corresponding to these decisions; they do not
 * accept arbitrary downstream row arrays."
 *
 * These write directly against `prisma().$transaction` (the same pattern already established by
 * `workflowRevisionRepository.ts`'s `activateWorkflowRevisionPublicationAtomically`) rather than
 * composing the individual Slice 1 CAS helper functions, because those helpers each open their own
 * implicit (non-transactional) client call and doc 06 section 4 requires "node success/output,
 * required trace core evidence, downstream durable work and aggregate status... committed
 * atomically" as one transaction.
 */

export const NON_TERMINAL_NODE_STATUSES = ['PENDING', 'READY', 'RUNNING', 'WAITING', 'WAITING_HUMAN', 'RETRYING'] as const;

export type Tx = SharedTx;

export type EdgeTargetJoin = { mode: 'ALL' | 'ANY' | 'THRESHOLD'; thresholdCount?: number; cancelRemaining: boolean };

export type ResolveEdgeTargetInput = {
  workflowInstanceId: number;
  edgeKey: string;
  targetNodeKey: string;
  /** True when the resolved edge's target node kind is PARALLEL_JOIN (doc 05 section 32) — caller determines this from the pinned model. */
  targetIsJoin: boolean;
  join?: EdgeTargetJoin;
  /** The completing (source) node's own `branchTokenId`, if it is itself a branch member (doc 03 section 24 propagation / arrival identity). */
  sourceBranchTokenId?: number | null;
};

/**
 * Shared "final phase" of every SELECT_EDGE-shaped completion transaction (doc 03 section 24, doc 05
 * section 32): either readies a single PENDING target — propagating the completing node's own
 * `branchTokenId`, if any, into the same-branch downstream node — or, when the resolved edge's
 * target is a PARALLEL_JOIN, records this branch's arrival and, if that arrival satisfies the join
 * (doc 05 section 22's ALL/ANY matrix), readies the join node and (`ANY` + `cancelRemaining`)
 * durably cancels sibling branches once. Always called from inside an already-open `$transaction`
 * callback — never opens its own — so it composes into `applySelectEdgeContinuation`,
 * `applyAttemptSuccessContinuation` and `applyWaitTerminalSelectEdgeContinuation` as one atomic unit
 * with whatever else those callers already committed (source node completion, variable assignment,
 * inbox correlation).
 */
export async function resolveEdgeTarget(tx: Tx, input: ResolveEdgeTargetInput): Promise<void> {
  if (!input.targetIsJoin) {
    const targetUpdate = await tx.workflowNodeInstance.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), semanticNodeKey: input.targetNodeKey, status: 'PENDING' },
      data: {
        status: 'READY',
        selectedIncomingEdgeKey: input.edgeKey,
        stateVersion: { increment: 1 },
        ...(input.sourceBranchTokenId != null ? { branchTokenId: toId(input.sourceBranchTokenId) } : {}),
      },
    });
    if (targetUpdate.count === 0) {
      throw new WorkflowDomainError(
        'WF_EXEC_ENGINE_INVARIANT',
        `Target node "${input.targetNodeKey}" is not PENDING — either already readied by another predecessor or its occurrence is missing.`,
        { targetNodeKey: input.targetNodeKey, workflowInstanceId: input.workflowInstanceId },
      );
    }
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      traceType: 'NODE_READY',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.targetNodeKey, edgeKey: input.edgeKey, ...(input.sourceBranchTokenId != null ? { branchTokenId: String(input.sourceBranchTokenId) } : {}) },
    });
    return;
  }

  if (input.sourceBranchTokenId == null || !input.join) {
    throw new WorkflowDomainError(
      'WF_EXEC_ENGINE_INVARIANT',
      `A branch-ending node reaching PARALLEL_JOIN "${input.targetNodeKey}" must carry a branchTokenId and resolved join metadata.`,
      { targetNodeKey: input.targetNodeKey },
    );
  }

  const tokenUpdate = await tx.workflowBranchToken.updateMany({
    where: { id: toId(input.sourceBranchTokenId), status: 'ACTIVE' },
    data: { status: 'ARRIVED', terminalAt: new Date(), stateVersion: { increment: 1 } },
  });
  if (tokenUpdate.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Branch token is not ACTIVE — already arrived or cancelled (race).', { branchTokenId: input.sourceBranchTokenId });
  }
  const token = await tx.workflowBranchToken.findUnique({ where: { id: toId(input.sourceBranchTokenId) } });
  if (!token) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowBranchToken not found after CAS.', { branchTokenId: input.sourceBranchTokenId });
  }

  const joinNode = await tx.workflowNodeInstance.findFirst({
    where: { workflowInstanceId: toId(input.workflowInstanceId), semanticNodeKey: input.targetNodeKey },
  });
  if (!joinNode) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `PARALLEL_JOIN node "${input.targetNodeKey}" occurrence is missing.`, { targetNodeKey: input.targetNodeKey });
  }

  await tx.workflowJoinArrival.create({
    data: { workflowInstanceId: toId(input.workflowInstanceId), joinNodeInstanceId: joinNode.id, branchTokenId: toId(input.sourceBranchTokenId) },
  });

  await emitTraceAutoRevision(tx, {
    workflowInstanceId: input.workflowInstanceId,
    nodeInstanceId: fromId(joinNode.id),
    traceType: 'PARALLEL_JOIN_ARRIVAL',
    actorType: 'SYSTEM',
    corePayload: { nodeKey: input.targetNodeKey, branchTokenId: String(input.sourceBranchTokenId), joinGroupKey: token.splitNodeKey, splitNodeKey: token.splitNodeKey, joinNodeKey: input.targetNodeKey },
  });

  // Serializes concurrent arrivals for the SAME join: a plain UPDATE takes a Postgres row lock for
  // the transaction's duration, so a concurrent sibling arrival's own lock-acquire blocks until this
  // transaction commits. Without it, two truly-concurrent COUNTs could each see only their own
  // uncommitted arrival and neither would (wrongly) conclude the join is satisfied. Doubles as the
  // `joinGroupKey` evidence tag (doc 03 section 24) — idempotent across repeated arrivals.
  await tx.workflowNodeInstance.updateMany({ where: { id: joinNode.id }, data: { joinGroupKey: token.splitNodeKey } });

  const arrivalCount = await tx.workflowJoinArrival.count({ where: { joinNodeInstanceId: joinNode.id } });
  const requiredTokenCount = await tx.workflowBranchToken.count({ where: { workflowInstanceId: toId(input.workflowInstanceId), splitNodeKey: token.splitNodeKey } });
  const satisfied = input.join.mode === 'ALL'
    ? arrivalCount >= requiredTokenCount
    : input.join.mode === 'THRESHOLD'
      // WFV2-18 (van der Aalst N-out-of-M Join / Discriminator pattern) — `thresholdCount` is
      // validated at publish time (parallelValidation.ts) to be within 1..branchCount; falling
      // back to `requiredTokenCount` here only guards a theoretical stale/unresolved value, it is
      // never expected to be hit against a published revision.
      ? arrivalCount >= (input.join.thresholdCount ?? requiredTokenCount)
      : arrivalCount === 1;
  if (!satisfied) return;

  const readyUpdate = await tx.workflowNodeInstance.updateMany({ where: { id: joinNode.id, status: 'PENDING' }, data: { status: 'READY', stateVersion: { increment: 1 } } });
  if (readyUpdate.count === 0) {
    // ALL: cannot happen — arrivalCount can reach requiredTokenCount at most once (on the single
    // last-arriving branch), and this whole function runs while holding the join-row lock above.
    // ANY: also cannot happen — an ANY join is "satisfied" exactly when arrivalCount === 1, i.e.
    // only for the very first arrival while still holding that same lock, so no sibling can have
    // raced ahead of it. THRESHOLD: same argument as ALL — arrivalCount crosses the threshold at
    // most once (on the single arrival that brings it from thresholdCount-1 to thresholdCount),
    // under the same held lock.
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `PARALLEL_JOIN "${input.targetNodeKey}" satisfaction reached but the node was not PENDING.`, { targetNodeKey: input.targetNodeKey });
  }

  await emitTraceAutoRevision(tx, {
    workflowInstanceId: input.workflowInstanceId,
    nodeInstanceId: fromId(joinNode.id),
    traceType: 'PARALLEL_JOIN_WON',
    actorType: 'SYSTEM',
    corePayload: { nodeKey: input.targetNodeKey, branchTokenId: String(input.sourceBranchTokenId), joinGroupKey: token.splitNodeKey, splitNodeKey: token.splitNodeKey, joinNodeKey: input.targetNodeKey, winnerTokenId: String(input.sourceBranchTokenId) },
  });
  await emitTraceAutoRevision(tx, {
    workflowInstanceId: input.workflowInstanceId,
    nodeInstanceId: fromId(joinNode.id),
    traceType: 'NODE_READY',
    actorType: 'SYSTEM',
    corePayload: { nodeKey: input.targetNodeKey },
  });

  if ((input.join.mode === 'ANY' || input.join.mode === 'THRESHOLD') && input.join.cancelRemaining) {
    const siblingTokens = await tx.workflowBranchToken.findMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), splitNodeKey: token.splitNodeKey, status: 'ACTIVE' },
    });
    let anySiblingCancelled = false;
    for (const sibling of siblingTokens) {
      await tx.workflowBranchToken.updateMany({ where: { id: sibling.id, status: 'ACTIVE' }, data: { status: 'CANCELLED', terminalAt: new Date(), stateVersion: { increment: 1 } } });

      const siblingNodes = await tx.workflowNodeInstance.findMany({
        where: { workflowInstanceId: toId(input.workflowInstanceId), branchTokenId: sibling.id, status: { in: [...NON_TERMINAL_NODE_STATUSES] } },
        select: { id: true },
      });
      const siblingNodeIds = siblingNodes.map((n) => n.id);
      if (siblingNodeIds.length === 0) continue;
      anySiblingCancelled = true;

      await tx.workflowNodeInstance.updateMany({
        where: { id: { in: siblingNodeIds } },
        data: { status: 'CANCELLED', leaseOwnerId: null, leaseExpiresAt: null, nextEligibleAt: null, stateVersion: { increment: 1 } },
      });
      await cancelActiveWaitsWithTrace(tx, input.workflowInstanceId, siblingNodeIds);
      await tx.workflowExecutionAttempt.updateMany({
        where: { nodeInstanceId: { in: siblingNodeIds }, status: 'STARTED' },
        data: { status: 'CANCELLED', completedAt: new Date(), stateVersion: { increment: 1 } },
      });
    }
    if (anySiblingCancelled) {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: fromId(joinNode.id),
        traceType: 'PARALLEL_SIBLINGS_CANCELLED',
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.targetNodeKey, joinGroupKey: token.splitNodeKey, splitNodeKey: token.splitNodeKey, joinNodeKey: input.targetNodeKey },
      });
    }
  }
}

/**
 * Shared helper — cancels every `ACTIVE` `WorkflowWait` owned by one of `nodeInstanceIds` and emits
 * one `WAIT_CANCELLED` trace row per wait actually cancelled (doc 03 section 29: "wait type, prior
 * wait version, winner reason and owning node key"). Reads the about-to-be-cancelled waits first
 * (bounded — at most one ACTIVE wait per node occurrence) so each gets accurate per-row evidence;
 * used by every bulk cancellation sweep (`applyCancelInstanceContinuation`,
 * `applyFailInstanceContinuation`, `applyAttemptUnhandledFailureContinuation`,
 * `cancelInstanceAndDescendantsInTx`, the ANY+cancelRemaining sibling sweep above).
 */
async function cancelActiveWaitsWithTrace(tx: Tx, workflowInstanceId: number, nodeInstanceIds: bigint[], winnerReason = 'owning node cancelled'): Promise<void> {
  if (nodeInstanceIds.length === 0) return;
  const toCancel = await tx.workflowWait.findMany({
    where: { owningNodeInstanceId: { in: nodeInstanceIds }, status: 'ACTIVE' },
    select: { id: true, waitType: true, stateVersion: true, owningNodeInstanceId: true },
  });
  if (toCancel.length === 0) return;
  await tx.workflowWait.updateMany({
    where: { id: { in: toCancel.map((w) => w.id) } },
    data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
  });
  for (const wait of toCancel) {
    const owningNode = await tx.workflowNodeInstance.findUnique({ where: { id: wait.owningNodeInstanceId }, select: { semanticNodeKey: true } });
    await emitTraceAutoRevision(tx, {
      workflowInstanceId,
      nodeInstanceId: fromId(wait.owningNodeInstanceId),
      traceType: 'WAIT_CANCELLED',
      actorType: 'SYSTEM',
      corePayload: { waitId: String(wait.id), waitType: wait.waitType, priorWaitVersion: wait.stateVersion, winnerReason, owningNodeKey: owningNode?.semanticNodeKey ?? 'UNKNOWN' },
    });
  }
}

/** Instance-wide sibling of `cancelActiveWaitsWithTrace` above — every remaining bulk-cancellation sweep (`applyCancelInstanceContinuation`, `applyFailInstanceContinuation`, `applyAttemptUnhandledFailureContinuation`, `cancelInstanceAndDescendantsInTx`) cancels every `ACTIVE` wait for the whole instance, not a specific node subset. */
export async function cancelAllActiveWaitsForInstanceWithTrace(tx: Tx, workflowInstanceId: number, winnerReason: string): Promise<void> {
  const toCancel = await tx.workflowWait.findMany({
    where: { workflowInstanceId: toId(workflowInstanceId), status: 'ACTIVE' },
    select: { id: true, waitType: true, stateVersion: true, owningNodeInstanceId: true },
  });
  if (toCancel.length === 0) return;
  await tx.workflowWait.updateMany({
    where: { id: { in: toCancel.map((w) => w.id) } },
    data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
  });
  for (const wait of toCancel) {
    const owningNode = await tx.workflowNodeInstance.findUnique({ where: { id: wait.owningNodeInstanceId }, select: { semanticNodeKey: true } });
    await emitTraceAutoRevision(tx, {
      workflowInstanceId,
      nodeInstanceId: fromId(wait.owningNodeInstanceId),
      traceType: 'WAIT_CANCELLED',
      actorType: 'SYSTEM',
      corePayload: { waitId: String(wait.id), waitType: wait.waitType, priorWaitVersion: wait.stateVersion, winnerReason, owningNodeKey: owningNode?.semanticNodeKey ?? 'UNKNOWN' },
    });
  }
}

export type SelectEdgeApplyInput = {
  workflowInstanceId: number;
  completingNodeInstanceId: number;
  sourceNodeKey: string;
  selectionMode: string;
  selectionReason: string;
  expectedNodeStateVersion: number;
  nodeOutput: JsonValue;
  edgeKey: string;
  targetNodeKey: string;
  /** Present only when the completing node declared `outputAssignments` (doc 05 section 24). */
  updatedVariables?: { variables: Record<string, JsonValue>; expectedInstanceStateVersion: number };
  targetIsJoin?: boolean;
  join?: EdgeTargetJoin;
  sourceBranchTokenId?: number | null;
};

/** Doc 06 section 4 processing transaction for a `SELECT_EDGE` decision — completes the source node, optionally commits context assignments, and resolves the target (doc 03 section 24 / doc 05 section 32 — a plain PENDING readying, or a PARALLEL_JOIN arrival). */
export async function applySelectEdgeContinuation(input: SelectEdgeApplyInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.completingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'RUNNING' },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(input.nodeOutput), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Completing WorkflowNodeInstance is not RUNNING at the expected version.', { id: input.completingNodeInstanceId });
    }

    if (input.updatedVariables) {
      const contextUpdate = await tx.workflowInstance.updateMany({
        where: { id: toId(input.workflowInstanceId), stateVersion: input.updatedVariables.expectedInstanceStateVersion },
        data: { contextJson: JSON.stringify(input.updatedVariables.variables), stateVersion: { increment: 1 } },
      });
      if (contextUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance stateVersion is stale for context-assignment commit.', { workflowInstanceId: input.workflowInstanceId });
      }
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.completingNodeInstanceId,
        traceType: 'EXPRESSION_EVALUATED',
        actorType: 'SYSTEM',
        corePayload: {
          nodeKey: input.sourceNodeKey,
          expressionFingerprint: canonicalJsonFingerprint(input.updatedVariables.variables),
          evaluationContextFingerprints: [],
          result: { kind: 'VALUE', typedResult: input.updatedVariables.variables },
        },
      });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.completingNodeInstanceId,
      traceType: 'EDGE_SELECTED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, edgeKey: input.edgeKey, sourceNodeKey: input.sourceNodeKey, selectionMode: input.selectionMode, selectionReason: input.selectionReason, selectedEdgeKey: input.edgeKey },
    });

    await resolveEdgeTarget(tx, {
      workflowInstanceId: input.workflowInstanceId,
      edgeKey: input.edgeKey,
      targetNodeKey: input.targetNodeKey,
      targetIsJoin: input.targetIsJoin ?? false,
      join: input.join,
      sourceBranchTokenId: input.sourceBranchTokenId,
    });
  });
}

export type CompleteInstanceApplyInput = {
  workflowInstanceId: number;
  completingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  expectedInstanceStateVersion: number;
  output: JsonValue;
};

/**
 * Doc 07 section 6 — "Workflow cancellation closes active Work Items as CANCELLED without deleting
 * completed evidence/history." Shared by every instance-level cancel/fail cleanup transaction
 * (cancel, FAIL-node propagation, ACTION retry-exhaustion propagation — all three "cancel every
 * remaining non-terminal thing" transactions). Reads active (`OPEN`/`CLAIMED`) Work Items first so
 * each gets a correct per-row `fromStatus` transition-evidence entry, matching
 * `workItemTransitionRepository.ts`'s established shape.
 */
export async function closeActiveWorkItemsInTx(tx: Tx, workflowInstanceId: number, reasonCode: string): Promise<void> {
  const active = await tx.workItem.findMany({
    where: { workflowInstanceId: toId(workflowInstanceId), status: { in: ['OPEN', 'CLAIMED'] } },
    select: { id: true, status: true, stateVersion: true, workItemType: true, nodeInstanceId: true },
  });
  if (active.length === 0) return;

  await tx.workItem.updateMany({
    where: { id: { in: active.map((w) => w.id) } },
    data: { status: 'CANCELLED', completedAt: new Date(), stateVersion: { increment: 1 } },
  });

  await tx.workItemTransition.createMany({
    data: active.map((w) => ({
      workItemId: w.id,
      fromStatus: w.status,
      toStatus: 'CANCELLED',
      transitionType: 'CANCEL',
      actorType: 'SYSTEM',
      reasonCode,
      workItemStateVersionAfter: w.stateVersion + 1,
    })),
  });

  for (const w of active) {
    await emitTraceAutoRevision(tx, {
      workflowInstanceId,
      nodeInstanceId: fromId(w.nodeInstanceId),
      traceType: 'WORK_ITEM_CANCELLED',
      actorType: 'SYSTEM',
      corePayload: { workItemId: String(w.id), workItemType: w.workItemType, transitionType: 'CANCEL', actorType: 'SYSTEM', resultingWorkItemStateVersion: w.stateVersion + 1 },
    });
  }
}

/**
 * Doc 05 section 16 — "Every active child instance reachable through an ACTIVE SUBFLOW wait is
 * cancelled through the authorized parent-system cancellation path. Propagation is recursive,
 * idempotent... Already-terminal child instances remain unchanged and retain evidence." Shared by
 * every instance-level cancel/fail cleanup transaction (cancel, FAIL-node propagation, ACTION
 * retry-exhaustion propagation, and Slice 9's subflow-child-failure propagation).
 *
 * There is no external caller-supplied expected version for an indirectly-reached grandchild, so
 * the status-based CAS (`status IN (...)`) below is itself the idempotency fence for the recursive
 * cascade — running it twice is a no-op the second time, matching "idempotent". The top-level
 * instance being cancelled/failed still uses its own caller-supplied `expectedInstanceStateVersion`
 * (in the calling function, before this helper runs).
 */
export async function cascadeCancelChildInstances(tx: Tx, workflowInstanceId: number): Promise<void> {
  const subflowWaits = await tx.workflowWait.findMany({
    where: { workflowInstanceId: toId(workflowInstanceId), waitType: 'SUBFLOW', childInstanceId: { not: null } },
    select: { childInstanceId: true },
  });
  for (const wait of subflowWaits) {
    if (wait.childInstanceId == null) continue;
    await cancelInstanceAndDescendantsInTx(tx, fromId(wait.childInstanceId));
  }
}

/** p-99/WFT-9 — exported for `subflowContinuationApply.ts`'s Cancel Region continuation, which needs
 * to cancel one specific already-known child instance (+ its own descendants) directly, without the
 * `cascadeCancelChildInstances` traversal step (it doesn't need to *discover* the child via a
 * `WorkflowWait` lookup — the wait row it's already handling names the child directly). */
export async function cancelInstanceAndDescendantsInTx(tx: Tx, instanceId: number): Promise<void> {
  const instanceUpdate = await tx.workflowInstance.updateMany({
    where: { id: toId(instanceId), status: { in: ['CREATED', 'RUNNING', 'SUSPENDED'] } },
    data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
  });
  if (instanceUpdate.count === 0) return; // already terminal — idempotent no-op

  await emitTraceAutoRevision(tx, {
    workflowInstanceId: instanceId,
    traceType: 'INSTANCE_CANCELLED',
    actorType: 'SYSTEM',
    corePayload: {},
  });

  await tx.workflowExecutionAttempt.updateMany({
    where: { workflowInstanceId: toId(instanceId), status: 'STARTED' },
    data: { status: 'CANCELLED', completedAt: new Date(), stateVersion: { increment: 1 } },
  });
  await tx.workflowNodeInstance.updateMany({
    where: { workflowInstanceId: toId(instanceId), status: { in: [...NON_TERMINAL_NODE_STATUSES] } },
    data: { status: 'CANCELLED', leaseOwnerId: null, leaseExpiresAt: null, nextEligibleAt: null, stateVersion: { increment: 1 } },
  });
  await cancelAllActiveWaitsForInstanceWithTrace(tx, instanceId, 'parent instance cancellation cascade');
  await tx.workflowBranchToken.updateMany({
    where: { workflowInstanceId: toId(instanceId), status: 'ACTIVE' },
    data: { status: 'CANCELLED', terminalAt: new Date(), stateVersion: { increment: 1 } },
  });
  await closeActiveWorkItemsInTx(tx, instanceId, 'PARENT_CANCELLED');
  await cascadeCancelChildInstances(tx, instanceId); // recurse into grandchildren
}

/**
 * Doc 03 section 26 instance terminal transaction for a successful `END` decision. A published,
 * structurally valid graph can only reach `END` downstream of every parallel region's join (doc 05
 * section 32's single-level containment rule), so "no ACTIVE branch token or required non-terminal
 * branch can still produce required work" is a structural guarantee, not something this transaction
 * re-derives. Any sibling `PENDING` occurrences on branches that were never selected (e.g. an
 * unvisited DECISION branch) are left as inert `PENDING` rows rather than cancelled, since doc 03
 * section 26 only mandates cleanup for eligible non-terminal work, and an unvisited branch was never
 * eligible.
 */
export async function applyCompleteInstanceContinuation(input: CompleteInstanceApplyInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.completingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'RUNNING' },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(input.output), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Completing END WorkflowNodeInstance is not RUNNING at the expected version.', { id: input.completingNodeInstanceId });
    }

    const instanceUpdate = await tx.workflowInstance.updateMany({
      where: { id: toId(input.workflowInstanceId), stateVersion: input.expectedInstanceStateVersion, status: 'RUNNING' },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(input.output), stateVersion: { increment: 1 } },
    });
    if (instanceUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance is not RUNNING at the expected version — a race already won instance completion.', { workflowInstanceId: input.workflowInstanceId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.completingNodeInstanceId,
      traceType: 'INSTANCE_SUCCEEDED',
      actorType: 'SYSTEM',
      corePayload: {},
    });
  });
}

export type FailInstanceApplyInput = {
  workflowInstanceId: number;
  failingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  expectedInstanceStateVersion: number;
  /** FAIL node's own authored error code (doc 05 section 7) — `WorkflowNodeInstance` has no error-code column (Slice 5's already-documented gap), so INSTANCE_FAILED's `machineErrorCode` core evidence can only come from the caller. */
  nodeKey: string;
  errorCode: string;
};

/**
 * Doc 05 section 29 V1 terminal failure propagation — marks the failing node and the owning
 * instance `FAILED` in one transaction, then cancels every remaining non-terminal node occurrence,
 * every ACTIVE wait, every ACTIVE branch token and every active (`OPEN`/`CLAIMED`) Work Item (doc 03
 * section 26, doc 05 section 29's "cancels all remaining non-terminal node occurrences, ACTIVE
 * waits and active Work Items"). Shared by FAIL-node execution and ACTION retry-exhaustion
 * propagation — both are "the winning domain transition marks the node FAILED and the owning
 * non-terminal instance FAILED in one engine transaction" per doc 05 section 29.
 *
 * Slice 6 added the ACTIVE-wait sweep; Slice 7 added the ACTIVE-branch-token sweep; Slice 8 adds
 * the Work Item sweep (doc 07 section 6). Child-subflow cancellation propagation remains Slice 9.
 */
export async function applyFailInstanceContinuation(input: FailInstanceApplyInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.failingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: { in: ['RUNNING', 'RETRYING', 'WAITING', 'WAITING_HUMAN'] } },
      data: { status: 'FAILED', stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Failing WorkflowNodeInstance is not in a failable status at the expected version.', { id: input.failingNodeInstanceId });
    }

    const instanceUpdate = await tx.workflowInstance.updateMany({
      where: { id: toId(input.workflowInstanceId), stateVersion: input.expectedInstanceStateVersion, status: 'RUNNING' },
      data: { status: 'FAILED', stateVersion: { increment: 1 } },
    });
    if (instanceUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance is not RUNNING at the expected version — a race already won instance completion.', { workflowInstanceId: input.workflowInstanceId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.failingNodeInstanceId,
      traceType: 'INSTANCE_FAILED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.nodeKey, machineErrorCode: input.errorCode, causalIdentity: input.nodeKey },
    });

    await tx.workflowNodeInstance.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), id: { not: toId(input.failingNodeInstanceId) }, status: { in: [...NON_TERMINAL_NODE_STATUSES] } },
      data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
    });

    await cancelAllActiveWaitsForInstanceWithTrace(tx, input.workflowInstanceId, 'owning instance failed');

    await closeActiveWorkItemsInTx(tx, input.workflowInstanceId, 'INSTANCE_FAILED');

    await parkDeadLetterInTx(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.failingNodeInstanceId,
      nodeKey: input.nodeKey,
      errorCode: input.errorCode,
      evidenceJson: JSON.stringify({ source: 'FAIL_NODE' }),
    });

    await tx.workflowBranchToken.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), status: 'ACTIVE' },
      data: { status: 'CANCELLED', terminalAt: new Date(), stateVersion: { increment: 1 } },
    });

    await cascadeCancelChildInstances(tx, input.workflowInstanceId);
  });
  void import('./eventFailureNotify').then(({ emitWorkflowInstanceFailedEvent }) =>
    emitWorkflowInstanceFailedEvent({ workflowInstanceId: input.workflowInstanceId, errorCode: input.errorCode }),
  );
}

// ---------------------------------------------------------------------------
// Parallel split/join (doc 06 section 15; doc 05 sections 5, 22, 32; doc 03 section 24) — Slice 7.
// ---------------------------------------------------------------------------

export type ApplyStartParallelInput = {
  workflowInstanceId: number;
  splitNodeInstanceId: number;
  expectedNodeStateVersion: number;
  splitNodeKey: string;
  joinNodeKey: string;
  branches: { edgeKey: string; toNodeKey: string }[];
};

/**
 * Doc 05 section 32 PARALLEL_SPLIT creation phase — completes the split node (output `null`,
 * matching DECISION/SWITCH/PARALLEL_JOIN's control-flow-only output convention) and, in the same
 * transaction, creates one branch token per outgoing branch edge and readies each branch's first
 * node with that token attached (doc 03 section 24: "The split creates one branch token per
 * outgoing edge... writes the token ID to its node occurrence").
 */
export async function applyStartParallelContinuation(input: ApplyStartParallelInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.splitNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'RUNNING' },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(null), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Completing PARALLEL_SPLIT WorkflowNodeInstance is not RUNNING at the expected version.', { id: input.splitNodeInstanceId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.splitNodeInstanceId,
      traceType: 'PARALLEL_SPLIT_CREATED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.splitNodeKey, joinGroupKey: input.splitNodeKey, splitNodeKey: input.splitNodeKey, joinNodeKey: input.joinNodeKey },
    });

    for (const branch of input.branches) {
      const token = await tx.workflowBranchToken.create({
        data: {
          workflowInstanceId: toId(input.workflowInstanceId),
          splitNodeKey: input.splitNodeKey,
          joinNodeKey: input.joinNodeKey,
          branchEdgeKey: branch.edgeKey,
          status: 'ACTIVE',
        },
      });
      const targetUpdate = await tx.workflowNodeInstance.updateMany({
        where: { workflowInstanceId: toId(input.workflowInstanceId), semanticNodeKey: branch.toNodeKey, status: 'PENDING' },
        data: { status: 'READY', selectedIncomingEdgeKey: branch.edgeKey, branchTokenId: token.id, joinGroupKey: input.splitNodeKey, stateVersion: { increment: 1 } },
      });
      if (targetUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Branch target "${branch.toNodeKey}" is not PENDING.`, { targetNodeKey: branch.toNodeKey });
      }
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        traceType: 'NODE_READY',
        actorType: 'SYSTEM',
        corePayload: { nodeKey: branch.toNodeKey, edgeKey: branch.edgeKey, branchTokenId: String(token.id) },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// F-1 (p-60) — wait/work-item creation race hardening.
// ---------------------------------------------------------------------------

/**
 * SQL Server, unlike Postgres, does not auto-abort a transaction on a mid-transaction runtime error
 * unless `XACT_ABORT` is ON for the session — unaudited directly against `@prisma/adapter-mssql`
 * (no XACT_ABORT anywhere in its transaction path), this is the leading explanation for how the
 * 2026-07-17 20-scenario challenge's F-1 repro ("unique constraint on `owningNodeInstanceId` with
 * zero prior wait rows") could observe a phantom row from an earlier attempt whose transaction was
 * never cleanly rolled back. Cheap and a guaranteed no-op on every other provider (Postgres/MySQL/
 * SQLite reject this syntax, so it is provider-gated, never issued there).
 */
export async function ensureStrictTransactionAbortOnMssql(tx: Tx): Promise<void> {
  if (readControlPlaneProvider() === 'sqlserver') {
    await tx.$executeRawUnsafe('SET XACT_ABORT ON');
  }
}

/**
 * Defense-in-depth compensating path (p-60 F-1 "Engineering actions" §2): if a wait/work-item
 * creation transaction fails for any reason OTHER than losing a legitimate CAS race (that case is
 * `WF_EXEC_STALE_STATE_VERSION` and needs no compensation — somebody else already resolved this
 * node), the claimed node must not be left permanently `RUNNING`. Reverts it to `READY` so the next
 * engine tick simply retries dispatch from scratch. Best-effort: if the revert itself can't apply
 * (the node already moved on by the time we get here), that is itself proof no compensation was
 * needed. The original error is always rethrown — the caller's current dispatch attempt still
 * failed, only the node's durable state is fixed.
 */
export async function compensateFailedWaitCreation(nodeInstanceId: number, expectedNodeStateVersion: number, error: unknown): Promise<never> {
  if (!(isWorkflowDomainError(error) && error.code === 'WF_EXEC_STALE_STATE_VERSION')) {
    await revertRunningNodeToReadyAfterCreationFailure(nodeInstanceId, expectedNodeStateVersion);
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Wait creation and satisfaction (doc 06 sections 4, 9, 10; doc 05 section 28) — Slice 6.
// ---------------------------------------------------------------------------

export type ApplyCreateWaitInput = {
  nodeInstanceId: number;
  nodeKey: string;
  expectedNodeStateVersion: number;
  workflowInstanceId: number;
  waitType: 'TIMER' | 'EVENT' | 'HUMAN' | 'SUBFLOW';
  dueAt?: Date;
  timeoutAt?: Date;
  eventName?: string;
  correlationKey?: string;
  correlationValueHash?: string;
  correlationEncoderVersion?: string;
  correlationHashAlgorithm?: string;
  childInstanceId?: number;
  workItemId?: number;
};

/**
 * Doc 05 section 28 wait-producing node creation phase: `RUNNING → WAITING` (or `→ WAITING_HUMAN`
 * for HUMAN waits) plus the exactly-one `WorkflowWait` row, in one transaction. Declared for all
 * four wait types now (the frozen `ResolvedWaitCreation` wire shape doc 06 section 15 already
 * covers them and `continuationDecision.ts` names this the shared transaction for Slices 6/8/9) but
 * only Slice 6's DELAY (`TIMER`) and WAIT_EVENT (`EVENT`) node kinds call it today. Does not gate
 * on owning-instance status: a node already claimed (`RUNNING`) before a race with SUSPEND may
 * still commit its creation phase, matching `applyAttemptSuccessContinuation`'s precedent (doc 06
 * section 19: "An Action claim that committed before suspension retains ownership and may settle").
 */
export async function applyCreateWaitContinuation(input: ApplyCreateWaitInput): Promise<void> {
  try {
    await prisma().$transaction(async (tx) => {
      await ensureStrictTransactionAbortOnMssql(tx);

      // F-1 reconcile-first: a prior attempt for this exact node occurrence may have already
      // durably created its WorkflowWait row (the node just doesn't know it yet — e.g. a redrive
      // after an ambiguous lease/version race). Adopt it instead of re-inserting and hitting the
      // unique-constraint violation that used to strand the node in RUNNING forever (p-60 F-1).
      const existingWait = await tx.workflowWait.findUnique({ where: { owningNodeInstanceId: toId(input.nodeInstanceId) } });
      if (existingWait) {
        await tx.workflowNodeInstance.updateMany({
          where: { id: toId(input.nodeInstanceId), status: 'RUNNING' },
          data: { status: input.waitType === 'HUMAN' ? 'WAITING_HUMAN' : 'WAITING', stateVersion: { increment: 1 } },
        });
        return;
      }

      const nodeUpdate = await tx.workflowNodeInstance.updateMany({
        where: { id: toId(input.nodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'RUNNING' },
        data: { status: input.waitType === 'HUMAN' ? 'WAITING_HUMAN' : 'WAITING', stateVersion: { increment: 1 } },
      });
      if (nodeUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Wait-creating WorkflowNodeInstance is not RUNNING at the expected version.', { id: input.nodeInstanceId });
      }

      if (input.waitType === 'EVENT' && (!input.correlationEncoderVersion || !input.correlationHashAlgorithm || !input.correlationValueHash)) {
        throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'EVENT waits require correlationEncoderVersion, correlationHashAlgorithm and correlationValueHash.', { nodeInstanceId: input.nodeInstanceId });
      }

      const wait = await tx.workflowWait.create({
        data: {
          workflowInstanceId: toId(input.workflowInstanceId),
          owningNodeInstanceId: toId(input.nodeInstanceId),
          waitType: input.waitType,
          status: 'ACTIVE',
          dueAt: input.dueAt ?? null,
          timeoutAt: input.timeoutAt ?? null,
          eventName: input.eventName ?? null,
          correlationKey: input.correlationKey ?? null,
          correlationValueHash: input.correlationValueHash ?? null,
          correlationEncoderVersion: input.waitType === 'EVENT' ? input.correlationEncoderVersion : null,
          correlationHashAlgorithm: input.waitType === 'EVENT' ? input.correlationHashAlgorithm : null,
          childInstanceId: input.childInstanceId != null ? toId(input.childInstanceId) : null,
          workItemId: input.workItemId != null ? toId(input.workItemId) : null,
        },
      });

      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: 'WAIT_CREATED',
        actorType: 'SYSTEM',
        corePayload: {
          nodeKey: input.nodeKey,
          waitId: String(wait.id),
          waitType: input.waitType,
          owningNodeKey: input.nodeKey,
          ...(input.dueAt ? { dueAt: input.dueAt.toISOString() } : {}),
          ...(input.timeoutAt ? { timeoutAt: input.timeoutAt.toISOString() } : {}),
          ...(input.eventName ? { eventName: input.eventName } : {}),
          ...(input.waitType === 'EVENT' ? { correlationEncoderVersion: input.correlationEncoderVersion, correlationHashAlgorithm: input.correlationHashAlgorithm } : {}),
        },
      });
    });
  } catch (error) {
    await compensateFailedWaitCreation(input.nodeInstanceId, input.expectedNodeStateVersion, error);
  }
}

export type ApplyCreateWorkItemInput = {
  nodeInstanceId: number;
  nodeKey: string;
  expectedNodeStateVersion: number;
  workflowInstanceId: number;
  workItemType: string;
  assignmentStrategy: string;
  assignmentEvidenceJson: string;
  priority: number;
  allowedOutcomesJson: string;
  inputJson: string;
  outputSchemaJson: string;
  titleText: string;
  summaryText: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  approvalGroupKey: string | null;
};

/**
 * Doc 05 section 28 WORK_ITEM creation phase — "WORK_ITEM one Work Item plus HUMAN wait", `RUNNING
 * → WAITING_HUMAN`, in one transaction (doc 07 section 1: "Work Item is first-class durable human
 * work that may pause/resume Workflow"). Distinct from `applyCreateWaitContinuation` because the
 * WorkItem row itself must be created inside the same atomic unit — `workItemRepository.ts`'s
 * `createWorkItem` opens its own implicit client call and cannot participate in this transaction.
 */
export async function applyCreateWorkItemContinuation(input: ApplyCreateWorkItemInput): Promise<{ workItemId: number }> {
  try {
    return await prisma().$transaction(async (tx) => {
      await ensureStrictTransactionAbortOnMssql(tx);

      // F-1 reconcile-first (same rationale as applyCreateWaitContinuation): a prior attempt may
      // have already durably created this node's WorkItem+Wait pair.
      const existingWorkItem = await tx.workItem.findUnique({ where: { nodeInstanceId: toId(input.nodeInstanceId) } });
      if (existingWorkItem) {
        await tx.workflowNodeInstance.updateMany({
          where: { id: toId(input.nodeInstanceId), status: 'RUNNING' },
          data: { status: 'WAITING_HUMAN', stateVersion: { increment: 1 } },
        });
        return { workItemId: Number(existingWorkItem.id) };
      }

      const nodeUpdate = await tx.workflowNodeInstance.updateMany({
        where: { id: toId(input.nodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'RUNNING' },
        data: { status: 'WAITING_HUMAN', stateVersion: { increment: 1 } },
      });
      if (nodeUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WORK_ITEM-creating WorkflowNodeInstance is not RUNNING at the expected version.', { id: input.nodeInstanceId });
      }

      const workItem = await tx.workItem.create({
        data: {
          workflowInstanceId: toId(input.workflowInstanceId),
          nodeInstanceId: toId(input.nodeInstanceId),
          workItemType: input.workItemType,
          status: 'OPEN',
          assignmentStrategy: input.assignmentStrategy,
          assignmentEvidenceJson: input.assignmentEvidenceJson,
          priority: input.priority,
          allowedOutcomesJson: input.allowedOutcomesJson,
          inputJson: input.inputJson,
          outputSchemaJson: input.outputSchemaJson,
          titleText: input.titleText,
          summaryText: input.summaryText,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
          approvalGroupKey: input.approvalGroupKey,
        },
      });

      const wait = await tx.workflowWait.create({
        data: {
          workflowInstanceId: toId(input.workflowInstanceId),
          owningNodeInstanceId: toId(input.nodeInstanceId),
          waitType: 'HUMAN',
          status: 'ACTIVE',
          workItemId: workItem.id,
        },
      });

      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: 'WAIT_CREATED',
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.nodeKey, waitId: String(wait.id), workItemId: String(workItem.id), waitType: 'HUMAN', owningNodeKey: input.nodeKey },
      });
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: 'WORK_ITEM_CREATED',
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.nodeKey, workItemId: String(workItem.id), workItemType: input.workItemType, transitionType: 'CREATE', actorType: 'SYSTEM', resultingWorkItemStateVersion: workItem.stateVersion },
      });

      return { workItemId: Number(workItem.id) };
    });
  } catch (error) {
    return compensateFailedWaitCreation(input.nodeInstanceId, input.expectedNodeStateVersion, error);
  }
}

export type ApplyWaitTerminalSelectEdgeInput = {
  workflowInstanceId: number;
  waitId: number;
  waitType: string;
  sourceNodeKey: string;
  expectedWaitStateVersion: number;
  /** `SATISFY` for DELAY due-timer/WAIT_EVENT event-win completion; `EXPIRE` for WAIT_EVENT timeout completion (doc 05 section 23). */
  waitTerminalCommand: 'SATISFY' | 'EXPIRE';
  resultPayloadJson?: string;
  completingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  nodeOutput: JsonValue;
  edgeKey: string;
  targetNodeKey: string;
  updatedVariables?: { variables: Record<string, JsonValue>; expectedInstanceStateVersion: number };
  /** Present only for a WAIT_EVENT event-win — atomically also transitions the winning EventInbox row to CORRELATED (doc 06 section 9). */
  inboxCorrelation?: {
    inboxId: number;
    expectedInboxStateVersion: number;
    eventName: string;
    correlationEncoderVersion: string;
    correlationHashAlgorithm: string;
    candidateOrderPosition: number;
  };
  targetIsJoin?: boolean;
  join?: EdgeTargetJoin;
  sourceBranchTokenId?: number | null;
};

/**
 * Doc 05 section 28 wait satisfaction transaction, shared by all three Slice 6 completion paths
 * (DELAY due timer, WAIT_EVENT event win, WAIT_EVENT timeout) — they differ only in wait terminal
 * command, node output, selected edge and (event-win only) the inbox leg. "Wait satisfaction does
 * not put the node back on the Node Executor queue... transitions the owning node directly from
 * WAITING → SUCCEEDED... applies the typed continuation." The resolved target may also be a
 * PARALLEL_JOIN (doc 05 section 32) — a wait-producing node can legally be the last node in a
 * parallel branch.
 *
 * Unlike `applyCreateWaitContinuation`, this DOES gate on owning-instance `RUNNING`: satisfaction is
 * triggered externally at any time by a scanner/correlator, not by settling an already-in-flight
 * claim, so doc 06 section 19 requires the check "in the same transaction" — "all wait-satisfaction
 * transactions require owning instance RUNNING and therefore fail eligibility" once SUSPENDED.
 */
export async function applyWaitTerminalSelectEdgeContinuation(input: ApplyWaitTerminalSelectEdgeInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const runningInstance = await tx.workflowInstance.findFirst({ where: { id: toId(input.workflowInstanceId), status: 'RUNNING' }, select: { id: true } });
    if (!runningInstance) {
      throw new WorkflowDomainError('WF_EXEC_INSTANCE_NOT_EXECUTABLE', 'Owning WorkflowInstance is not RUNNING — wait satisfaction requires a RUNNING owner.', { workflowInstanceId: input.workflowInstanceId });
    }

    const waitUpdate = await tx.workflowWait.updateMany({
      where: { id: toId(input.waitId), stateVersion: input.expectedWaitStateVersion, status: 'ACTIVE' },
      data: {
        status: input.waitTerminalCommand === 'SATISFY' ? 'SATISFIED' : 'EXPIRED',
        satisfiedAt: input.waitTerminalCommand === 'SATISFY' ? new Date() : undefined,
        stateVersion: { increment: 1 },
        ...(input.resultPayloadJson !== undefined ? { resultPayloadJson: input.resultPayloadJson } : {}),
      },
    });
    if (waitUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'WorkflowWait stateVersion is stale or wait is not ACTIVE.', { waitId: input.waitId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.completingNodeInstanceId,
      traceType: input.waitTerminalCommand === 'SATISFY' ? 'WAIT_SATISFIED' : 'WAIT_EXPIRED',
      actorType: 'SYSTEM',
      corePayload: {
        nodeKey: input.sourceNodeKey,
        waitId: String(input.waitId),
        waitType: input.waitType,
        priorWaitVersion: input.expectedWaitStateVersion,
        winnerReason: input.waitTerminalCommand === 'SATISFY' ? (input.inboxCorrelation ? 'event correlated' : 'due timer fired') : 'timeout expired',
        owningNodeKey: input.sourceNodeKey,
      },
    });

    if (input.inboxCorrelation) {
      const inboxUpdate = await tx.workflowEventInbox.updateMany({
        where: { id: toId(input.inboxCorrelation.inboxId), stateVersion: input.inboxCorrelation.expectedInboxStateVersion, status: { in: ['RECEIVED', 'UNMATCHED'] } },
        data: { status: 'CORRELATED', processedAt: new Date(), stateVersion: { increment: 1 }, leaseOwnerId: null, leaseExpiresAt: null },
      });
      if (inboxUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox stateVersion is stale or not correlation-eligible.', { inboxId: input.inboxCorrelation.inboxId });
      }
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.completingNodeInstanceId,
        traceType: 'EVENT_CORRELATED',
        actorType: 'SYSTEM',
        corePayload: {
          nodeKey: input.sourceNodeKey,
          waitId: String(input.waitId),
          inboxId: String(input.inboxCorrelation.inboxId),
          eventName: input.inboxCorrelation.eventName,
          correlationEncoderVersion: input.inboxCorrelation.correlationEncoderVersion,
          correlationHashAlgorithm: input.inboxCorrelation.correlationHashAlgorithm,
          candidateOrderPosition: input.inboxCorrelation.candidateOrderPosition,
        },
      });
    }

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.completingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: { in: ['WAITING', 'WAITING_HUMAN'] } },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(input.nodeOutput), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Completing WAITING WorkflowNodeInstance is not at the expected version.', { id: input.completingNodeInstanceId });
    }

    if (input.updatedVariables) {
      const contextUpdate = await tx.workflowInstance.updateMany({
        where: { id: toId(input.workflowInstanceId), stateVersion: input.updatedVariables.expectedInstanceStateVersion },
        data: { contextJson: JSON.stringify(input.updatedVariables.variables), stateVersion: { increment: 1 } },
      });
      if (contextUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance stateVersion is stale for context-assignment commit.', { workflowInstanceId: input.workflowInstanceId });
      }
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.completingNodeInstanceId,
        traceType: 'EXPRESSION_EVALUATED',
        actorType: 'SYSTEM',
        corePayload: {
          nodeKey: input.sourceNodeKey,
          expressionFingerprint: canonicalJsonFingerprint(input.updatedVariables.variables),
          evaluationContextFingerprints: [],
          result: { kind: 'VALUE', typedResult: input.updatedVariables.variables },
        },
      });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.completingNodeInstanceId,
      traceType: 'EDGE_SELECTED',
      actorType: 'SYSTEM',
      corePayload: {
        nodeKey: input.sourceNodeKey,
        edgeKey: input.edgeKey,
        sourceNodeKey: input.sourceNodeKey,
        selectionMode: input.waitTerminalCommand === 'SATISFY' ? (input.inboxCorrelation ? 'WAIT_EVENT_CORRELATED' : 'TIMER_DUE') : 'WAIT_EVENT_TIMEOUT',
        selectionReason: input.waitTerminalCommand === 'SATISFY' ? (input.inboxCorrelation ? 'WAIT_EVENT matched an incoming event' : 'DELAY due timer fired') : 'WAIT_EVENT timeout expired',
        selectedEdgeKey: input.edgeKey,
      },
    });

    await resolveEdgeTarget(tx, {
      workflowInstanceId: input.workflowInstanceId,
      edgeKey: input.edgeKey,
      targetNodeKey: input.targetNodeKey,
      targetIsJoin: input.targetIsJoin ?? false,
      join: input.join,
      sourceBranchTokenId: input.sourceBranchTokenId,
    });
  });
}

export type CancelInstanceApplyInput = { workflowInstanceId: number; expectedInstanceStateVersion: number; actorType?: string; actorId?: number };

/**
 * Doc 05 section 9 / doc 06 section 18 — authorized instance cancellation. Cancels every
 * non-terminal node occurrence, cancels every in-flight `STARTED` Action attempt (doc 06 section
 * 18: "conditionally transitions the attempt to CANCELLED... CANCELLED does not claim the provider
 * produced no side effect"), cancels every ACTIVE wait (doc 05 section 9: "cancels ACTIVE waits"),
 * every ACTIVE branch token and every active Work Item (doc 07 section 6), and clears lease
 * ownership — one transaction. Child-subflow cancellation propagation remains Slice 9.
 */
export async function applyCancelInstanceContinuation(input: CancelInstanceApplyInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const instanceUpdate = await tx.workflowInstance.updateMany({
      where: { id: toId(input.workflowInstanceId), stateVersion: input.expectedInstanceStateVersion, status: { in: ['CREATED', 'RUNNING', 'SUSPENDED'] } },
      data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
    });
    if (instanceUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance is not in a cancellable status at the expected version.', { workflowInstanceId: input.workflowInstanceId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      traceType: 'INSTANCE_CANCELLED',
      actorType: (input.actorType as 'USER' | 'SYSTEM' | 'WORKFLOW' | 'EXTERNAL_CONSUMER' | undefined) ?? 'SYSTEM',
      actorId: input.actorId,
      corePayload: {},
    });

    await tx.workflowExecutionAttempt.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), status: 'STARTED' },
      data: { status: 'CANCELLED', completedAt: new Date(), stateVersion: { increment: 1 } },
    });

    await tx.workflowNodeInstance.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), status: { in: [...NON_TERMINAL_NODE_STATUSES] } },
      data: { status: 'CANCELLED', leaseOwnerId: null, leaseExpiresAt: null, nextEligibleAt: null, stateVersion: { increment: 1 } },
    });

    await cancelAllActiveWaitsForInstanceWithTrace(tx, input.workflowInstanceId, 'owning instance cancelled');

    await tx.workflowBranchToken.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), status: 'ACTIVE' },
      data: { status: 'CANCELLED', terminalAt: new Date(), stateVersion: { increment: 1 } },
    });

    await closeActiveWorkItemsInTx(tx, input.workflowInstanceId, 'INSTANCE_CANCELLED');
    await cascadeCancelChildInstances(tx, input.workflowInstanceId);
  });
}

// ---------------------------------------------------------------------------
// ACTION attempt terminal transactions (doc 06 sections 4, 5, 16) — attempt
// terminalization and its node/instance consequence are always one
// transaction so a crash between them is never observable as a partial
// commit.
// ---------------------------------------------------------------------------

export type AttemptTerminalPatch = { command: 'COMMIT_SUCCESS' | 'COMMIT_FAILURE' | 'DEADLINE_TRANSITION_WINS' | 'UNSAFE_UNCERTAINTY' | 'OWNING_CANCELLATION_WINS'; errorClass?: string; errorCode?: string; errorMessage?: string; resultMetadataJson?: string };

const ATTEMPT_TERMINAL_STATUS: Record<AttemptTerminalPatch['command'], string> = {
  COMMIT_SUCCESS: 'SUCCEEDED',
  COMMIT_FAILURE: 'FAILED',
  DEADLINE_TRANSITION_WINS: 'TIMED_OUT',
  UNSAFE_UNCERTAINTY: 'UNKNOWN',
  OWNING_CANCELLATION_WINS: 'CANCELLED',
};

/** doc 03 section 29's `ACTION_ATTEMPT_*` trace types, keyed by the same `AttemptTerminalPatch.command` union `ATTEMPT_TERMINAL_STATUS` already maps to a persisted status. `COMMIT_SUCCESS` has its own dedicated `ACTION_ATTEMPT_SUCCEEDED` emission in `applyAttemptSuccessContinuation` — never routed through this map. */
const ACTION_ATTEMPT_TERMINAL_TRACE_TYPE: Partial<Record<AttemptTerminalPatch['command'], WorkflowTraceType>> = {
  COMMIT_FAILURE: 'ACTION_ATTEMPT_FAILED',
  DEADLINE_TRANSITION_WINS: 'ACTION_ATTEMPT_TIMED_OUT',
  UNSAFE_UNCERTAINTY: 'ACTION_ATTEMPT_UNKNOWN',
  OWNING_CANCELLATION_WINS: 'ACTION_ATTEMPT_CANCELLED',
};

/**
 * Re-reads the just-committed attempt row inside the same transaction to source
 * `logicalInvocationId`/`attemptNumber`/idempotency-key-fingerprint/provider-identity for trace
 * evidence — deliberately NOT threaded as extra input fields through every one of these functions'
 * callers (`dispatchService.ts`, `recoveryService.ts`), matching the same "extra read over invasive
 * signature plumbing" trade-off `emitTraceAutoRevision`'s `workflowRevisionId` lookup already makes.
 */
async function readAttemptTraceFields(tx: Tx, attemptId: number): Promise<{ logicalInvocationId: string; attemptNumber: number; idempotencyKeyFingerprint: string; providerIdentity: string }> {
  const attempt = await tx.workflowExecutionAttempt.findUniqueOrThrow({ where: { id: toId(attemptId) } });
  return {
    logicalInvocationId: attempt.logicalInvocationId,
    attemptNumber: attempt.attemptNumber,
    idempotencyKeyFingerprint: canonicalJsonFingerprint({ idempotencyKey: attempt.idempotencyKey }),
    providerIdentity: attempt.selectedProviderId && attempt.selectedProviderVersion ? `${attempt.selectedProviderId}@${attempt.selectedProviderVersion}` : 'UNKNOWN_PROVIDER',
  };
}

export type ApplyAttemptSuccessInput = {
  workflowInstanceId: number;
  nodeInstanceId: number;
  sourceNodeKey: string;
  attemptId: number;
  expectedAttemptStateVersion: number;
  expectedNodeStateVersion: number;
  resultMetadataJson?: string;
  nodeOutput: JsonValue;
  edgeKey: string;
  targetNodeKey: string;
  updatedVariables?: { variables: Record<string, JsonValue>; expectedInstanceStateVersion: number };
  targetIsJoin?: boolean;
  join?: EdgeTargetJoin;
  sourceBranchTokenId?: number | null;
};

/** Doc 06 section 4/16 success path: attempt `STARTED -> SUCCEEDED` and the `SELECT_EDGE`/join-arrival continuation commit in one transaction. */
export async function applyAttemptSuccessContinuation(input: ApplyAttemptSuccessInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const attemptUpdate = await tx.workflowExecutionAttempt.updateMany({
      where: { id: toId(input.attemptId), stateVersion: input.expectedAttemptStateVersion, status: 'STARTED' },
      data: { status: 'SUCCEEDED', completedAt: new Date(), stateVersion: { increment: 1 }, ...(input.resultMetadataJson !== undefined ? { resultMetadataJson: input.resultMetadataJson } : {}) },
    });
    if (attemptUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowExecutionAttempt is not STARTED at the expected version.', { attemptId: input.attemptId });
    }

    const attemptTraceFields = await readAttemptTraceFields(tx, input.attemptId);
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'ACTION_ATTEMPT_SUCCEEDED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, attemptId: String(input.attemptId), ...attemptTraceFields },
    });

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.nodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'RUNNING' },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(input.nodeOutput), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'ACTION WorkflowNodeInstance is not RUNNING at the expected version.', { nodeInstanceId: input.nodeInstanceId });
    }

    if (input.updatedVariables) {
      const contextUpdate = await tx.workflowInstance.updateMany({
        where: { id: toId(input.workflowInstanceId), stateVersion: input.updatedVariables.expectedInstanceStateVersion },
        data: { contextJson: JSON.stringify(input.updatedVariables.variables), stateVersion: { increment: 1 } },
      });
      if (contextUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance stateVersion is stale for context-assignment commit.', { workflowInstanceId: input.workflowInstanceId });
      }
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: 'EXPRESSION_EVALUATED',
        actorType: 'SYSTEM',
        corePayload: {
          nodeKey: input.sourceNodeKey,
          expressionFingerprint: canonicalJsonFingerprint(input.updatedVariables.variables),
          evaluationContextFingerprints: [],
          result: { kind: 'VALUE', typedResult: input.updatedVariables.variables },
        },
      });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'EDGE_SELECTED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, edgeKey: input.edgeKey, sourceNodeKey: input.sourceNodeKey, selectionMode: 'UNCONDITIONAL', selectionReason: 'ACTION attempt succeeded', selectedEdgeKey: input.edgeKey },
    });

    await resolveEdgeTarget(tx, {
      workflowInstanceId: input.workflowInstanceId,
      edgeKey: input.edgeKey,
      targetNodeKey: input.targetNodeKey,
      targetIsJoin: input.targetIsJoin ?? false,
      join: input.join,
      sourceBranchTokenId: input.sourceBranchTokenId,
    });
  });
}

export type ApplyAttemptRetryInput = {
  workflowInstanceId: number;
  nodeInstanceId: number;
  sourceNodeKey: string;
  attemptId: number;
  expectedAttemptStateVersion: number;
  expectedNodeStateVersion: number;
  terminalPatch: AttemptTerminalPatch;
  nextEligibleAt: Date;
  matchedRetrySelectorIdentity: string;
};

/** Doc 06 section 16 matched-retry path: terminalizes the attempt, `RUNNING -> RETRYING`, persists `nextEligibleAt` and clears lease ownership — one transaction. */
export async function applyAttemptRetryContinuation(input: ApplyAttemptRetryInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const attemptUpdate = await tx.workflowExecutionAttempt.updateMany({
      where: { id: toId(input.attemptId), stateVersion: input.expectedAttemptStateVersion, status: 'STARTED' },
      data: {
        status: ATTEMPT_TERMINAL_STATUS[input.terminalPatch.command],
        completedAt: new Date(),
        stateVersion: { increment: 1 },
        ...(input.terminalPatch.errorClass !== undefined ? { errorClass: input.terminalPatch.errorClass } : {}),
        ...(input.terminalPatch.errorCode !== undefined ? { errorCode: input.terminalPatch.errorCode } : {}),
        ...(input.terminalPatch.errorMessage !== undefined ? { errorMessage: input.terminalPatch.errorMessage } : {}),
      },
    });
    if (attemptUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowExecutionAttempt is not STARTED at the expected version.', { attemptId: input.attemptId });
    }

    const attemptTraceFields = await readAttemptTraceFields(tx, input.attemptId);
    const terminalTraceType = ACTION_ATTEMPT_TERMINAL_TRACE_TYPE[input.terminalPatch.command];
    if (terminalTraceType === 'ACTION_ATTEMPT_FAILED' || terminalTraceType === 'ACTION_ATTEMPT_UNKNOWN') {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: terminalTraceType,
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.sourceNodeKey, attemptId: String(input.attemptId), ...attemptTraceFields, machineErrorCode: input.terminalPatch.errorCode ?? 'WF_ACTION_OUTCOME_UNKNOWN' },
      });
    } else if (terminalTraceType === 'ACTION_ATTEMPT_TIMED_OUT' || terminalTraceType === 'ACTION_ATTEMPT_CANCELLED') {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: terminalTraceType,
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.sourceNodeKey, attemptId: String(input.attemptId), ...attemptTraceFields },
      });
    }
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'ACTION_RETRY_SCHEDULED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, attemptNumber: attemptTraceFields.attemptNumber, matchedRetrySelectorIdentity: input.matchedRetrySelectorIdentity, nextEligibleAt: input.nextEligibleAt.toISOString() },
    });

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.nodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'RUNNING' },
      data: { status: 'RETRYING', nextEligibleAt: input.nextEligibleAt, leaseOwnerId: null, leaseExpiresAt: null, stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'ACTION WorkflowNodeInstance is not RUNNING at the expected version.', { nodeInstanceId: input.nodeInstanceId });
    }
  });
}

export type ApplyAttemptUnhandledFailureInput = {
  workflowInstanceId: number;
  nodeInstanceId: number;
  sourceNodeKey: string;
  attemptId: number;
  expectedAttemptStateVersion: number;
  expectedNodeStateVersion: number;
  expectedInstanceStateVersion: number;
  terminalPatch: AttemptTerminalPatch;
};

/** Doc 05 section 29 / doc 06 section 16 unhandled-failure path: terminalizes the attempt and applies V1 unhandled failure propagation (node FAILED, instance FAILED, siblings cancelled) — one transaction. */
export async function applyAttemptUnhandledFailureContinuation(input: ApplyAttemptUnhandledFailureInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const attemptUpdate = await tx.workflowExecutionAttempt.updateMany({
      where: { id: toId(input.attemptId), stateVersion: input.expectedAttemptStateVersion, status: 'STARTED' },
      data: {
        status: ATTEMPT_TERMINAL_STATUS[input.terminalPatch.command],
        completedAt: new Date(),
        stateVersion: { increment: 1 },
        ...(input.terminalPatch.errorClass !== undefined ? { errorClass: input.terminalPatch.errorClass } : {}),
        ...(input.terminalPatch.errorCode !== undefined ? { errorCode: input.terminalPatch.errorCode } : {}),
        ...(input.terminalPatch.errorMessage !== undefined ? { errorMessage: input.terminalPatch.errorMessage } : {}),
      },
    });
    if (attemptUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowExecutionAttempt is not STARTED at the expected version.', { attemptId: input.attemptId });
    }

    const attemptTraceFields = await readAttemptTraceFields(tx, input.attemptId);
    const terminalTraceType = ACTION_ATTEMPT_TERMINAL_TRACE_TYPE[input.terminalPatch.command];
    const machineErrorCode = input.terminalPatch.errorCode ?? 'WF_EXEC_UNHANDLED_NODE_FAILURE';
    if (terminalTraceType === 'ACTION_ATTEMPT_FAILED' || terminalTraceType === 'ACTION_ATTEMPT_UNKNOWN') {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: terminalTraceType,
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.sourceNodeKey, attemptId: String(input.attemptId), ...attemptTraceFields, machineErrorCode },
      });
    } else if (terminalTraceType === 'ACTION_ATTEMPT_TIMED_OUT' || terminalTraceType === 'ACTION_ATTEMPT_CANCELLED') {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: terminalTraceType,
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.sourceNodeKey, attemptId: String(input.attemptId), ...attemptTraceFields },
      });
    }

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.nodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: { in: ['RUNNING', 'RETRYING'] } },
      data: { status: 'FAILED', stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'ACTION WorkflowNodeInstance is not in a failable status at the expected version.', { nodeInstanceId: input.nodeInstanceId });
    }

    const instanceUpdate = await tx.workflowInstance.updateMany({
      where: { id: toId(input.workflowInstanceId), stateVersion: input.expectedInstanceStateVersion, status: 'RUNNING' },
      data: { status: 'FAILED', stateVersion: { increment: 1 } },
    });
    if (instanceUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance is not RUNNING at the expected version — a race already won instance completion.', { workflowInstanceId: input.workflowInstanceId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'INSTANCE_FAILED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, machineErrorCode, causalIdentity: input.sourceNodeKey },
    });

    await tx.workflowNodeInstance.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), id: { not: toId(input.nodeInstanceId) }, status: { in: [...NON_TERMINAL_NODE_STATUSES] } },
      data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
    });

    await cancelAllActiveWaitsForInstanceWithTrace(tx, input.workflowInstanceId, 'owning instance failed');

    await tx.workflowBranchToken.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), status: 'ACTIVE' },
      data: { status: 'CANCELLED', terminalAt: new Date(), stateVersion: { increment: 1 } },
    });

    await closeActiveWorkItemsInTx(tx, input.workflowInstanceId, 'INSTANCE_FAILED');
    await parkDeadLetterInTx(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      attemptId: input.attemptId,
      nodeKey: input.sourceNodeKey,
      errorCode: input.terminalPatch.errorCode ?? machineErrorCode,
      errorClass: input.terminalPatch.errorClass ?? null,
      errorMessage: input.terminalPatch.errorMessage ?? null,
      evidenceJson: JSON.stringify({ source: 'UNHANDLED_ACTION_FAILURE', attemptId: input.attemptId }),
    });
    await cascadeCancelChildInstances(tx, input.workflowInstanceId);
  });
  void import('./eventFailureNotify').then(({ emitWorkflowInstanceFailedEvent }) =>
    emitWorkflowInstanceFailedEvent({
      workflowInstanceId: input.workflowInstanceId,
      errorCode: input.terminalPatch.errorCode ?? 'WF_EXEC_UNHANDLED_NODE_FAILURE',
    }),
  );
}

export type ApplyAttemptCaughtFailureInput = {
  workflowInstanceId: number;
  nodeInstanceId: number;
  sourceNodeKey: string;
  attemptId: number;
  expectedAttemptStateVersion: number;
  expectedNodeStateVersion: number;
  terminalPatch: AttemptTerminalPatch;
  nodeOutput: JsonValue;
  edgeKey: string;
  targetNodeKey: string;
  updatedVariables?: { variables: Record<string, JsonValue>; expectedInstanceStateVersion: number };
  targetIsJoin?: boolean;
  join?: EdgeTargetJoin;
  sourceBranchTokenId?: number | null;
};

/**
 * WFV2-1 (p-60) — the ON_ERROR/CATCH path: an ACTION attempt's retries are exhausted (or the
 * classification is non-retryable), but the node declares an ON_ERROR edge, so this failure is
 * *handled* rather than propagated to the whole instance. Same attempt-terminalization/evidence
 * shape as `applyAttemptUnhandledFailureContinuation` (the attempt genuinely failed — that evidence
 * is unchanged) but the NODE completes via `SELECT_EDGE` to the ON_ERROR target instead of failing,
 * mirroring `applyAttemptSuccessContinuation`'s edge-select/outputAssignments/join-resolution shape
 * with the error classification as a synthetic `nodeOutput` (`{errorCode, errorClass, safeMessage}`,
 * built by the caller) — so ON_ERROR composes for free with everything Slice 7-9 already proved for
 * ACTION's real success path (PARALLEL_JOIN targets, outputAssignments capturing the error).
 */
export async function applyAttemptCaughtFailureContinuation(input: ApplyAttemptCaughtFailureInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const attemptUpdate = await tx.workflowExecutionAttempt.updateMany({
      where: { id: toId(input.attemptId), stateVersion: input.expectedAttemptStateVersion, status: 'STARTED' },
      data: {
        status: ATTEMPT_TERMINAL_STATUS[input.terminalPatch.command],
        completedAt: new Date(),
        stateVersion: { increment: 1 },
        ...(input.terminalPatch.errorClass !== undefined ? { errorClass: input.terminalPatch.errorClass } : {}),
        ...(input.terminalPatch.errorCode !== undefined ? { errorCode: input.terminalPatch.errorCode } : {}),
        ...(input.terminalPatch.errorMessage !== undefined ? { errorMessage: input.terminalPatch.errorMessage } : {}),
      },
    });
    if (attemptUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowExecutionAttempt is not STARTED at the expected version.', { attemptId: input.attemptId });
    }

    const attemptTraceFields = await readAttemptTraceFields(tx, input.attemptId);
    const terminalTraceType = ACTION_ATTEMPT_TERMINAL_TRACE_TYPE[input.terminalPatch.command];
    const machineErrorCode = input.terminalPatch.errorCode ?? 'WF_EXEC_UNHANDLED_NODE_FAILURE';
    if (terminalTraceType === 'ACTION_ATTEMPT_FAILED' || terminalTraceType === 'ACTION_ATTEMPT_UNKNOWN') {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: terminalTraceType,
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.sourceNodeKey, attemptId: String(input.attemptId), ...attemptTraceFields, machineErrorCode },
      });
    } else if (terminalTraceType === 'ACTION_ATTEMPT_TIMED_OUT' || terminalTraceType === 'ACTION_ATTEMPT_CANCELLED') {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: terminalTraceType,
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.sourceNodeKey, attemptId: String(input.attemptId), ...attemptTraceFields },
      });
    }

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.nodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: { in: ['RUNNING', 'RETRYING'] } },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(input.nodeOutput), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'ACTION WorkflowNodeInstance is not in a catchable status at the expected version.', { nodeInstanceId: input.nodeInstanceId });
    }

    if (input.updatedVariables) {
      const contextUpdate = await tx.workflowInstance.updateMany({
        where: { id: toId(input.workflowInstanceId), stateVersion: input.updatedVariables.expectedInstanceStateVersion },
        data: { contextJson: JSON.stringify(input.updatedVariables.variables), stateVersion: { increment: 1 } },
      });
      if (contextUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance stateVersion is stale for context-assignment commit.', { workflowInstanceId: input.workflowInstanceId });
      }
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        traceType: 'EXPRESSION_EVALUATED',
        actorType: 'SYSTEM',
        corePayload: {
          nodeKey: input.sourceNodeKey,
          expressionFingerprint: canonicalJsonFingerprint(input.updatedVariables.variables),
          evaluationContextFingerprints: [],
          result: { kind: 'VALUE', typedResult: input.updatedVariables.variables },
        },
      });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'EDGE_SELECTED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, edgeKey: input.edgeKey, sourceNodeKey: input.sourceNodeKey, selectionMode: 'ON_ERROR', selectionReason: 'ACTION attempt failed and was caught by its ON_ERROR edge', selectedEdgeKey: input.edgeKey },
    });

    await resolveEdgeTarget(tx, {
      workflowInstanceId: input.workflowInstanceId,
      edgeKey: input.edgeKey,
      targetNodeKey: input.targetNodeKey,
      targetIsJoin: input.targetIsJoin ?? false,
      join: input.join,
      sourceBranchTokenId: input.sourceBranchTokenId,
    });
  });
}
