import { prisma, toId } from '../prismaHelpers';
import { WorkflowDomainError } from '../errors';
import { canonicalJsonFingerprint } from '../canonicalJson';
import { getWorkflowInstanceById, transitionWorkflowInstanceStatus } from '../workflowInstanceRepository';
import { getNodeInstanceById, listNodeInstancesForInstance, reclaimStaleRunningNode } from '../workflowNodeInstanceRepository';
import { getLatestAttemptForNode, listAttemptsForNode, transitionAttemptStatus } from '../workflowExecutionAttemptRepository';
import { emitTraceAutoRevision } from './traceEmission';
import { applyCancelInstanceContinuation } from './continuationApply';
import { dispatchClaimedNode, type DispatchResult } from './dispatchService';
import type { WorkflowInstanceRecord, WorkflowNodeInstanceRecord, WorkflowExecutionAttemptRecord } from '../types';

/**
 * Operational commands (doc 06 section 12): "Start, Suspend, Resume, Cancel, retry an allowed
 * failed node, force new invocation after unknown outcome, and Inspect." `Start` lives in
 * `startService.ts`. Every mutation here requires expected state/version, matching doc 06 section
 * 12's "every mutation requires authorization, expected state/version and audit" — full
 * authorization/audit wiring is doc 09 territory and not yet built (same documented gap as
 * `attemptService.ts`'s `resolveActionProviderForNode`); trace/audit emission is Slice 10.
 */

const DEFAULT_LEASE_DURATION_MS = 30_000;

/**
 * `INSTANCE_SUSPENDED`/`INSTANCE_RESUMED`/`ACTION_ATTEMPT_CANCELLED` trace evidence below is written
 * in a small follow-up transaction right after the underlying repository CAS commits, not co-atomic
 * with it — `transitionWorkflowInstanceStatus`/`transitionAttemptStatus` are Slice 1 repository
 * primitives that open their own implicit `prisma()` calls (same "extra write, not invasive storage
 * rewrite" trade-off documented in `attemptService.ts`'s `beginActionAttempt` and
 * `dispatchService.ts`'s `NODE_CLAIMED`).
 */
export async function suspendInstance(instanceId: number, expectedStateVersion: number): Promise<WorkflowInstanceRecord> {
  const result = await transitionWorkflowInstanceStatus(instanceId, expectedStateVersion, 'SUSPEND');
  await prisma().$transaction(async (tx) => {
    await emitTraceAutoRevision(tx, { workflowInstanceId: instanceId, traceType: 'INSTANCE_SUSPENDED', actorType: 'SYSTEM', corePayload: {} });
  });
  return result;
}

export async function resumeInstance(instanceId: number, expectedStateVersion: number): Promise<WorkflowInstanceRecord> {
  const result = await transitionWorkflowInstanceStatus(instanceId, expectedStateVersion, 'RESUME');
  await prisma().$transaction(async (tx) => {
    await emitTraceAutoRevision(tx, { workflowInstanceId: instanceId, traceType: 'INSTANCE_RESUMED', actorType: 'SYSTEM', corePayload: {} });
  });
  return result;
}

/** Doc 05 section 9 / doc 06 section 18 — cancels the instance and every reachable non-terminal node/attempt. */
export async function cancelInstance(instanceId: number, expectedStateVersion: number): Promise<void> {
  await applyCancelInstanceContinuation({ workflowInstanceId: instanceId, expectedInstanceStateVersion: expectedStateVersion });
}

/**
 * Doc 06 section 12 "retry an allowed failed node" — interpreted, per the doc 03 section 15 node
 * table (`FAILED` is terminal; a `RETRYING` node's automatic retry is already scheduled and
 * self-heals), as an operator forcing an already-scheduled `RETRYING` node eligible *now* instead of
 * waiting out its computed `nextEligibleAt` delay. `FAILED` itself has no outgoing transition in V1
 * (doc 05 section 29 already cascaded it to instance `FAILED`, which is terminal) — there is no
 * legal command that resurrects a `FAILED` node, so this only accelerates a pending retry.
 */
