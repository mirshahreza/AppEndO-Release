import { prisma, toId, fromId } from '../prismaHelpers';
import { WorkflowDomainError } from '../errors';
import { canonicalJsonFingerprint } from '../canonicalJson';
import { nextWorkItemStatus, type WorkItemStatus } from '../transitions';
import { emitTraceAutoRevision } from './traceEmission';
import { resolveEdgeTarget, closeActiveWorkItemsInTx, cancelAllActiveWaitsForInstanceWithTrace, NON_TERMINAL_NODE_STATUSES, type EdgeTargetJoin } from './continuationApply';
import type { JsonValue } from '../awm/types';
import type { WorkflowActorType, WorkItemEscalationActorType } from '../types';

/**
 * Work Item atomic transaction primitives (doc 07 sections 3, 5, 6, 9; doc 03 sections 8, 17) —
 * companion to `continuationApply.ts`, kept in its own module because Work Item lifecycle
 * transactions are numerous and orthogonal to the generic node-continuation transactions. Every
 * transaction here is a raw `prisma().$transaction` for the same reason as `continuationApply.ts`'s
 * module doc comment: the Slice 1 CAS helpers each open their own implicit client call and cannot
 * compose into one atomic unit.
 */

export type ApplyWorkItemClaimInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  actorId: number;
};

/** Doc 07 section 3 — "Claim transition and transition history are atomic." */
export async function applyWorkItemClaim(input: ApplyWorkItemClaimInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const existing = await tx.workItem.findUnique({ where: { id: toId(input.workItemId) } });
    if (!existing) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
    }
    const nextStatus = nextWorkItemStatus(existing.status as WorkItemStatus, 'CLAIM');
    if (!nextStatus) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not OPEN (actual: ${existing.status}).`, { workItemId: input.workItemId });
    }

    const update = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion, status: 'OPEN' },
      data: { status: nextStatus, claimedByUserId: toId(input.actorId), claimedAt: new Date(), stateVersion: { increment: 1 } },
    });
    if (update.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale or is no longer OPEN (race).', { workItemId: input.workItemId, expectedStateVersion: input.expectedWorkItemStateVersion });
    }

    await tx.workItemTransition.create({
      data: {
        workItemId: toId(input.workItemId),
        fromStatus: existing.status,
        toStatus: nextStatus,
        transitionType: 'CLAIM',
        actorType: 'USER',
        actorId: toId(input.actorId),
        workItemStateVersionAfter: input.expectedWorkItemStateVersion + 1,
      },
    });

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_CLAIMED',
      actorType: 'USER',
      actorId: input.actorId,
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'CLAIM', actorType: 'USER', resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
    });
  });
}

export type ApplyWorkItemReassignmentInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  newAssignmentStrategy: string;
  newAssignmentEvidenceJson: string;
  clearClaim: boolean;
  actorType: WorkflowActorType;
  actorId: number | null;
  reasonCode?: string;
  /** HWF-2.5 — `'FORWARD'` when the current claimant hands the item to someone else themselves (self-service, full transfer, no accountability held back); defaults to `'REASSIGN'` (operator-driven). Both use the exact same mechanics — only the recorded evidence label differs, since this platform's `WorkItem` model has no separate "delegated-to" column to express WS-HumanTask's stricter Delegate (temporary, accountability retained) semantics yet. */
  transitionType?: 'REASSIGN' | 'FORWARD';
};

/** Doc 07 section 6 — "Reassignment is authorized and expected-version fenced, clears incompatible claim and records actor/reason plus assignment evidence." */
export async function applyWorkItemReassignment(input: ApplyWorkItemReassignmentInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const existing = await tx.workItem.findUnique({ where: { id: toId(input.workItemId) } });
    if (!existing) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
    }
    if (existing.status !== 'OPEN' && existing.status !== 'CLAIMED') {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${existing.status}).`, { workItemId: input.workItemId });
    }

    let nextStatus: WorkItemStatus = existing.status as WorkItemStatus;
    if (input.clearClaim && existing.status === 'CLAIMED') {
      const cleared = nextWorkItemStatus('CLAIMED', 'REASSIGN_CLEAR_CLAIM');
      if (!cleared) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'REASSIGN_CLEAR_CLAIM is not a legal transition from CLAIMED.', { workItemId: input.workItemId });
      nextStatus = cleared;
    }

    const update = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion, status: existing.status },
      data: {
        status: nextStatus,
        assignmentStrategy: input.newAssignmentStrategy,
        assignmentEvidenceJson: input.newAssignmentEvidenceJson,
        claimedByUserId: nextStatus === 'OPEN' ? null : undefined,
        claimedAt: nextStatus === 'OPEN' ? null : undefined,
        stateVersion: { increment: 1 },
      },
    });
    if (update.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale (race).', { workItemId: input.workItemId, expectedStateVersion: input.expectedWorkItemStateVersion });
    }

    const transitionType = input.transitionType ?? 'REASSIGN';

    await tx.workItemTransition.create({
      data: {
        workItemId: toId(input.workItemId),
        fromStatus: existing.status,
        toStatus: nextStatus,
        transitionType,
        actorType: input.actorType,
        actorId: input.actorId != null ? toId(input.actorId) : null,
        reasonCode: input.reasonCode ?? null,
        workItemStateVersionAfter: input.expectedWorkItemStateVersion + 1,
      },
    });

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_REASSIGNED',
      actorType: input.actorType,
      actorId: input.actorId ?? undefined,
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType, actorType: input.actorType, resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
    });
  });
}

