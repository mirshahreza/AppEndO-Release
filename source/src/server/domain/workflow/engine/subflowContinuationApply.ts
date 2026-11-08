import { prisma, toId, fromId } from '../prismaHelpers';
import { WorkflowDomainError } from '../errors';
import { canonicalJsonFingerprint } from '../canonicalJson';
import { getWaitByChildInstance } from '../workflowWaitRepository';
import { startWorkflowInstanceInTx, initializeStartVariables } from './startService';
import { emitTraceAutoRevision } from './traceEmission';
import {
  resolveEdgeTarget,
  cascadeCancelChildInstances,
  cancelInstanceAndDescendantsInTx,
  closeActiveWorkItemsInTx,
  cancelAllActiveWaitsForInstanceWithTrace,
  ensureStrictTransactionAbortOnMssql,
  compensateFailedWaitCreation,
  NON_TERMINAL_NODE_STATUSES,
  type EdgeTargetJoin,
} from './continuationApply';
import type { WorkflowModel, JsonValue } from '../awm/types';

/**
 * WFV2-4 — counts how many SUBFLOW ancestors `instanceId` already has by walking the
 * `WorkflowWait.childInstanceId` link upward one hop at a time (doc 03 section 24's own note: no
 * `parentInstanceId` column exists on `WorkflowInstance`, the wait row is the only parent<->child
 * link — Slice 9's Repository Reality Audit finding, re-used rather than re-derived here). The
 * *new* child about to be created under `instanceId` would sit at `depth + 1`. `SAFETY_WALK_CAP`
 * is a defensive bound only — a wait's `childInstanceId` always names a strictly newer instance,
 * so a real cycle is structurally impossible; this just keeps a corrupted chain from hanging the
 * dispatcher instead of surfacing as a slow query.
 */
const SAFETY_WALK_CAP = 500;

export async function computeSubflowAncestorDepth(instanceId: number): Promise<number> {
  let depth = 0;
  let current = instanceId;
  for (let i = 0; i < SAFETY_WALK_CAP; i += 1) {
    const wait = await getWaitByChildInstance(current);
    if (!wait) return depth;
    depth += 1;
    current = wait.workflowInstanceId;
  }
  return depth;
}

/**
 * SUBFLOW atomic transaction primitives (doc 05 sections 7, 16, 31; doc 03 section 24) — companion
 * to `continuationApply.ts`, kept in its own module for the same reason `workItemContinuationApply.ts`
 * is: importing `startWorkflowInstanceInTx` here while `continuationApply.ts` exports the shared
 * `resolveEdgeTarget`/`cascadeCancelChildInstances` primitives `startService.ts` would otherwise need
 * to import back would create an import cycle (`continuationApply.ts` never imports `startService.ts`
 * or this module).
 */

export type ApplyCreateSubflowInput = {
  parentNodeInstanceId: number;
  parentNodeKey: string;
  expectedParentNodeStateVersion: number;
  parentWorkflowInstanceId: number;
  childRevisionId: number;
  childModel: WorkflowModel;
  childInput: JsonValue;
  /** p-99/WFT-9 — present only when the SUBFLOW node declares `cancelEvent`; encoded once by the
   * caller (`dispatchService.ts`, same `encodeCorrelationValue` WAIT_EVENT uses) and stored on this
   * SUBFLOW wait row so `eventCorrelationService.ts` can match an incoming cancel event against it. */
  cancelEvent?: { eventName: string; correlationKey: string; correlationValueHash: string; correlationEncoderVersion: string; correlationHashAlgorithm: string };
};

/**
 * Doc 05 section 31 — "Child start is part of the parent SUBFLOW node's wait-creation transaction...
 * exact child revision resolution, child instance creation/start, durable parent-child link, SUBFLOW
 * wait creation and parent node RUNNING → WAITING commit atomically." Revision/target-definition
 * resolution happens in the caller (`dispatchService.ts`, same "resolve outside, commit inside"
 * pattern ACTION's provider resolution already uses) — this function commits the atomic unit once
 * that resolution is in hand.
 */