export async function retryEligibleNodeNow(nodeInstanceId: number, expectedStateVersion: number): Promise<WorkflowNodeInstanceRecord> {
  const result = await prisma().workflowNodeInstance.updateMany({
    where: { id: toId(nodeInstanceId), stateVersion: expectedStateVersion, status: 'RETRYING' },
    data: { nextEligibleAt: new Date(), stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowNodeInstance is not RETRYING at the expected version — operator retry only accelerates an already-scheduled retry.', { nodeInstanceId, expectedStateVersion });
  }
  return (await getNodeInstanceById(nodeInstanceId))!;
}

/**
 * Doc 06 section 5/12 "force new invocation after unknown outcome" — requires elevated governed
 * authorization and explicit operator acknowledgement of possible duplicate external effect
 * (`acknowledgeDuplicateEffectRisk`). Applies to a node that is `RUNNING` with an expired lease and
 * a `STARTED` (uncommitted) attempt — the same uncertainty window `recoveryService.ts` would
 * otherwise resolve automatically. The operator races that automatic path; whichever fenced
 * transition commits first wins (doc 06's general race-resolution pattern).
 */
export async function forceNewInvocationForNode(input: { nodeInstanceId: number; leaseOwnerId: string; acknowledgeDuplicateEffectRisk: boolean }): Promise<DispatchResult> {
  if (!input.acknowledgeDuplicateEffectRisk) {
    throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'ForceNewInvocation requires explicit operator acknowledgement of possible duplicate external effect.', { nodeInstanceId: input.nodeInstanceId });
  }
  const node = await getNodeInstanceById(input.nodeInstanceId);
  if (!node || node.status !== 'RUNNING' || !node.leaseExpiresAt || new Date(node.leaseExpiresAt) > new Date()) {
    throw new WorkflowDomainError('WF_EXEC_NODE_NOT_ELIGIBLE', 'ForceNewInvocation requires a RUNNING node with an expired lease.', { nodeInstanceId: input.nodeInstanceId });
  }
  const latestAttempt = await getLatestAttemptForNode(node.id);
  if (!latestAttempt || latestAttempt.status !== 'STARTED') {
    throw new WorkflowDomainError('WF_EXEC_NODE_NOT_ELIGIBLE', 'ForceNewInvocation requires an in-flight STARTED attempt to supersede.', { nodeInstanceId: input.nodeInstanceId });
  }

  // Discard the stale attempt: CANCELLED means "no longer accepted", not "no side effect occurred" (doc 06 section 18) — matches the operator's explicit risk acknowledgement.
  await transitionAttemptStatus(latestAttempt.id, latestAttempt.stateVersion, 'OWNING_CANCELLATION_WINS');
  await prisma().$transaction(async (tx) => {
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: node.workflowInstanceId,
      nodeInstanceId: node.id,
      traceType: 'ACTION_ATTEMPT_CANCELLED',
      actorType: 'SYSTEM',
      corePayload: {
        nodeKey: node.semanticNodeKey,
        attemptId: String(latestAttempt.id),
        logicalInvocationId: latestAttempt.logicalInvocationId,
        attemptNumber: latestAttempt.attemptNumber,
        idempotencyKeyFingerprint: canonicalJsonFingerprint({ idempotencyKey: latestAttempt.idempotencyKey }),
        providerIdentity: latestAttempt.selectedProviderId && latestAttempt.selectedProviderVersion ? `${latestAttempt.selectedProviderId}@${latestAttempt.selectedProviderVersion}` : 'UNKNOWN_PROVIDER',
      },
    });
  });

  const reclaimed = await reclaimStaleRunningNode(node.id, node.stateVersion, input.leaseOwnerId, DEFAULT_LEASE_DURATION_MS);
  const instance = await getWorkflowInstanceById(reclaimed.workflowInstanceId);
  if (!instance) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Owning WorkflowInstance not found during ForceNewInvocation.', { workflowInstanceId: reclaimed.workflowInstanceId });
  }
  return dispatchClaimedNode(reclaimed, instance, /* forceNewInvocation */ true);
}

export type InstanceInspection = {
  instance: WorkflowInstanceRecord;
  nodeInstances: WorkflowNodeInstanceRecord[];
  attemptsByNodeInstanceId: Record<number, WorkflowExecutionAttemptRecord[]>;
};

/** Doc 06 section 12 `Inspect` — a read-only projection of instance/node/attempt state; no mutation, no authority beyond assembling already-durable data. */
export async function inspectInstance(instanceId: number): Promise<InstanceInspection> {
  const instance = await getWorkflowInstanceById(instanceId);
  if (!instance) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance not found.', { instanceId });
  }
  const nodeInstances = await listNodeInstancesForInstance(instanceId);
  const attemptsByNodeInstanceId: Record<number, WorkflowExecutionAttemptRecord[]> = {};
  for (const node of nodeInstances) {
    const attempts = await listAttemptsForNode(node.id);
    if (attempts.length > 0) attemptsByNodeInstanceId[node.id] = attempts;
  }
  return { instance, nodeInstances, attemptsByNodeInstanceId };
}
