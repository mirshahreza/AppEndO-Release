import { prisma, toId, fromId, toIsoString } from './prismaHelpers';
import type { WorkflowJoinArrivalRecord } from './types';

const mapWorkflowJoinArrivalRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  joinNodeInstanceId: bigint;
  branchTokenId: bigint;
  arrivedAt: Date | null;
}): WorkflowJoinArrivalRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  joinNodeInstanceId: fromId(row.joinNodeInstanceId),
  branchTokenId: fromId(row.branchTokenId),
  arrivedAt: toIsoString(row.arrivedAt),
});

/**
 * Unique `(joinNodeInstanceId, branchTokenId)` proves exactly-once arrival per required token
 * (doc 03 section 24) — a concurrent duplicate insert for the same pair fails on the DB
 * constraint; callers should treat that failure as "already arrived", not retry as a new arrival.
 */
export async function recordJoinArrival(input: {
  workflowInstanceId: number;
  joinNodeInstanceId: number;
  branchTokenId: number;
}): Promise<WorkflowJoinArrivalRecord> {
  const row = await prisma().workflowJoinArrival.create({
    data: {
      workflowInstanceId: toId(input.workflowInstanceId),
      joinNodeInstanceId: toId(input.joinNodeInstanceId),
      branchTokenId: toId(input.branchTokenId),
    },
  });
  return mapWorkflowJoinArrivalRecord(row);
}

export async function listJoinArrivalsForNode(joinNodeInstanceId: number): Promise<WorkflowJoinArrivalRecord[]> {
  const rows = await prisma().workflowJoinArrival.findMany({
    where: { joinNodeInstanceId: toId(joinNodeInstanceId) },
    orderBy: { arrivedAt: 'asc' },
  });
  return rows.map(mapWorkflowJoinArrivalRecord);
}