export async function applyCreateSubflowContinuation(input: ApplyCreateSubflowInput): Promise<{ childInstanceId: number }> {
  try {
    return await prisma().$transaction(async (tx) => {
      await ensureStrictTransactionAbortOnMssql(tx);

      // F-1 reconcile-first (p-60): a prior attempt may have already durably started the child
      // instance and created this node's SUBFLOW wait — adopting it avoids both the unique-
      // constraint violation AND, worse, starting a second child instance as a side effect.
      const existingWait = await tx.workflowWait.findFirst({ where: { owningNodeInstanceId: toId(input.parentNodeInstanceId) } });
      if (existingWait && existingWait.childInstanceId != null) {
        await tx.workflowNodeInstance.updateMany({
          where: { id: toId(input.parentNodeInstanceId), status: 'RUNNING' },
          data: { status: 'WAITING', stateVersion: { increment: 1 } },
        });
        return { childInstanceId: fromId(existingWait.childInstanceId) };
      }

      const nodeUpdate = await tx.workflowNodeInstance.updateMany({
        where: { id: toId(input.parentNodeInstanceId), stateVersion: input.expectedParentNodeStateVersion, status: 'RUNNING' },
        data: { status: 'WAITING', stateVersion: { increment: 1 } },
      });
      if (nodeUpdate.count === 0) {
        throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'SUBFLOW-creating WorkflowNodeInstance is not RUNNING at the expected version.', { id: input.parentNodeInstanceId });
      }

      const variables = initializeStartVariables(input.childModel, input.childInput);
      const childInstanceId = await startWorkflowInstanceInTx(tx, {
        workflowRevisionId: input.childRevisionId,
        model: input.childModel,
        variables,
        workflowInput: input.childInput,
        startedByType: 'WORKFLOW',
        startedById: input.parentWorkflowInstanceId,
        startType: 'SUBFLOW',
      });

      const wait = await tx.workflowWait.create({
        data: {
          workflowInstanceId: toId(input.parentWorkflowInstanceId),
          owningNodeInstanceId: toId(input.parentNodeInstanceId),
          waitType: 'SUBFLOW',
          status: 'ACTIVE',
          childInstanceId: toId(childInstanceId),
          ...(input.cancelEvent
            ? {
                eventName: input.cancelEvent.eventName,
                correlationKey: input.cancelEvent.correlationKey,
                correlationValueHash: input.cancelEvent.correlationValueHash,
                correlationEncoderVersion: input.cancelEvent.correlationEncoderVersion,
                correlationHashAlgorithm: input.cancelEvent.correlationHashAlgorithm,
              }
            : {}),
        },
      });

      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.parentWorkflowInstanceId,
        nodeInstanceId: input.parentNodeInstanceId,
        traceType: 'WAIT_CREATED',
        actorType: 'SYSTEM',
        corePayload: {
          nodeKey: input.parentNodeKey,
          waitId: String(wait.id),
          waitType: 'SUBFLOW',
          owningNodeKey: input.parentNodeKey,
          ...(input.cancelEvent
            ? { eventName: input.cancelEvent.eventName, correlationEncoderVersion: input.cancelEvent.correlationEncoderVersion, correlationHashAlgorithm: input.cancelEvent.correlationHashAlgorithm }
            : {}),
        },
      });
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.parentWorkflowInstanceId,
        nodeInstanceId: input.parentNodeInstanceId,
        traceType: 'SUBFLOW_STARTED',
        actorType: 'SYSTEM',
        corePayload: { nodeKey: input.parentNodeKey, waitId: String(wait.id) },
      });
      // The child's own `INSTANCE_STARTED` trace is emitted by `startWorkflowInstanceInTx` above
      // (called with `startedByType: 'WORKFLOW'`/`startType: 'SUBFLOW'`) — not duplicated here.

      return { childInstanceId };
    });
  } catch (error) {
    return compensateFailedWaitCreation(input.parentNodeInstanceId, input.expectedParentNodeStateVersion, error);
  }
}

