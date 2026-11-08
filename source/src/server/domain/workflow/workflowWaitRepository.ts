import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowWaitStatus, type WorkflowWaitCommand, type WorkflowWaitStatus } from './transitions';
import type { WorkflowWaitRecord, WorkflowWaitType } from './types';

const mapWorkflowWaitRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  owningNodeInstanceId: bigint;
  waitType: string;
  status: string;
  dueAt: Date | null;
  timeoutAt: Date | null;
  eventName: string | null;
  correlationKey: string | null;
  correlationValueHash: string | null;
  correlationEncoderVersion: string | null;
  correlationHashAlgorithm: string | null;
  childInstanceId: bigint | null;
  workItemId: bigint | null;
  satisfiedAt: Date | null;
  resultPayloadJson: string | null;
  stateVersion: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkflowWaitRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  owningNodeInstanceId: fromId(row.owningNodeInstanceId),
  waitType: row.waitType as WorkflowWaitType,
  status: row.status as WorkflowWaitStatus,
  dueAt: toIsoString(row.dueAt),
  timeoutAt: toIsoString(row.timeoutAt),
  eventName: row.eventName,
  correlationKey: row.correlationKey,
  correlationValueHash: row.correlationValueHash,
  correlationEncoderVersion: row.correlationEncoderVersion,
  correlationHashAlgorithm: row.correlationHashAlgorithm,
  childInstanceId: toNullableId(row.childInstanceId),
  workItemId: toNullableId(row.workItemId),
  satisfiedAt: toIsoString(row.satisfiedAt),
  resultPayloadJson: row.resultPayloadJson,
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

export type CreateWaitInput = {
  workflowInstanceId: number;
  owningNodeInstanceId: number;
  waitType: WorkflowWaitType;
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

/** A wait-producing node creates exactly one wait — enforced by the unique `owningNodeInstanceId` column. */
export async function createWait(input: CreateWaitInput): Promise<WorkflowWaitRecord> {
  if (input.waitType === 'EVENT' && (!input.correlationEncoderVersion || !input.correlationHashAlgorithm)) {
    throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'EVENT waits require correlationEncoderVersion and correlationHashAlgorithm.', input);
  }
  const row = await prisma().workflowWait.create({
    data: {
      workflowInstanceId: toId(input.workflowInstanceId),
      owningNodeInstanceId: toId(input.owningNodeInstanceId),
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
  return mapWorkflowWaitRecord(row);
}

export async function getWaitById(id: number): Promise<WorkflowWaitRecord | undefined> {
  const row = await prisma().workflowWait.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowWaitRecord(row) : undefined;
}

export async function getWaitByOwningNodeInstance(owningNodeInstanceId: number): Promise<WorkflowWaitRecord | undefined> {
  const row = await prisma().workflowWait.findUnique({ where: { owningNodeInstanceId: toId(owningNodeInstanceId) } });
  return row ? mapWorkflowWaitRecord(row) : undefined;
}

/**
 * Doc 03 section 24 — a SUBFLOW wait references its child instance; the parent-child link is the
 * wait row itself (no direct `parentInstanceId` column on `WorkflowInstance`). `childInstanceId`
 * has no DB-level `@unique` constraint (unlike `workItemId`), so this uses `findFirst`, not
 * `findUnique` — safe because each child instance is created fresh by exactly one
 * `applyCreateSubflowContinuation` call and is never linked to more than one wait by construction.
 */
export async function getWaitByChildInstance(childInstanceId: number): Promise<WorkflowWaitRecord | undefined> {
  const row = await prisma().workflowWait.findFirst({ where: { childInstanceId: toId(childInstanceId) } });
  return row ? mapWorkflowWaitRecord(row) : undefined;
}

/** Subflow Continuation Scanner source query (doc 05 section 31, doc 06 section 10) — every ACTIVE SUBFLOW wait, global like the Due Timer Scanner. */
export async function listActiveSubflowWaits(): Promise<WorkflowWaitRecord[]> {
  const rows = await prisma().workflowWait.findMany({
    where: { status: 'ACTIVE', waitType: 'SUBFLOW' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapWorkflowWaitRecord);
}

/** Due Timer Scanner source query (doc 06 section 10) — every ACTIVE TIMER wait whose `dueAt` has passed, owned by a RUNNING instance ("TIMER and EVENT scanners skip SUSPENDED owners", doc 06 section 19). */
export async function listDueTimerWaits(now: Date): Promise<WorkflowWaitRecord[]> {
  const rows = await prisma().workflowWait.findMany({
    where: { status: 'ACTIVE', waitType: 'TIMER', dueAt: { lte: now }, instance: { status: 'RUNNING' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapWorkflowWaitRecord);
}

/** Due Timer Scanner source query for timed WAIT_EVENT expiry (doc 05 section 23) — every ACTIVE EVENT wait whose `timeoutAt` has passed, owned by a RUNNING instance. */
export async function listExpiredEventTimeoutWaits(now: Date): Promise<WorkflowWaitRecord[]> {
  const rows = await prisma().workflowWait.findMany({
    where: { status: 'ACTIVE', waitType: 'EVENT', timeoutAt: { lte: now }, instance: { status: 'RUNNING' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapWorkflowWaitRecord);
}

/** Event correlator candidate query (doc 06 section 9, doc 11 section 8) — every ACTIVE EVENT wait matching `(eventName, correlationValueHash)`, owned by a RUNNING instance, ordered deterministically by creation time then ID ("one event satisfies at most one deterministically ordered wait"). */
/** p-99/WFT-9 — `SUBFLOW` is included alongside `EVENT` so a SUBFLOW node's optional `cancelEvent`
 * correlation is matchable too; a SUBFLOW wait with no `cancelEvent` configured simply has null
 * `eventName`/`correlationValueHash` columns and never matches a real search value here. */
export async function listActiveEventWaitsForCorrelation(eventName: string, correlationValueHash: string): Promise<WorkflowWaitRecord[]> {
  const rows = await prisma().workflowWait.findMany({
    where: { status: 'ACTIVE', waitType: { in: ['EVENT', 'SUBFLOW'] }, eventName, correlationValueHash, instance: { status: 'RUNNING' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapWorkflowWaitRecord);
}

/**
 * CAS terminal transition — `WorkflowWait.stateVersion` is the sole ACTIVE-to-terminal fence
 * (doc 03 section 6); node/instance versions are NOT accepted as a substitute here.
 */
export async function transitionWaitStatus(
  id: number,
  expectedWaitStateVersion: number,
  command: WorkflowWaitCommand,
  patch: { resultPayloadJson?: string } = {},
): Promise<WorkflowWaitRecord> {
  const existing = await getWaitById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'WorkflowWait not found.', { id });
  }
  const nextStatus = nextWorkflowWaitStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', `Illegal wait command ${command} from ${existing.status}.`, { id, command });
  }
  const result = await prisma().workflowWait.updateMany({
    where: { id: toId(id), stateVersion: expectedWaitStateVersion, status: 'ACTIVE' },
    data: {
      status: nextStatus,
      satisfiedAt: nextStatus === 'SATISFIED' ? new Date() : undefined,
      stateVersion: { increment: 1 },
      ...(patch.resultPayloadJson !== undefined ? { resultPayloadJson: patch.resultPayloadJson } : {}),
    },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'WorkflowWait stateVersion is stale or wait is not ACTIVE.', { id, expectedWaitStateVersion });
  }
  return (await getWaitById(id))!;
}
