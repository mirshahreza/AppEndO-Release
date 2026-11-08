import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkItemStatus, type WorkItemCommand, type WorkItemStatus } from './transitions';
import type { WorkItemRecord } from './types';
import { createWorkItemInputSchema } from './schemas';
import type { z } from 'zod';

export type CreateWorkItemInput = z.infer<typeof createWorkItemInputSchema>;

const mapWorkItemRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  nodeInstanceId: bigint;
  workItemType: string;
  status: string;
  assignmentStrategy: string | null;
  assignmentEvidenceJson: string | null;
  claimedByUserId: bigint | null;
  priority: number;
  allowedOutcomesJson: string;
  inputJson: string;
  outputSchemaJson: string | null;
  outputJson: string | null;
  outcome: string | null;
  titleText: string;
  summaryText: string | null;
  dueAt: Date | null;
  followUpAt: Date | null;
  approvalGroupKey: string | null;
  claimedAt: Date | null;
  completedAt: Date | null;
  stateVersion: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkItemRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  nodeInstanceId: fromId(row.nodeInstanceId),
  workItemType: row.workItemType,
  status: row.status as WorkItemStatus,
  assignmentStrategy: row.assignmentStrategy,
  assignmentEvidenceJson: row.assignmentEvidenceJson,
  claimedByUserId: toNullableId(row.claimedByUserId),
  priority: row.priority,
  allowedOutcomesJson: row.allowedOutcomesJson,
  inputJson: row.inputJson,
  outputSchemaJson: row.outputSchemaJson,
  outputJson: row.outputJson,
  outcome: row.outcome,
  titleText: row.titleText,
  summaryText: row.summaryText,
  dueAt: toIsoString(row.dueAt),
  followUpAt: toIsoString(row.followUpAt),
  approvalGroupKey: row.approvalGroupKey,
  claimedAt: toIsoString(row.claimedAt),
  completedAt: toIsoString(row.completedAt),
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

/** One Work Item per WORK_ITEM node occurrence (V1) — enforced by the unique `nodeInstanceId` column. */
export async function createWorkItem(input: CreateWorkItemInput): Promise<WorkItemRecord> {
  const parsed = createWorkItemInputSchema.parse(input);
  const row = await prisma().workItem.create({
    data: {
      workflowInstanceId: toId(parsed.workflowInstanceId),
      nodeInstanceId: toId(parsed.nodeInstanceId),
      workItemType: parsed.workItemType,
      status: 'OPEN',
      assignmentStrategy: parsed.assignmentStrategy ?? null,
      assignmentEvidenceJson: parsed.assignmentEvidenceJson ?? null,
      priority: parsed.priority,
      allowedOutcomesJson: parsed.allowedOutcomesJson,
      inputJson: parsed.inputJson,
      outputSchemaJson: parsed.outputSchemaJson ?? null,
      titleText: parsed.titleText,
      summaryText: parsed.summaryText ?? null,
    },
  });
  return mapWorkItemRecord(row);
}

export async function getWorkItemById(id: number): Promise<WorkItemRecord | undefined> {
  const row = await prisma().workItem.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkItemRecord(row) : undefined;
}

export async function getWorkItemByNodeInstance(nodeInstanceId: number): Promise<WorkItemRecord | undefined> {
  const row = await prisma().workItem.findUnique({ where: { nodeInstanceId: toId(nodeInstanceId) } });
  return row ? mapWorkItemRecord(row) : undefined;
}

/** HWF-3.2 — every Work Item ever created on one instance (any status), so "was this user ever a participant" can be decided without a dedicated participation table. */
export async function listWorkItemsByInstance(workflowInstanceId: number): Promise<WorkItemRecord[]> {
  const rows = await prisma().workItem.findMany({ where: { workflowInstanceId: toId(workflowInstanceId) } });
  return rows.map(mapWorkItemRecord);
}

/** Escalation Scanner source query (doc 07 section 5) — every `OPEN`/`CLAIMED` Work Item across every instance, global like the Due Timer Scanner and Recovery Scanner. */
export async function listActiveWorkItems(): Promise<WorkItemRecord[]> {
  const rows = await prisma().workItem.findMany({ where: { status: { in: ['OPEN', 'CLAIMED'] } } });
  return rows.map(mapWorkItemRecord);
}