export type ApplySubflowSuccessInput = {
  workflowInstanceId: number;
  sourceNodeKey: string;
  waitId: number;
  expectedWaitStateVersion: number;
  completingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  nodeOutput: JsonValue;
  edgeKey: string;
  targetNodeKey: string;
  targetIsJoin: boolean;
  join?: EdgeTargetJoin;
  sourceBranchTokenId: number | null;
  updatedVariables?: { variables: Record<string, JsonValue>; expectedInstanceStateVersion: number };
};

/** Doc 05 section 31 — "Only child SUCCEEDED satisfies the SUBFLOW wait and produces the child's validated output as parent node output." Gates on parent instance RUNNING (doc 06 section 19's wait-satisfaction rule; doc 05 section 31's "Parent SUSPENDED state is ineligible for child-result application"). */
export async function applySubflowSuccessContinuation(input: ApplySubflowSuccessInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const runningInstance = await tx.workflowInstance.findFirst({ where: { id: toId(input.workflowInstanceId), status: 'RUNNING' }, select: { id: true } });
    if (!runningInstance) {
      throw new WorkflowDomainError('WF_EXEC_INSTANCE_NOT_EXECUTABLE', 'Owning WorkflowInstance is not RUNNING — subflow result application requires a RUNNING owner.', { workflowInstanceId: input.workflowInstanceId });
    }

    const waitUpdate = await tx.workflowWait.updateMany({
      where: { id: toId(input.waitId), stateVersion: input.expectedWaitStateVersion, status: 'ACTIVE' },
      data: { status: 'SATISFIED', satisfiedAt: new Date(), stateVersion: { increment: 1 }, resultPayloadJson: JSON.stringify(input.nodeOutput) },
    });
    if (waitUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'WorkflowWait stateVersion is stale or wait is not ACTIVE.', { waitId: input.waitId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.completingNodeInstanceId,
      traceType: 'WAIT_SATISFIED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, waitId: String(input.waitId), waitType: 'SUBFLOW', priorWaitVersion: input.expectedWaitStateVersion, winnerReason: 'child instance succeeded', owningNodeKey: input.sourceNodeKey },
    });
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.completingNodeInstanceId,
      traceType: 'SUBFLOW_COMPLETED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, waitId: String(input.waitId) },
      diagnosticPayloadJson: JSON.stringify({ childInstanceStatus: 'SUCCEEDED' }),
    });

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.completingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'WAITING' },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify(input.nodeOutput), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Completing WAITING SUBFLOW WorkflowNodeInstance is not at the expected version.', { id: input.completingNodeInstanceId });
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
      corePayload: { nodeKey: input.sourceNodeKey, edgeKey: input.edgeKey, sourceNodeKey: input.sourceNodeKey, selectionMode: 'UNCONDITIONAL', selectionReason: 'SUBFLOW child instance succeeded', selectedEdgeKey: input.edgeKey },
    });

    await resolveEdgeTarget(tx, {
      workflowInstanceId: input.workflowInstanceId,
      edgeKey: input.edgeKey,
      targetNodeKey: input.targetNodeKey,
      targetIsJoin: input.targetIsJoin,
      join: input.join,
      sourceBranchTokenId: input.sourceBranchTokenId,
    });
  });
}

export type ApplySubflowCancelRegionInput = {
  workflowInstanceId: number;
  sourceNodeKey: string;
  waitId: number;
  expectedWaitStateVersion: number;
  childInstanceId: number;
  cancellingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  eventPayload: JsonValue;
  edgeKey: string;
  targetNodeKey: string;
  targetIsJoin: boolean;
  join?: EdgeTargetJoin;
  sourceBranchTokenId: number | null;
  /** Present when the winning event came through normal ingress correlation (always true today —
   * `cancelEvent` has no timeout leg, unlike WAIT_EVENT — kept optional for shape symmetry with
   * `ApplyWaitTerminalSelectEdgeInput`, not because a non-inbox path currently exists). */
  inboxCorrelation?: { inboxId: number; expectedInboxStateVersion: number; eventName: string; correlationEncoderVersion: string; correlationHashAlgorithm: string; candidateOrderPosition: number };
};