type CompletionEvidence =
  | { kind: 'ACTOR'; actorType: WorkflowActorType; actorId: number | null; reasonCode?: string }
  | { kind: 'ESCALATION'; policyStepKey: string; executionNumber: number; maxExecutions: number; evidenceJson?: string };

export type ApplyWorkItemCompletionInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  outcome: string;
  outputJson: string;
  evidence: CompletionEvidence;
  workflowInstanceId: number;
  sourceNodeKey: string;
  waitId: number;
  expectedWaitStateVersion: number;
  completingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  edgeKey: string;
  targetNodeKey: string;
  targetIsJoin: boolean;
  join?: EdgeTargetJoin;
  sourceBranchTokenId: number | null;
  updatedVariables?: { variables: Record<string, JsonValue>; expectedInstanceStateVersion: number };
};

/**
 * Doc 07 section 3/9 — "Completion validates actor, expected version/state, allowed outcome, output
 * contract and parent instance/node state. It atomically commits Work Item terminal transition,
 * transition history, exact HUMAN wait satisfaction under expected wait version, outcome/output,
 * trace and typed continuation." Shared by actor-driven completion (`workItemService.ts`) and the
 * `COMPLETE_WITH_OUTCOME` escalation action (doc 07 section 5: "actor type SYSTEM_ESCALATION...
 * null completedByUserId and policy-step core evidence") — they differ only in the evidence row
 * written (`WorkItemTransition` vs `WorkItemEscalation`). Reuses `continuationApply.ts`'s
 * `resolveEdgeTarget` so a WORK_ITEM node can legally be the last node in a parallel branch with no
 * Work-Item-specific join logic of its own (same composition Slice 7 already proved for
 * DELAY/WAIT_EVENT).
 */
