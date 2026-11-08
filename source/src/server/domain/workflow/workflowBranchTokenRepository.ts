import { prisma, toId, fromId, toIsoString } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowBranchTokenStatus, type WorkflowBranchTokenCommand, type WorkflowBranchTokenStatus } from './transitions';
import type { WorkflowBranchTokenRecord } from './types';

const mapWorkflowBranchTokenRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  splitNodeKey: string;
  joinNodeKey: string;
  branchEdgeKey: string;
  status: string;
  stateVersion: number;
  createdAt: Date | null;
  terminalAt: Date | null;
}): WorkflowBranchTokenRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  splitNodeKey: row.splitNodeKey,
  joinNodeKey: row.joinNodeKey,
  branchEdgeKey: row.branchEdgeKey,
  status: row.status as WorkflowBranchTokenStatus,
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  terminalAt: toIsoString(row.terminalAt),
});

export type BranchTokenSeed = { splitNodeKey: string; joinNodeKey: string; branchEdgeKey: string };

/** Unique `(workflowInstanceId, splitNodeKey, branchEdgeKey)` — a branch edge is tokenized at most once per split, per instance. */
export async function createBranchTokensForSplit(
  workflowInstanceId: number,
  tokens: readonly BranchTokenSeed[],
): Promise<WorkflowBranchTokenRecord[]> {
  await prisma().workflowBranchToken.createMany({
    data: tokens.map((token) => ({
      workflowInstanceId: toId(workflowInstanceId),
      splitNodeKey: token.splitNodeKey,
      joinNodeKey: token.joinNodeKey,
      branchEdgeKey: token.branchEdgeKey,
      status: 'ACTIVE' as const,
    })),
  });
  const rows = await prisma().workflowBranchToken.findMany({
    where: { workflowInstanceId: toId(workflowInstanceId), splitNodeKey: { in: tokens.map((t) => t.splitNodeKey) } },
  });
  return rows.map(mapWorkflowBranchTokenRecord);
}

export async function getBranchTokenById(id: number): Promise<WorkflowBranchTokenRecord | undefined> {
  const row = await prisma().workflowBranchToken.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowBranchTokenRecord(row) : undefined;
}

/** CAS terminal transition — guard from transitions.ts. */
export async function transitionBranchTokenStatus(
  id: number,
  expectedStateVersion: number,
  command: WorkflowBranchTokenCommand,
): Promise<WorkflowBranchTokenRecord> {
  const existing = await getBranchTokenById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowBranchToken not found.', { id });
  }
  const nextStatus = nextWorkflowBranchTokenStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Illegal branch-token command ${command} from ${existing.status}.`, { id, command });
  }
  const result = await prisma().workflowBranchToken.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion, status: 'ACTIVE' },
    data: { status: nextStatus, terminalAt: new Date(), stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowBranchToken stateVersion is stale or already terminal.', { id, expectedStateVersion });
  }
  return (await getBranchTokenById(id))!;
}
