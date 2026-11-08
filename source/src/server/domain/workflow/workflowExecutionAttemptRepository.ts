import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowExecutionAttemptStatus, type WorkflowExecutionAttemptCommand, type WorkflowExecutionAttemptStatus } from './transitions';
import { allocateNextAttemptNumber } from './monotonicAllocation';
import type { WorkflowExecutionAttemptRecord } from './types';

const mapWorkflowExecutionAttemptRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  nodeInstanceId: bigint;
  attemptNumber: number;
  actionKey: string | null;
  actionVersion: string | null;
  logicalInvocationId: string;
  idempotencyKey: string;
  status: string;
  selectedProviderId: string | null;
  selectedProviderVersion: string | null;
  selectedProviderFingerprint: string | null;
  deadlineAt: Date | null;
  logicalInvocationWindowMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorClass: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultMetadataJson: string | null;
  stateVersion: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkflowExecutionAttemptRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  nodeInstanceId: fromId(row.nodeInstanceId),
  attemptNumber: row.attemptNumber,
  actionKey: row.actionKey,
  actionVersion: row.actionVersion,
  logicalInvocationId: row.logicalInvocationId,
  idempotencyKey: row.idempotencyKey,
  status: row.status as WorkflowExecutionAttemptStatus,
  selectedProviderId: row.selectedProviderId,
  selectedProviderVersion: row.selectedProviderVersion,
  selectedProviderFingerprint: row.selectedProviderFingerprint,
  deadlineAt: toIsoString(row.deadlineAt),
  logicalInvocationWindowMs: row.logicalInvocationWindowMs,
  startedAt: toIsoString(row.startedAt),
  completedAt: toIsoString(row.completedAt),
  errorClass: row.errorClass,
  errorCode: row.errorCode,
  errorMessage: row.errorMessage,
  resultMetadataJson: row.resultMetadataJson,
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

export type CreateStartedAttemptInput = {
  workflowInstanceId: number;
  nodeInstanceId: number;
  actionKey?: string;
  actionVersion?: string;
  logicalInvocationId: string;
  idempotencyKey: string;
  selectedProviderId?: string;
  selectedProviderVersion?: string;
  selectedProviderFingerprint?: string;
  deadlineAt?: Date;
  logicalInvocationWindowMs?: number;
};

/**
 * Allocates the next attempt number and creates one STARTED attempt (doc 03 section 25 — one
 * transaction allocates the attempt number, persists logical-invocation identity/provider, and
 * creates the STARTED row before external execution begins).
 */
export async function createStartedAttempt(input: CreateStartedAttemptInput): Promise<WorkflowExecutionAttemptRecord> {
  const attemptNumber = await allocateNextAttemptNumber(input.nodeInstanceId);
  const row = await prisma().workflowExecutionAttempt.create({
    data: {
      workflowInstanceId: toId(input.workflowInstanceId),
      nodeInstanceId: toId(input.nodeInstanceId),
      attemptNumber,
      actionKey: input.actionKey ?? null,
      actionVersion: input.actionVersion ?? null,
      logicalInvocationId: input.logicalInvocationId,
      idempotencyKey: input.idempotencyKey,
      status: 'STARTED',
      selectedProviderId: input.selectedProviderId ?? null,
      selectedProviderVersion: input.selectedProviderVersion ?? null,
      selectedProviderFingerprint: input.selectedProviderFingerprint ?? null,
      deadlineAt: input.deadlineAt ?? null,
      logicalInvocationWindowMs: input.logicalInvocationWindowMs ?? null,
      startedAt: new Date(),
    },
  });
  return mapWorkflowExecutionAttemptRecord(row);
}

export async function getAttemptById(id: number): Promise<WorkflowExecutionAttemptRecord | undefined> {
  const row = await prisma().workflowExecutionAttempt.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowExecutionAttemptRecord(row) : undefined;
}

/** Highest `attemptNumber` row for one node instance, or `undefined` before any attempt exists — used to decide logical-invocation identity reuse (doc 06 section 5). */
export async function getLatestAttemptForNode(nodeInstanceId: number): Promise<WorkflowExecutionAttemptRecord | undefined> {
  const row = await prisma().workflowExecutionAttempt.findFirst({
    where: { nodeInstanceId: toId(nodeInstanceId) },
    orderBy: { attemptNumber: 'desc' },
  });
  return row ? mapWorkflowExecutionAttemptRecord(row) : undefined;
}

/** All attempts for one node instance, oldest first — used by Inspect/operational commands. */
export async function listAttemptsForNode(nodeInstanceId: number): Promise<WorkflowExecutionAttemptRecord[]> {
  const rows = await prisma().workflowExecutionAttempt.findMany({
    where: { nodeInstanceId: toId(nodeInstanceId) },
    orderBy: { attemptNumber: 'asc' },
  });
  return rows.map(mapWorkflowExecutionAttemptRecord);
}

/** CAS terminal transition from STARTED (guard from transitions.ts) — all terminal attempt states are immutable. */
export async function transitionAttemptStatus(
  id: number,
  expectedStateVersion: number,
  command: WorkflowExecutionAttemptCommand,
  patch: { errorClass?: string; errorCode?: string; errorMessage?: string; resultMetadataJson?: string } = {},
): Promise<WorkflowExecutionAttemptRecord> {
  const existing = await getAttemptById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowExecutionAttempt not found.', { id });
  }
  if (existing.status !== 'STARTED') {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowExecutionAttempt is already terminal (immutable).', { id });
  }
  const nextStatus = nextWorkflowExecutionAttemptStatus('STARTED', command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', `Illegal attempt command ${command}.`, { id, command });
  }
  const result = await prisma().workflowExecutionAttempt.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion, status: 'STARTED' },
    data: {
      status: nextStatus,
      completedAt: new Date(),
      stateVersion: { increment: 1 },
      ...(patch.errorClass !== undefined ? { errorClass: patch.errorClass } : {}),
      ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.resultMetadataJson !== undefined ? { resultMetadataJson: patch.resultMetadataJson } : {}),
    },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowExecutionAttempt stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getAttemptById(id))!;
}
