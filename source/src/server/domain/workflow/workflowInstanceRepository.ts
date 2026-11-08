import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowInstanceStatus, type WorkflowInstanceCommand, type WorkflowInstanceStatus } from './transitions';
import type { WorkflowInstanceRecord, WorkflowActorType } from './types';
import { createWorkflowInstanceInputSchema } from './schemas';
import type { z } from 'zod';

export type CreateWorkflowInstanceInput = z.infer<typeof createWorkflowInstanceInputSchema>;

const mapWorkflowInstanceRecord = (row: {
  id: bigint;
  workflowRevisionId: bigint;
  status: string;
  inputJson: string | null;
  contextJson: string | null;
  outputJson: string | null;
  startedByType: string;
  startedById: bigint | null;
  startType: string | null;
  nextTraceSequenceNumber: number;
  stateVersion: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkflowInstanceRecord => ({
  id: fromId(row.id),
  workflowRevisionId: fromId(row.workflowRevisionId),
  status: row.status as WorkflowInstanceStatus,
  inputJson: row.inputJson,
  contextJson: row.contextJson,
  outputJson: row.outputJson,
  startedByType: row.startedByType as WorkflowActorType,
  startedById: toNullableId(row.startedById),
  startType: row.startType,
  nextTraceSequenceNumber: row.nextTraceSequenceNumber,
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

/** Creates the instance in CREATED status only — the atomic start-commit (CREATED -> RUNNING plus node materialization, doc 03 section 24) is a later-slice engine responsibility. */
export async function createWorkflowInstance(input: CreateWorkflowInstanceInput): Promise<WorkflowInstanceRecord> {
  const parsed = createWorkflowInstanceInputSchema.parse(input);
  const row = await prisma().workflowInstance.create({
    data: {
      workflowRevisionId: toId(parsed.workflowRevisionId),
      status: 'CREATED',
      inputJson: parsed.inputJson ?? null,
      startedByType: parsed.startedByType,
      startedById: parsed.startedById != null ? toId(parsed.startedById) : null,
      startType: parsed.startType ?? null,
    },
  });
  return mapWorkflowInstanceRecord(row);
}

export async function getWorkflowInstanceById(id: number): Promise<WorkflowInstanceRecord | undefined> {
  const row = await prisma().workflowInstance.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowInstanceRecord(row) : undefined;
}

export type WorkflowInstanceSummary = WorkflowInstanceRecord & {
  workflowDefinitionId: number;
  workflowDefinitionKey: string;
  revisionNumber: number;
};

export type ListWorkflowInstancesFilters = {
  workflowDefinitionId?: number;
  status?: WorkflowInstanceStatus;
};

/**
 * Operations Cockpit "Instances" list source (new — no prior slice needed a broad instance list,
 * only single-id lookups). Same "broad read, filter/paginate in application code" shape every other
 * Workflow list endpoint already uses (doc 10 section 3 cursor pagination is applied at the
 * transport layer over this array, mirroring `listWorkflowDefinitions`/`listWorkItemInbox`) — no
 * indexable-JSON-column primitive exists across the Postgres/MSSQL/MySQL/SQLite targets this schema
 * supports, so a hard `take` cap plus `orderBy` is the safe, already-established pattern rather than
 * a new query-planner-dependent index.
 */
export async function listWorkflowInstances(filters: ListWorkflowInstancesFilters = {}): Promise<WorkflowInstanceSummary[]> {
  const rows = await prisma().workflowInstance.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.workflowDefinitionId !== undefined ? { revision: { workflowDefinitionId: toId(filters.workflowDefinitionId) } } : {}),
    },
    include: { revision: { include: { definition: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((row) => ({
    ...mapWorkflowInstanceRecord(row),
    workflowDefinitionId: fromId(row.revision.definition.id),
    workflowDefinitionKey: row.revision.definition.key,
    revisionNumber: row.revision.revisionNumber,
  }));
}

const NON_TERMINAL_INSTANCE_STATUSES = ['CREATED', 'RUNNING', 'SUSPENDED'] as const;

/**
 * Package removal impact analysis source query (Slice 12, doc 09 section 9) — counts non-terminal
 * (`CREATED`/`RUNNING`/`SUSPENDED`, doc 03 section 15) instances per revision, for exactly the
 * revision ids the caller already knows reference a given Action (from `actionBindingsJson`). A
 * plain `groupBy`, no new schema/index — `@@index([workflowRevisionId, status])`-equivalent lookup
 * already exists implicitly via the FK column.
 */
export async function countActiveInstancesByRevisionIds(revisionIds: readonly number[]): Promise<Map<number, number>> {
  if (revisionIds.length === 0) return new Map();
  const grouped = await prisma().workflowInstance.groupBy({
    by: ['workflowRevisionId'],
    where: { workflowRevisionId: { in: revisionIds.map(toId) }, status: { in: [...NON_TERMINAL_INSTANCE_STATUSES] } },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [fromId(g.workflowRevisionId), g._count._all]));
}

/** Delete impact — counts every instance (terminal or not) across all revisions of a definition. */
export async function countInstancesByDefinitionId(workflowDefinitionId: number): Promise<number> {
  return prisma().workflowInstance.count({
    where: { revision: { workflowDefinitionId: toId(workflowDefinitionId) } },
  });
}

/** Unpublish impact — counts every non-terminal instance for all revisions of a definition. */
export async function countNonTerminalInstancesByDefinitionId(workflowDefinitionId: number): Promise<number> {
  return prisma().workflowInstance.count({
    where: {
      status: { in: [...NON_TERMINAL_INSTANCE_STATUSES] },
      revision: { workflowDefinitionId: toId(workflowDefinitionId) },
    },
  });
}

/** Unpublish side-effect — lists non-terminal instances newest-first for sequential cancellation. */
export async function listNonTerminalInstancesByDefinitionId(workflowDefinitionId: number): Promise<WorkflowInstanceSummary[]> {
  const rows = await prisma().workflowInstance.findMany({
    where: {
      status: { in: [...NON_TERMINAL_INSTANCE_STATUSES] },
      revision: { workflowDefinitionId: toId(workflowDefinitionId) },
    },
    include: { revision: { include: { definition: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((row) => ({
    ...mapWorkflowInstanceRecord(row),
    workflowDefinitionId: fromId(row.revision.definition.id),
    workflowDefinitionKey: row.revision.definition.key,
    revisionNumber: row.revision.revisionNumber,
  }));
}

/** p-99/WFT-8 — every non-terminal instance still pinned to one specific revision (the migration
 * candidate pool), as opposed to `listNonTerminalInstancesByDefinitionId`'s whole-definition scope. */
export async function listNonTerminalInstancesByRevisionId(workflowRevisionId: number): Promise<WorkflowInstanceRecord[]> {
  const rows = await prisma().workflowInstance.findMany({
    where: { workflowRevisionId: toId(workflowRevisionId), status: { in: [...NON_TERMINAL_INSTANCE_STATUSES] } },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  });
  return rows.map(mapWorkflowInstanceRecord);
}

/**
 * p-99/WFT-8 — CAS revision rebind for the "safe subset" in-flight instance migration. Guarded on
 * both `stateVersion` (no concurrent engine write raced this) and the expected source revision (the
 * instance hasn't already been migrated or reached a terminal state since the impact analysis ran).
 */
export async function migrateInstanceRevision(
  id: number,
  expectedStateVersion: number,
  fromRevisionId: number,
  toRevisionId: number,
): Promise<boolean> {
  const result = await prisma().workflowInstance.updateMany({
    where: {
      id: toId(id),
      stateVersion: expectedStateVersion,
      workflowRevisionId: toId(fromRevisionId),
      status: { in: [...NON_TERMINAL_INSTANCE_STATUSES] },
    },
    data: { workflowRevisionId: toId(toRevisionId), stateVersion: { increment: 1 } },
  });
  return result.count === 1;
}

/** CAS status transition — guard from transitions.ts; throws `WF_EXEC_INSTANCE_NOT_EXECUTABLE`/`WF_EXEC_STALE_STATE_VERSION`. */
export async function transitionWorkflowInstanceStatus(
  id: number,
  expectedStateVersion: number,
  command: WorkflowInstanceCommand,
): Promise<WorkflowInstanceRecord> {
  const existing = await getWorkflowInstanceById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance not found.', { id });
  }
  const nextStatus = nextWorkflowInstanceStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError(
      'WF_EXEC_INSTANCE_NOT_EXECUTABLE',
      `Illegal instance command ${command} from ${existing.status}.`,
      { id, command },
    );
  }
  const result = await prisma().workflowInstance.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    data: { status: nextStatus, stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowInstance stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getWorkflowInstanceById(id))!;
}
