import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import type { Tx } from './engine/txTypes';

/**
 * WFV2-12 — durable park for unhandled workflow failures (operator dead-letter inbox).
 * Kept separate from WorkItem so the V1 one-WorkItem-per-nodeInstance unique invariant stays intact.
 */

export type WorkflowDeadLetterStatus = 'OPEN' | 'RESOLVED' | 'DISCARDED';

export type WorkflowDeadLetterRecord = {
  id: number;
  workflowInstanceId: number;
  nodeInstanceId: number;
  attemptId: number | null;
  nodeKey: string;
  status: WorkflowDeadLetterStatus;
  errorCode: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  evidenceJson: string | null;
  resolvedByUserId: number | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ParkDeadLetterInput = {
  workflowInstanceId: number;
  nodeInstanceId: number;
  attemptId?: number | null;
  nodeKey: string;
  errorCode?: string | null;
  errorClass?: string | null;
  errorMessage?: string | null;
  evidenceJson?: string | null;
};

const mapRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  nodeInstanceId: bigint;
  attemptId: bigint | null;
  nodeKey: string;
  status: string;
  errorCode: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  evidenceJson: string | null;
  resolvedByUserId: bigint | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  stateVersion: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkflowDeadLetterRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  nodeInstanceId: fromId(row.nodeInstanceId),
  attemptId: toNullableId(row.attemptId),
  nodeKey: row.nodeKey,
  status: row.status as WorkflowDeadLetterStatus,
  errorCode: row.errorCode,
  errorClass: row.errorClass,
  errorMessage: row.errorMessage,
  evidenceJson: row.evidenceJson,
  resolvedByUserId: toNullableId(row.resolvedByUserId),
  resolvedAt: toIsoString(row.resolvedAt),
  resolutionNote: row.resolutionNote,
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

/** Idempotent park: if a dead letter already exists for the node occurrence, adopt it (OPEN stays OPEN). */
export async function parkDeadLetterInTx(tx: Tx, input: ParkDeadLetterInput): Promise<void> {
  const existing = await tx.workflowDeadLetter.findUnique({
    where: { nodeInstanceId: toId(input.nodeInstanceId) },
  });
  if (existing) {
    if (existing.status === 'OPEN') return;
    await tx.workflowDeadLetter.update({
      where: { id: existing.id },
      data: {
        status: 'OPEN',
        attemptId: input.attemptId != null ? toId(input.attemptId) : existing.attemptId,
        errorCode: input.errorCode ?? existing.errorCode,
        errorClass: input.errorClass ?? existing.errorClass,
        errorMessage: input.errorMessage ?? existing.errorMessage,
        evidenceJson: input.evidenceJson ?? existing.evidenceJson,
        resolvedByUserId: null,
        resolvedAt: null,
        resolutionNote: null,
        stateVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    return;
  }

  await tx.workflowDeadLetter.create({
    data: {
      workflowInstanceId: toId(input.workflowInstanceId),
      nodeInstanceId: toId(input.nodeInstanceId),
      attemptId: input.attemptId != null ? toId(input.attemptId) : null,
      nodeKey: input.nodeKey,
      status: 'OPEN',
      errorCode: input.errorCode ?? null,
      errorClass: input.errorClass ?? null,
      errorMessage: input.errorMessage ?? null,
      evidenceJson: input.evidenceJson ?? null,
    },
  });
}

export async function listDeadLetters(input?: {
  status?: WorkflowDeadLetterStatus;
  take?: number;
}): Promise<WorkflowDeadLetterRecord[]> {
  const take = Math.min(Math.max(input?.take ?? 100, 1), 500);
  const rows = await prisma().workflowDeadLetter.findMany({
    where: input?.status ? { status: input.status } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  });
  return rows.map(mapRecord);
}

export async function getDeadLetterById(id: number): Promise<WorkflowDeadLetterRecord | undefined> {
  const row = await prisma().workflowDeadLetter.findUnique({ where: { id: toId(id) } });
  return row ? mapRecord(row) : undefined;
}

export async function resolveDeadLetter(input: {
  deadLetterId: number;
  expectedStateVersion: number;
  resolution: 'RESOLVED' | 'DISCARDED';
  resolvedByUserId: number | null;
  resolutionNote?: string | null;
}): Promise<WorkflowDeadLetterRecord> {
  const updated = await prisma().workflowDeadLetter.updateMany({
    where: {
      id: toId(input.deadLetterId),
      stateVersion: input.expectedStateVersion,
      status: 'OPEN',
    },
    data: {
      status: input.resolution,
      resolvedByUserId: input.resolvedByUserId != null ? toId(input.resolvedByUserId) : null,
      resolvedAt: new Date(),
      resolutionNote: input.resolutionNote ?? null,
      stateVersion: { increment: 1 },
      updatedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    throw new WorkflowDomainError(
      'WF_EXEC_STALE_STATE_VERSION',
      'Dead letter is not OPEN at the expected version.',
      { deadLetterId: input.deadLetterId, expectedStateVersion: input.expectedStateVersion },
    );
  }
  const row = await getDeadLetterById(input.deadLetterId);
  if (!row) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Dead letter vanished after resolve.', { deadLetterId: input.deadLetterId });
  }
  return row;
}