/**
 * p-99/WFT-9 — "Cancel Region": the SUBFLOW wait's cancel-event correlation won the race against the
 * child instance's own natural completion (doc pattern: same single-row CAS race WAIT_EVENT's
 * `timeoutAt` already uses — whichever side transitions the wait ACTIVE->terminal first wins; the
 * loser's own CAS simply fails and no-ops, see `applySubflowSuccessContinuation`/
 * `applySubflowUnhandledFailureContinuation`'s identical `status: 'ACTIVE'` guard). Unlike those two
 * paths, this one does NOT touch the rest of the parent instance — only the child instance (cascaded)
 * and this one SUBFLOW node are affected; the parent continues via its CANCEL_REGION edge exactly
 * like a BPMN non-interrupting boundary cancel event.
 */
export async function applySubflowCancelRegionContinuation(input: ApplySubflowCancelRegionInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const runningInstance = await tx.workflowInstance.findFirst({ where: { id: toId(input.workflowInstanceId), status: 'RUNNING' }, select: { id: true } });
    if (!runningInstance) {
      throw new WorkflowDomainError('WF_EXEC_INSTANCE_NOT_EXECUTABLE', 'Owning WorkflowInstance is not RUNNING — Cancel Region requires a RUNNING owner.', { workflowInstanceId: input.workflowInstanceId });
    }

    const waitUpdate = await tx.workflowWait.updateMany({
      where: { id: toId(input.waitId), stateVersion: input.expectedWaitStateVersion, status: 'ACTIVE' },
      data: { status: 'SATISFIED', satisfiedAt: new Date(), stateVersion: { increment: 1 }, resultPayloadJson: JSON.stringify(input.eventPayload) },
    });
    if (waitUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'WorkflowWait stateVersion is stale or wait is not ACTIVE — the child instance likely already completed first.', { waitId: input.waitId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.cancellingNodeInstanceId,
      traceType: 'WAIT_SATISFIED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, waitId: String(input.waitId), waitType: 'SUBFLOW', priorWaitVersion: input.expectedWaitStateVersion, winnerReason: 'cancel-region event correlated', owningNodeKey: input.sourceNodeKey },
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
        nodeInstanceId: input.cancellingNodeInstanceId,
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

    // Cancel the child (+ its own descendants) before flipping the parent node — this is one atomic
    // transaction either way, but ordering it first means a thrown error here (e.g. an invariant
    // violation deep in the cascade) leaves the wait/node exactly as they were, not half-cancelled.
    await cancelInstanceAndDescendantsInTx(tx, input.childInstanceId);

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.cancellingNodeInstanceId,
      traceType: 'SUBFLOW_COMPLETED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, waitId: String(input.waitId) },
      diagnosticPayloadJson: JSON.stringify({ childInstanceStatus: 'CANCELLED_BY_REGION_EVENT' }),
    });

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.cancellingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'WAITING' },
      data: { status: 'CANCELLED', outputJson: JSON.stringify(input.eventPayload), leaseOwnerId: null, leaseExpiresAt: null, nextEligibleAt: null, stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Cancelling WAITING SUBFLOW WorkflowNodeInstance is not at the expected version.', { id: input.cancellingNodeInstanceId });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.cancellingNodeInstanceId,
      traceType: 'EDGE_SELECTED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, edgeKey: input.edgeKey, sourceNodeKey: input.sourceNodeKey, selectionMode: 'CANCEL_REGION', selectionReason: 'SUBFLOW cancelled by its external cancel event', selectedEdgeKey: input.edgeKey },
    });

    await resolveEdgeTarget(tx, {
      workflowInstanceId: input.workflowInstanceId,
      edgeKey: input.edgeKey,
      targetNodeKey: input.targetNodeKey,
      targetIsJoin: input.targetIsJoin,
      join: input.join,
      sourceBranchTokenId: input.sourceBranchTokenId,
    });
  });
}

