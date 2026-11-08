import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowNodeInstanceStatus, type WorkflowNodeInstanceCommand, type WorkflowNodeInstanceStatus } from './transitions';
import type { WorkflowNodeInstanceRecord } from './types';

const mapWorkflowNodeInstanceRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  semanticNodeKey: string;
  status: string;
  selectedIncomingEdgeKey: string | null;
  branchTokenId: bigint | null;
  joinGroupKey: string | null;
  inputJson: string | null;
  outputJson: string | null;
  nextEligibleAt: Date | null;
  leaseOwnerId: string | null;
  leaseExpiresAt: Date | null;
  nextAttemptNumber: number;
  stateVersion: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkflowNodeInstanceRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  semanticNodeKey: row.semanticNodeKey,
  status: row.status as WorkflowNodeInstanceStatus,
  selectedIncomingEdgeKey: row.selectedIncomingEdgeKey,
  branchTokenId: toNullableId(row.branchTokenId),
  joinGroupKey: row.joinGroupKey,
  inputJson: row.inputJson,
  outputJson: row.outputJson,
  nextEligibleAt: toIsoString(row.nextEligibleAt),
  leaseOwnerId: row.leaseOwnerId,
  leaseExpiresAt: toIsoString(row.leaseExpiresAt),
  nextAttemptNumber: row.nextAttemptNumber,
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

/**
 * Pre-materializes one PENDING node occurrence per semantic node key (doc 03 section 24 — start
 * atomically pre-materializes exactly one PENDING node occurrence for every pinned semantic node).
 * The unique `(workflowInstanceId, semanticNodeKey)` key is both occurrence identity and
 * materialization fence — a second call with an overlapping key fails on the DB constraint.
 */
export async function materializeNodeInstances(
  workflowInstanceId: number,
  semanticNodeKeys: readonly string[],
): Promise<WorkflowNodeInstanceRecord[]> {
  await prisma().workflowNodeInstance.createMany({
    data: semanticNodeKeys.map((semanticNodeKey) => ({
      workflowInstanceId: toId(workflowInstanceId),
      semanticNodeKey,
      status: 'PENDING' as const,
    })),
  });
  const rows = await prisma().workflowNodeInstance.findMany({
    where: { workflowInstanceId: toId(workflowInstanceId), semanticNodeKey: { in: [...semanticNodeKeys] } },
  });
  return rows.map(mapWorkflowNodeInstanceRecord);
}

/**
 * HWF-3.2 — creates a single `RUNNING` node occurrence with a synthetic `semanticNodeKey` that has no
 * counterpart in the published graph (`__adhoc__<uuid>`). Used only for an operator-attached ad-hoc
 * Work Item: it needs a node instance to hang the `applyCreateWorkItemContinuation` transaction off
 * of, but there is no graph dispatch to have already claimed one into `RUNNING`. No CAS is needed —
 * the row is brand new, so nothing else could already hold a lease on it.
 */
export async function createAdHocRunningNodeInstance(workflowInstanceId: number, semanticNodeKey: string): Promise<WorkflowNodeInstanceRecord> {
  const row = await prisma().workflowNodeInstance.create({
    data: { workflowInstanceId: toId(workflowInstanceId), semanticNodeKey, status: 'RUNNING' },
  });
  return mapWorkflowNodeInstanceRecord(row);
}

export async function getNodeInstanceById(id: number): Promise<WorkflowNodeInstanceRecord | undefined> {
  const row = await prisma().workflowNodeInstance.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowNodeInstanceRecord(row) : undefined;
}

/** Recovery Scanner source query (doc 06 sections 2, 16) — every `RUNNING` node whose lease has already expired, across all instances. */
export async function listRunningNodesWithExpiredLease(): Promise<WorkflowNodeInstanceRecord[]> {
  const rows = await prisma().workflowNodeInstance.findMany({
    where: { status: 'RUNNING', leaseExpiresAt: { lte: new Date() } },
  });
  return rows.map(mapWorkflowNodeInstanceRecord);
}