export async function applyWorkItemCompletion(input: ApplyWorkItemCompletionInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const runningInstance = await tx.workflowInstance.findFirst({ where: { id: toId(input.workflowInstanceId), status: 'RUNNING' }, select: { id: true } });
    if (!runningInstance) {
      throw new WorkflowDomainError('WF_EXEC_INSTANCE_NOT_EXECUTABLE', 'Owning WorkflowInstance is not RUNNING — Work Item completion requires a RUNNING owner.', { workflowInstanceId: input.workflowInstanceId });
    }

    const existing = await tx.workItem.findUnique({ where: { id: toId(input.workItemId) } });
    if (!existing) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
    }
    const nextStatus = nextWorkItemStatus(existing.status as WorkItemStatus, 'COMPLETE_WITH_OUTCOME');
    if (!nextStatus) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${existing.status}).`, { workItemId: input.workItemId });
    }

    const workItemUpdate = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion, status: { in: ['OPEN', 'CLAIMED'] } },
      data: { status: nextStatus, outcome: input.outcome, outputJson: input.outputJson, completedAt: new Date(), stateVersion: { increment: 1 } },
    });
    if (workItemUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale or is no longer active (race).', { workItemId: input.workItemId, expectedStateVersion: input.expectedWorkItemStateVersion });
    }

    if (input.evidence.kind === 'ACTOR') {
      await tx.workItemTransition.create({
        data: {
          workItemId: toId(input.workItemId),
          fromStatus: existing.status,
          toStatus: nextStatus,
          transitionType: 'COMPLETE_WITH_OUTCOME',
          actorType: input.evidence.actorType,
          actorId: input.evidence.actorId != null ? toId(input.evidence.actorId) : null,
          reasonCode: input.evidence.reasonCode ?? null,
          workItemStateVersionAfter: input.expectedWorkItemStateVersion + 1,
        },
      });
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.completingNodeInstanceId,
        traceType: 'WORK_ITEM_COMPLETED',
        actorType: input.evidence.actorType,
        actorId: input.evidence.actorId ?? undefined,
        corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'COMPLETE_WITH_OUTCOME', actorType: input.evidence.actorType, outcomeKey: input.outcome, resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
      });
    } else {
      const existingExecutions = await tx.workItemEscalation.count({ where: { workItemId: toId(input.workItemId), policyStepKey: input.evidence.policyStepKey } });
      if (existingExecutions >= input.evidence.maxExecutions) {
        throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Escalation step "${input.evidence.policyStepKey}" has already reached its configured maxExecutions.`, { workItemId: input.workItemId, policyStepKey: input.evidence.policyStepKey });
      }
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.completingNodeInstanceId,
        traceType: 'WORK_ITEM_ESCALATION_STARTED',
        actorType: 'SYSTEM_ESCALATION',
        corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'COMPLETE_WITH_OUTCOME', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: existing.stateVersion },
      });
      await tx.workItemEscalation.create({
        data: {
          workItemId: toId(input.workItemId),
          policyStepKey: input.evidence.policyStepKey,
          executionNumber: input.evidence.executionNumber,
          status: 'SUCCEEDED',
          actionType: 'COMPLETE_WITH_OUTCOME',
          actorType: 'SYSTEM_ESCALATION' satisfies WorkItemEscalationActorType,
          startedAt: new Date(),
          completedAt: new Date(),
          evidenceJson: input.evidence.evidenceJson ?? null,
        },
      });
      await emitTraceAutoRevision(tx, {
        workflowInstanceId: input.workflowInstanceId,
        nodeInstanceId: input.completingNodeInstanceId,
        traceType: 'WORK_ITEM_ESCALATION_SUCCEEDED',
        actorType: 'SYSTEM_ESCALATION',
        corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'COMPLETE_WITH_OUTCOME', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
      });
    }

    const waitUpdate = await tx.workflowWait.updateMany({
      where: { id: toId(input.waitId), stateVersion: input.expectedWaitStateVersion, status: 'ACTIVE' },
      data: { status: 'SATISFIED', satisfiedAt: new Date(), stateVersion: { increment: 1 }, resultPayloadJson: JSON.stringify({ outcome: input.outcome, output: JSON.parse(input.outputJson) as JsonValue }) },
    });
    if (waitUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'WorkflowWait stateVersion is stale or wait is not ACTIVE.', { waitId: input.waitId });
    }
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.completingNodeInstanceId,
      traceType: 'WAIT_SATISFIED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: input.sourceNodeKey, waitId: String(input.waitId), waitType: 'HUMAN', priorWaitVersion: input.expectedWaitStateVersion, winnerReason: `Work Item completed with outcome "${input.outcome}"`, owningNodeKey: input.sourceNodeKey },
    });

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.completingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'WAITING_HUMAN' },
      data: { status: 'SUCCEEDED', outputJson: JSON.stringify({ outcome: input.outcome, output: JSON.parse(input.outputJson) as JsonValue }), stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Completing WAITING_HUMAN WorkflowNodeInstance is not at the expected version.', { id: input.completingNodeInstanceId });
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
      corePayload: { nodeKey: input.sourceNodeKey, edgeKey: input.edgeKey, sourceNodeKey: input.sourceNodeKey, selectionMode: 'WORK_ITEM_OUTCOME', selectionReason: `Work Item outcome "${input.outcome}"`, selectedEdgeKey: input.edgeKey },
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

export type ApplyEscalationReassignInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  newAssignmentEvidenceJson: string;
  policyStepKey: string;
  executionNumber: number;
  maxExecutions: number;
};