/**
 * HWF-4.5 — SLA Violations dashboard source query. Two disjoint shapes count as a violation:
 * currently overdue-and-still-open (unbounded — an item that's been open a year is still relevant),
 * or completed after its own `dueAt` (bounded to `recentCompletedWindowMs`, default 30 days, so this
 * doesn't grow into an unbounded full-table scan over every Work Item ever completed). The two
 * `dueAt < now()`/`completedAt > dueAt` comparisons stay in application code rather than the `WHERE`
 * clause — same "broad read, filter in memory" trade-off `workItemInboxService.ts`'s module doc
 * already documents for portable Postgres/MSSQL/MySQL/SQLite support (a same-row two-column compare
 * isn't expressible portably as a single indexable predicate either).
 */
export async function listCandidateSlaWorkItems(recentCompletedWindowMs = 30 * 24 * 60 * 60 * 1000): Promise<WorkItemRecord[]> {
  const cutoff = new Date(Date.now() - recentCompletedWindowMs);
  const rows = await prisma().workItem.findMany({
    where: {
      dueAt: { not: null },
      OR: [
        { status: { in: ['OPEN', 'CLAIMED'] } },
        { completedAt: { gte: cutoff } },
      ],
    },
    orderBy: [{ dueAt: 'asc' }],
  });
  return rows.map(mapWorkItemRecord);
}

/** WFV2-21 — how many Work Items have ever been created for a given definition node (round-robin counter). */
export async function countWorkItemsForDefinitionNode(workflowDefinitionId: number, semanticNodeKey: string): Promise<number> {
  return prisma().workItem.count({
    where: {
      nodeInstance: {
        semanticNodeKey,
        instance: {
          revision: {
            workflowDefinitionId: toId(workflowDefinitionId),
          },
        },
      },
    },
  });
}

/** Inbox projection — omit input/output JSON blobs (doc 07 §10 bounded projection). */
const inboxListSelect = {
  id: true,
  workflowInstanceId: true,
  nodeInstanceId: true,
  workItemType: true,
  status: true,
  assignmentStrategy: true,
  assignmentEvidenceJson: true,
  claimedByUserId: true,
  priority: true,
  allowedOutcomesJson: true,
  outcome: true,
  titleText: true,
  summaryText: true,
  dueAt: true,
  followUpAt: true,
  approvalGroupKey: true,
  claimedAt: true,
  completedAt: true,
  stateVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Work Item Inbox bucket source queries (doc 07 section 10). `assignmentEvidenceJson` is stored as
 * portable `TEXT`, not a native/indexable JSON column, so assignee/role bucket membership is
 * filtered in application code after a status-scoped read — see `workItemInboxService.ts`'s module
 * doc comment. Default ordering is applied here (`priority DESC, createdAt ASC, id ASC`).
 *
 * Optional `completedAtGte` bounds COMPLETED/CANCELLED scans (MINE_RECENT) so the query does not
 * grow into a full historical table read.
 */
export async function listWorkItemsByStatuses(
  statuses: readonly WorkItemStatus[],
  options?: { completedAtGte?: Date; take?: number },
): Promise<WorkItemRecord[]> {
  const rows = await prisma().workItem.findMany({
    where: {
      status: { in: [...statuses] },
      ...(options?.completedAtGte
        ? { completedAt: { gte: options.completedAtGte } }
        : {}),
    },
    select: inboxListSelect,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    ...(options?.take != null ? { take: options.take } : {}),
  });
  return rows.map((row) =>
    mapWorkItemRecord({
      ...row,
      inputJson: '{}',
      outputSchemaJson: null,
      outputJson: null,
    }),
  );
}

/** CAS status transition — guard from transitions.ts. Claim additionally requires OPEN + expected version (eligible expected-version claim, doc 03 section 15). */
export async function transitionWorkItemStatus(
  id: number,
  expectedStateVersion: number,
  command: WorkItemCommand,
  patch: { claimedByUserId?: number | null; outcome?: string; outputJson?: string } = {},
): Promise<WorkItemRecord> {
  const existing = await getWorkItemById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { id });
  }
  const nextStatus = nextWorkItemStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `Illegal Work Item command ${command} from ${existing.status}.`, { id, command });
  }
  const result = await prisma().workItem.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    data: {
      status: nextStatus,
      stateVersion: { increment: 1 },
      claimedAt: command === 'CLAIM' ? new Date() : undefined,
      completedAt: nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED' || nextStatus === 'FAILED' ? new Date() : undefined,
      ...(patch.claimedByUserId !== undefined ? { claimedByUserId: patch.claimedByUserId != null ? toId(patch.claimedByUserId) : null } : {}),
      ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
      ...(patch.outputJson !== undefined ? { outputJson: patch.outputJson } : {}),
    },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getWorkItemById(id))!;
}