/**
 * Engine Worker source query (Slice 12) — every `READY` node, plus every `RETRYING` node whose
 * `nextEligibleAt` is already due, across all instances, bounded to `limit` ids. Repository Reality
 * Audit (Slice 12): no prior slice built a broad "what is claimable right now" scan — every Slice
 * 5-11 test drives `dispatchNode`/`claimReadyOrRetryingNode` against an already-known
 * `nodeInstanceId` (returned by `Start`/a prior continuation), not a cross-instance poll. This is
 * the one addition needed for `engine/workflowEngineWorker.ts`'s background dispatch loop to find
 * work at all; it returns ids only (no claim), the same "list candidates, then CAS-claim
 * individually" shape `recoveryService.ts` already uses for `listRunningNodesWithExpiredLease`.
 */
export async function listClaimableNodeInstanceIds(limit = 50): Promise<number[]> {
  const rows = await prisma().workflowNodeInstance.findMany({
    where: {
      OR: [
        { status: 'READY' },
        { status: 'RETRYING', OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: new Date() } }] },
      ],
    },
    select: { id: true },
    take: limit,
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => fromId(r.id));
}

export async function listNodeInstancesForInstance(workflowInstanceId: number): Promise<WorkflowNodeInstanceRecord[]> {
  const rows = await prisma().workflowNodeInstance.findMany({ where: { workflowInstanceId: toId(workflowInstanceId) } });
  return rows.map(mapWorkflowNodeInstanceRecord);
}

export async function getNodeInstanceByOccurrence(
  workflowInstanceId: number,
  semanticNodeKey: string,
): Promise<WorkflowNodeInstanceRecord | undefined> {
  const row = await prisma().workflowNodeInstance.findUnique({
    where: { workflowInstanceId_semanticNodeKey: { workflowInstanceId: toId(workflowInstanceId), semanticNodeKey } },
  });
  return row ? mapWorkflowNodeInstanceRecord(row) : undefined;
}

/**
 * Claims a READY or due RETRYING node — CAS on `stateVersion`, requires an absent/expired lease,
 * and (when non-null) `nextEligibleAt <= now` (doc 03 section 25). Sets lease owner/expiry and
 * transitions to RUNNING in the same mutation; there is no claimed-but-READY state.
 */
export async function claimReadyOrRetryingNode(
  id: number,
  expectedStateVersion: number,
  leaseOwnerId: string,
  leaseDurationMs: number,
): Promise<WorkflowNodeInstanceRecord> {
  const existing = await getNodeInstanceById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowNodeInstance not found.', { id });
  }
  const command: WorkflowNodeInstanceCommand = 'CLAIM';
  const nextStatus = nextWorkflowNodeInstanceStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_EXEC_NODE_NOT_ELIGIBLE', `Node is not READY/RETRYING (actual: ${existing.status}).`, { id });
  }
  const now = new Date();
  const result = await prisma().workflowNodeInstance.updateMany({
    where: {
      id: toId(id),
      stateVersion: expectedStateVersion,
      status: existing.status,
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      AND: [{ OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }] }],
    },
    data: {
      status: nextStatus,
      leaseOwnerId,
      leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
      stateVersion: { increment: 1 },
    },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowNodeInstance claim precondition failed (version/lease/eligibility race).', { id });
  }
  return (await getNodeInstanceById(id))!;
}

/**
 * Doc 06 section 8 — heartbeat lease renewal, owned by the engine invocation wrapper and
 * independent of executor callbacks. CAS on `(id, stateVersion, status='RUNNING', leaseOwnerId)`;
 * unlike `reclaimStaleRunningNode` this does NOT require the lease to already be expired — it is
 * the *before-expiry* renewal, not the *after-crash* recovery path.
 */
export async function renewNodeLease(id: number, expectedStateVersion: number, leaseOwnerId: string, leaseDurationMs: number): Promise<WorkflowNodeInstanceRecord> {
  const result = await prisma().workflowNodeInstance.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion, status: 'RUNNING', leaseOwnerId },
    data: { leaseExpiresAt: new Date(Date.now() + leaseDurationMs), stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Heartbeat lease renewal precondition failed (node is no longer RUNNING under this lease owner at the expected version).', { id });
  }
  return (await getNodeInstanceById(id))!;
}