export type ApplySubflowUnhandledFailureInput = {
  workflowInstanceId: number;
  sourceNodeKey: string;
  waitId: number;
  expectedWaitStateVersion: number;
  failingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  expectedInstanceStateVersion: number;
  /** Child's own terminal status (`FAILED` | `CANCELLED`) — selects `WF_EXEC_SUBFLOW_FAILED` vs `WF_EXEC_SUBFLOW_CANCELLED` for `INSTANCE_FAILED`'s `machineErrorCode` and `SUBFLOW_COMPLETED`'s diagnostic classification (doc 05 section 31's classification, deferred to Slice 10 by Slice 9's own documented gap). */
  childInstanceStatus: 'FAILED' | 'CANCELLED';
};

/**
 * Doc 05 section 31 — "Child FAILED causes the exact ACTIVE SUBFLOW wait to transition CANCELLED,
 * the parent SUBFLOW node to FAILED, and V1 unhandled parent failure with WF_EXEC_SUBFLOW_FAILED.
 * Child CANCELLED not caused by already-winning parent cancellation similarly fails the parent with
 * WF_EXEC_SUBFLOW_CANCELLED." The wait transitions CANCELLED, not SATISFIED — this is the one V1
 * wait-completion path whose winning transition is not the `SATISFY`/`EXPIRE` shape every other
 * wait type uses (doc 03 section 15's terminal-set for `WorkflowWait` is `SATISFIED | CANCELLED |
 * EXPIRED`, and `CANCELLED` is exactly right here: the wait's *purpose* was superseded by the
 * child's own failure, not fulfilled). The caller (`subflowContinuationService.ts`) selects
 * `WF_EXEC_SUBFLOW_FAILED` vs `WF_EXEC_SUBFLOW_CANCELLED` and is responsible for the classification;
 * this transaction only applies the doc 05 section 29 V1 unhandled-failure propagation shape.
 */
export async function applySubflowUnhandledFailureContinuation(input: ApplySubflowUnhandledFailureInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const waitUpdate = await tx.workflowWait.updateMany({
      where: { id: toId(input.waitId), stateVersion: input.expectedWaitStateVersion, status: 'ACTIVE' },
      data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
    });
    if (waitUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'WorkflowWait stateVersion is stale or wait is not ACTIVE.', { waitId: input.waitId });
    }

    const machineErrorCode = input.childInstanceStatus === 'FAILED' ? 'WF_EXEC_SUBFLOW_FAILED' : 'WF_EXEC_SUBFLOW_CANCELLED';
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.failingNodeInstanceId,
      traceType: 'SUBFLOW_COMPLETED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, waitId: String(input.waitId) },
      diagnosticPayloadJson: JSON.stringify({ childInstanceStatus: input.childInstanceStatus }),
    });

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.failingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'WAITING' },
      data: { status: 'FAILED', stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Failing WAITING SUBFLOW WorkflowNodeInstance is not at the expected version.', { id: input.failingNodeInstanceId });
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
      corePayload: { nodeKey: input.sourceNodeKey, machineErrorCode, causalIdentity: input.sourceNodeKey },
    });

    await tx.workflowNodeInstance.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), id: { not: toId(input.failingNodeInstanceId) }, status: { in: [...NON_TERMINAL_NODE_STATUSES] } },
      data: { status: 'CANCELLED', stateVersion: { increment: 1 } },
    });
    await cancelAllActiveWaitsForInstanceWithTrace(tx, input.workflowInstanceId, 'owning instance failed');
    await tx.workflowBranchToken.updateMany({
      where: { workflowInstanceId: toId(input.workflowInstanceId), status: 'ACTIVE' },
      data: { status: 'CANCELLED', terminalAt: new Date(), stateVersion: { increment: 1 } },
    });
    await closeActiveWorkItemsInTx(tx, input.workflowInstanceId, 'INSTANCE_FAILED');
    await cascadeCancelChildInstances(tx, input.workflowInstanceId);
  });
}
