import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowSimulationRunStatus, type WorkflowSimulationRunCommand, type WorkflowSimulationRunStatus } from './transitions';
import type { WorkflowSimulationRunRecord, WorkflowActorType, WorkflowSimulationMode } from './types';
import { createWorkflowSimulationRunInputSchema } from './schemas';
import type { z } from 'zod';

export type CreateWorkflowSimulationRunInput = z.infer<typeof createWorkflowSimulationRunInputSchema>;

const mapWorkflowSimulationRunRecord = (row: {
  id: bigint;
  workflowDefinitionId: bigint;
  sourceDraftVersion: number | null;
  sourceRevisionId: bigint | null;
  simulationResolvedSnapshotFingerprint: string;
  mode: string;
  startNodeKey: string | null;
  scenarioKey: string | null;
  fixtureSetFingerprint: string;
  status: string;
  resultSummaryJson: string | null;
  createdByType: string;
  createdById: bigint | null;
  createdAt: Date | null;
  completedAt: Date | null;
  stateVersion: number;
}): WorkflowSimulationRunRecord => ({
  id: fromId(row.id),
  workflowDefinitionId: fromId(row.workflowDefinitionId),
  sourceDraftVersion: row.sourceDraftVersion,
  sourceRevisionId: toNullableId(row.sourceRevisionId),
  simulationResolvedSnapshotFingerprint: row.simulationResolvedSnapshotFingerprint,
  mode: row.mode as WorkflowSimulationMode,
  startNodeKey: row.startNodeKey,
  scenarioKey: row.scenarioKey,
  fixtureSetFingerprint: row.fixtureSetFingerprint,
  status: row.status as WorkflowSimulationRunStatus,
  resultSummaryJson: row.resultSummaryJson,
  createdByType: row.createdByType as WorkflowActorType,
  createdById: toNullableId(row.createdById),
  createdAt: toIsoString(row.createdAt),
  completedAt: toIsoString(row.completedAt),
  stateVersion: row.stateVersion,
});

/**
 * Creation always lands in RUNNING (doc 03 section 9). The XOR of `sourceDraftVersion` /
 * `sourceRevisionId` is rejected here, before any Prisma call — Slice 1 plan D5 (no portable
 * cross-provider CHECK constraint in this schema).
 */
export async function createSimulationRun(input: CreateWorkflowSimulationRunInput): Promise<WorkflowSimulationRunRecord> {
  const parsed = createWorkflowSimulationRunInputSchema.parse(input);
  if ((parsed.sourceDraftVersion != null) === (parsed.sourceRevisionId != null)) {
    throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'Exactly one of sourceDraftVersion or sourceRevisionId is required.', input);
  }
  const row = await prisma().workflowSimulationRun.create({
    data: {
      workflowDefinitionId: toId(parsed.workflowDefinitionId),
      sourceDraftVersion: parsed.sourceDraftVersion ?? null,
      sourceRevisionId: parsed.sourceRevisionId != null ? toId(parsed.sourceRevisionId) : null,
      simulationResolvedSnapshotFingerprint: parsed.simulationResolvedSnapshotFingerprint,
      mode: parsed.mode,
      startNodeKey: parsed.startNodeKey ?? null,
      scenarioKey: parsed.scenarioKey ?? null,
      fixtureSetFingerprint: parsed.fixtureSetFingerprint,
      status: 'RUNNING',
      createdByType: parsed.createdByType,
      createdById: parsed.createdById != null ? toId(parsed.createdById) : null,
    },
  });
  return mapWorkflowSimulationRunRecord(row);
}

export async function getSimulationRunById(id: number): Promise<WorkflowSimulationRunRecord | undefined> {
  const row = await prisma().workflowSimulationRun.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowSimulationRunRecord(row) : undefined;
}

/** Exactly one expected-version terminal transition `RUNNING -> SUCCEEDED|FAILED`; terminal rows are immutable. */
export async function transitionSimulationRunTerminal(
  id: number,
  expectedStateVersion: number,
  command: WorkflowSimulationRunCommand,
  resultSummaryJson?: string,
): Promise<WorkflowSimulationRunRecord> {
  const existing = await getSimulationRunById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'WorkflowSimulationRun not found.', { id });
  }
  const nextStatus = nextWorkflowSimulationRunStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'WorkflowSimulationRun is already terminal (immutable).', { id, command });
  }
  const result = await prisma().workflowSimulationRun.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion, status: 'RUNNING' },
    data: { status: nextStatus, completedAt: new Date(), resultSummaryJson: resultSummaryJson ?? null, stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'WorkflowSimulationRun stateVersion is stale or already terminal.', { id, expectedStateVersion });
  }
  return (await getSimulationRunById(id))!;
}