/**
 * Recovery-only lease reclaim for a node that is already `RUNNING` with an expired lease and no
 * committed downstream outcome (doc 06 section 16: "Recovery of non-Action nodes... resumes...
 * completes the missing atomic repository decision if no semantic commit occurred"). Unlike
 * `claimReadyOrRetryingNode`, this does not change `status` — `RUNNING` is not itself a transition
 * target in `transitions.ts`'s node table, it is the same aggregate re-affirming ownership under a
 * fresh lease so recovery can safely redrive the same (idempotent, no-side-effect-yet) evaluation.
 */
export async function reclaimStaleRunningNode(
  id: number,
  expectedStateVersion: number,
  leaseOwnerId: string,
  leaseDurationMs: number,
): Promise<WorkflowNodeInstanceRecord> {
  const now = new Date();
  const result = await prisma().workflowNodeInstance.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion, status: 'RUNNING', leaseExpiresAt: { lte: now } },
    data: { leaseOwnerId, leaseExpiresAt: new Date(now.getTime() + leaseDurationMs), stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowNodeInstance reclaim precondition failed (not RUNNING with an expired lease at the expected version).', { id });
  }
  return (await getNodeInstanceById(id))!;
}

/**
 * F-1 (p-60) compensating transition: a node that was successfully claimed (`RUNNING`) but whose
 * wait/work-item creation phase then failed for a reason other than losing a legitimate concurrent
 * CAS race (that case already surfaces as `WF_EXEC_STALE_STATE_VERSION` and needs no compensation)
 * is returned to `READY` with its lease cleared, so the very next engine tick can simply reclaim and
 * retry it — instead of being left permanently `RUNNING` under a lease with no path back to the
 * dispatch queue (the exact stranding the 2026-07-17 20-scenario challenge reproduced on MSSQL).
 * CAS-gated on `(id, stateVersion, status='RUNNING')`: if the node has since moved on — a concurrent
 * recovery pass or a genuinely successful retry already resolved it — this is a safe no-op.
 */
export async function revertRunningNodeToReadyAfterCreationFailure(id: number, expectedStateVersion: number): Promise<boolean> {
  const existing = await getNodeInstanceById(id);
  if (!existing) return false;
  const nextStatus = nextWorkflowNodeInstanceStatus(existing.status, 'COMPENSATE_CREATION_FAILURE');
  if (!nextStatus) return false;
  const result = await prisma().workflowNodeInstance.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion, status: 'RUNNING' },
    data: { status: nextStatus, leaseOwnerId: null, leaseExpiresAt: null, nextEligibleAt: null, stateVersion: { increment: 1 } },
  });
  return result.count > 0;
}

/** Generic CAS status transition for the remaining node-instance commands (guard from transitions.ts). */
export async function transitionNodeInstanceStatus(
  id: number,
  expectedStateVersion: number,
  command: WorkflowNodeInstanceCommand,
  patch: { selectedIncomingEdgeKey?: string; outputJson?: string } = {},
): Promise<WorkflowNodeInstanceRecord> {
  const existing = await getNodeInstanceById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowNodeInstance not found.', { id });
  }
  const nextStatus = nextWorkflowNodeInstanceStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_EXEC_NODE_NOT_ELIGIBLE', `Illegal node command ${command} from ${existing.status}.`, { id, command });
  }
  const result = await prisma().workflowNodeInstance.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    data: {
      status: nextStatus,
      stateVersion: { increment: 1 },
      ...(patch.selectedIncomingEdgeKey !== undefined ? { selectedIncomingEdgeKey: patch.selectedIncomingEdgeKey } : {}),
      ...(patch.outputJson !== undefined ? { outputJson: patch.outputJson } : {}),
    },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowNodeInstance stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getNodeInstanceById(id))!;
}