/** Doc 07 section 5 — REASSIGN_USER / REASSIGN_ROLE escalation actions. Reassignment never clears an existing claim by itself (doc 07 section 6's "incompatible claim" clearing is the actor-driven `applyWorkItemReassignment` path's concern; an escalation-driven reassignment only updates assignment evidence for future eligibility). */
export async function applyEscalationReassign(input: ApplyEscalationReassignInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const existing = await tx.workItem.findUnique({ where: { id: toId(input.workItemId) } });
    if (!existing) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
    }
    if (existing.status !== 'OPEN' && existing.status !== 'CLAIMED') {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${existing.status}).`, { workItemId: input.workItemId });
    }
    const existingExecutions = await tx.workItemEscalation.count({ where: { workItemId: toId(input.workItemId), policyStepKey: input.policyStepKey } });
    if (existingExecutions >= input.maxExecutions) {
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Escalation step "${input.policyStepKey}" has already reached its configured maxExecutions.`, { workItemId: input.workItemId, policyStepKey: input.policyStepKey });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_ESCALATION_STARTED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'REASSIGN', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: existing.stateVersion },
    });

    const update = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion },
      data: { assignmentStrategy: 'EXPRESSION', assignmentEvidenceJson: input.newAssignmentEvidenceJson, stateVersion: { increment: 1 } },
    });
    if (update.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale (race).', { workItemId: input.workItemId });
    }

    await tx.workItemEscalation.create({
      data: {
        workItemId: toId(input.workItemId),
        policyStepKey: input.policyStepKey,
        executionNumber: input.executionNumber,
        status: 'SUCCEEDED',
        actionType: 'REASSIGN',
        actorType: 'SYSTEM_ESCALATION' satisfies WorkItemEscalationActorType,
        startedAt: new Date(),
        completedAt: new Date(),
        evidenceJson: input.newAssignmentEvidenceJson,
      },
    });

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_ESCALATION_SUCCEEDED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'REASSIGN', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
    });
  });
}

export type ApplyEscalationRaisePriorityInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  requestedPriority: number;
  policyStepKey: string;
  executionNumber: number;
  maxExecutions: number;
};

/** Doc 07 section 8 — RAISE_PRIORITY "replaces the persisted priority only when the new value is strictly greater; an equal/lower request is a successful no-op with escalation evidence." */
export async function applyEscalationRaisePriority(input: ApplyEscalationRaisePriorityInput): Promise<{ applied: boolean }> {
  return prisma().$transaction(async (tx) => {
    const existing = await tx.workItem.findUnique({ where: { id: toId(input.workItemId) } });
    if (!existing) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
    }
    if (existing.status !== 'OPEN' && existing.status !== 'CLAIMED') {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${existing.status}).`, { workItemId: input.workItemId });
    }
    const existingExecutions = await tx.workItemEscalation.count({ where: { workItemId: toId(input.workItemId), policyStepKey: input.policyStepKey } });
    if (existingExecutions >= input.maxExecutions) {
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Escalation step "${input.policyStepKey}" has already reached its configured maxExecutions.`, { workItemId: input.workItemId, policyStepKey: input.policyStepKey });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_ESCALATION_STARTED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'RAISE_PRIORITY', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: existing.stateVersion },
    });

    const applied = input.requestedPriority > existing.priority;
    const update = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion },
      data: { priority: applied ? input.requestedPriority : undefined, stateVersion: { increment: 1 } },
    });
    if (update.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale (race).', { workItemId: input.workItemId });
    }

    await tx.workItemEscalation.create({
      data: {
        workItemId: toId(input.workItemId),
        policyStepKey: input.policyStepKey,
        executionNumber: input.executionNumber,
        status: 'SUCCEEDED',
        actionType: 'RAISE_PRIORITY',
        actorType: 'SYSTEM_ESCALATION' satisfies WorkItemEscalationActorType,
        startedAt: new Date(),
        completedAt: new Date(),
        evidenceJson: JSON.stringify({ requestedPriority: input.requestedPriority, previousPriority: existing.priority, applied }),
      },
    });

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_ESCALATION_SUCCEEDED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'RAISE_PRIORITY', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
    });

    return { applied };
  });
}

export type ApplyEscalationNotifyInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  policyStepKey: string;
  executionNumber: number;
  maxExecutions: number;
  evidenceJson: string;
};

/** Records a NOTIFY escalation execution without changing assignment. Notifications are persisted before this call. */
export async function applyEscalationNotify(input: ApplyEscalationNotifyInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const existing = await tx.workItem.findUnique({ where: { id: toId(input.workItemId) } });
    if (!existing) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
    }
    if (existing.status !== 'OPEN' && existing.status !== 'CLAIMED') {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${existing.status}).`, { workItemId: input.workItemId });
    }
    const existingExecutions = await tx.workItemEscalation.count({ where: { workItemId: toId(input.workItemId), policyStepKey: input.policyStepKey } });
    if (existingExecutions >= input.maxExecutions) {
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Escalation step "${input.policyStepKey}" has already reached its configured maxExecutions.`, { workItemId: input.workItemId, policyStepKey: input.policyStepKey });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_ESCALATION_STARTED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'NOTIFY', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: existing.stateVersion },
    });

    const update = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion },
      data: { stateVersion: { increment: 1 } },
    });
    if (update.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale (race).', { workItemId: input.workItemId });
    }

    await tx.workItemEscalation.create({
      data: {
        workItemId: toId(input.workItemId),
        policyStepKey: input.policyStepKey,
        executionNumber: input.executionNumber,
        status: 'SUCCEEDED',
        actionType: 'NOTIFY',
        actorType: 'SYSTEM_ESCALATION' satisfies WorkItemEscalationActorType,
        startedAt: new Date(),
        completedAt: new Date(),
        evidenceJson: input.evidenceJson,
      },
    });

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: fromId(existing.workflowInstanceId),
      nodeInstanceId: fromId(existing.nodeInstanceId),
      traceType: 'WORK_ITEM_ESCALATION_SUCCEEDED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'NOTIFY', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
    });
  });
}

export type ApplyEscalationFailWorkflowNodeInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  workflowInstanceId: number;
  failingNodeInstanceId: number;
  nodeKey: string;
  expectedNodeStateVersion: number;
  expectedInstanceStateVersion: number;
  policyStepKey: string;
  executionNumber: number;
  maxExecutions: number;
  errorCode: string;
  safeMessage: string;
};

/**
 * Doc 07 section 9 — "FAIL_WORKFLOW_NODE applies the V1 unhandled failure transaction and atomically
 * terminalizes the Work Item as FAILED when the failure decision wins." Inlines the same doc 05
 * section 29 propagation `applyFailInstanceContinuation` performs (cannot call it directly — it
 * opens its own transaction) plus the Work Item's own `FAILED` transition and escalation evidence,
 * all as one unit. `closeActiveWorkItemsInTx` runs after this Work Item's own FAILED transition, so
 * it naturally excludes this Work Item (no longer OPEN/CLAIMED) and only closes *other* active ones.
 */
export async function applyEscalationFailWorkflowNode(input: ApplyEscalationFailWorkflowNodeInput): Promise<void> {
  await prisma().$transaction(async (tx) => {
    const existing = await tx.workItem.findUnique({ where: { id: toId(input.workItemId) } });
    if (!existing) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
    }
    const nextStatus = nextWorkItemStatus(existing.status as WorkItemStatus, 'FAIL');
    if (!nextStatus) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${existing.status}).`, { workItemId: input.workItemId });
    }
    const existingExecutions = await tx.workItemEscalation.count({ where: { workItemId: toId(input.workItemId), policyStepKey: input.policyStepKey } });
    if (existingExecutions >= input.maxExecutions) {
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Escalation step "${input.policyStepKey}" has already reached its configured maxExecutions.`, { workItemId: input.workItemId, policyStepKey: input.policyStepKey });
    }

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.failingNodeInstanceId,
      traceType: 'WORK_ITEM_ESCALATION_STARTED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'FAIL_WORKFLOW_NODE', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: existing.stateVersion },
    });

    const workItemUpdate = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion, status: { in: ['OPEN', 'CLAIMED'] } },
      data: { status: nextStatus, completedAt: new Date(), stateVersion: { increment: 1 } },
    });
    if (workItemUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale (race).', { workItemId: input.workItemId });
    }

    await tx.workItemEscalation.create({
      data: {
        workItemId: toId(input.workItemId),
        policyStepKey: input.policyStepKey,
        executionNumber: input.executionNumber,
        status: 'SUCCEEDED',
        actionType: 'FAIL_WORKFLOW_NODE',
        actorType: 'SYSTEM_ESCALATION' satisfies WorkItemEscalationActorType,
        startedAt: new Date(),
        completedAt: new Date(),
        evidenceJson: JSON.stringify({ errorCode: input.errorCode, safeMessage: input.safeMessage }),
      },
    });

    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.failingNodeInstanceId,
      traceType: 'WORK_ITEM_ESCALATION_SUCCEEDED',
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { workItemId: String(input.workItemId), workItemType: existing.workItemType, transitionType: 'FAIL_WORKFLOW_NODE', actorType: 'SYSTEM_ESCALATION', resultingWorkItemStateVersion: input.expectedWorkItemStateVersion + 1 },
    });

    const nodeUpdate = await tx.workflowNodeInstance.updateMany({
      where: { id: toId(input.failingNodeInstanceId), stateVersion: input.expectedNodeStateVersion, status: 'WAITING_HUMAN' },
      data: { status: 'FAILED', stateVersion: { increment: 1 } },
    });
    if (nodeUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Failing WORK_ITEM WorkflowNodeInstance is not WAITING_HUMAN at the expected version.', { id: input.failingNodeInstanceId });
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
      actorType: 'SYSTEM_ESCALATION',
      corePayload: { nodeKey: input.nodeKey, machineErrorCode: input.errorCode, causalIdentity: input.nodeKey },
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
  });
}
