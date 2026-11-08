import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowDefinitionLifecycle, type WorkflowDefinitionLifecycle, type WorkflowDefinitionLifecycleCommand } from './transitions';
import type { WorkflowDefinitionRecord, WorkflowCreationMode } from './types';
import { createWorkflowDefinitionInputSchema } from './schemas';
import type { z } from 'zod';
import { applyDraftOperations, type DraftOperationApplyResult } from './awm/draftOperationApplier';
import type { WorkflowDraftOperation } from './awm/draftOperations';
import type { WorkflowModel } from './awm/types';

export type CreateWorkflowDefinitionInput = z.infer<typeof createWorkflowDefinitionInputSchema>;

const mapWorkflowDefinitionRecord = (row: {
  id: bigint;
  scopeKey: string;
  key: string;
  lifecycleStatus: string;
  draftDefinitionJson: string;
  draftVersion: number;
  currentPublishedRevisionId: bigint | null;
  nextRevisionNumber: number;
  createdFromDefinitionId: bigint | null;
  createdFromRevisionId: bigint | null;
  creationMode: string;
  stateVersion: number;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
  lastPublishedAt: Date | null;
  lastPublishedBy: bigint | null;
  lastUnpublishedAt: Date | null;
  lastUnpublishedBy: bigint | null;
}): WorkflowDefinitionRecord => ({
  id: fromId(row.id),
  scopeKey: row.scopeKey,
  key: row.key,
  lifecycleStatus: row.lifecycleStatus as WorkflowDefinitionLifecycle,
  draftDefinitionJson: row.draftDefinitionJson,
  draftVersion: row.draftVersion,
  currentPublishedRevisionId: toNullableId(row.currentPublishedRevisionId),
  nextRevisionNumber: row.nextRevisionNumber,
  createdFromDefinitionId: toNullableId(row.createdFromDefinitionId),
  createdFromRevisionId: toNullableId(row.createdFromRevisionId),
  creationMode: row.creationMode as WorkflowCreationMode,
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  createdBy: toNullableId(row.createdBy),
  updatedAt: toIsoString(row.updatedAt),
  updatedBy: toNullableId(row.updatedBy),
  lastPublishedAt: toIsoString(row.lastPublishedAt),
  lastPublishedBy: toNullableId(row.lastPublishedBy),
  lastUnpublishedAt: toIsoString(row.lastUnpublishedAt),
  lastUnpublishedBy: toNullableId(row.lastUnpublishedBy),
});

export async function createWorkflowDefinition(input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinitionRecord> {
  const parsed = createWorkflowDefinitionInputSchema.parse(input);
  const row = await prisma().workflowDefinition.create({
    data: {
      scopeKey: parsed.scopeKey,
      key: parsed.key,
      lifecycleStatus: 'DRAFT',
      draftDefinitionJson: parsed.draftDefinitionJson,
      draftVersion: 1,
      creationMode: parsed.creationMode,
      createdFromDefinitionId: parsed.createdFromDefinitionId != null ? toId(parsed.createdFromDefinitionId) : null,
      createdFromRevisionId: parsed.createdFromRevisionId != null ? toId(parsed.createdFromRevisionId) : null,
      createdBy: parsed.createdBy != null ? toId(parsed.createdBy) : null,
      updatedBy: parsed.createdBy != null ? toId(parsed.createdBy) : null,
    },
  });
  return mapWorkflowDefinitionRecord(row);
}

export async function getWorkflowDefinitionById(id: number): Promise<WorkflowDefinitionRecord | undefined> {
  const row = await prisma().workflowDefinition.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowDefinitionRecord(row) : undefined;
}

export async function findWorkflowDefinitionByScopeAndKey(
  scopeKey: string,
  key: string,
): Promise<WorkflowDefinitionRecord | undefined> {
  const row = await prisma().workflowDefinition.findUnique({
    where: { scopeKey_key: { scopeKey, key } },
  });
  return row ? mapWorkflowDefinitionRecord(row) : undefined;
}

/** Designer definition-list surface (doc 08 section 1: "Navigation presents definitions..."). Newest first, optionally scoped. Not a paginated/filterable query authority — a thin list for the authoring picker. */
export async function listWorkflowDefinitions(scopeKey?: string): Promise<WorkflowDefinitionRecord[]> {
  const rows = await prisma().workflowDefinition.findMany({
    where: scopeKey ? { scopeKey } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return rows.map(mapWorkflowDefinitionRecord);
}

/** CAS draft mutation — throws `WF_DEF_STALE_DRAFT_VERSION` when `expectedDraftVersion` has moved on. */
export async function updateWorkflowDefinitionDraft(
  id: number,
  expectedDraftVersion: number,
  patch: { draftDefinitionJson: string },
): Promise<WorkflowDefinitionRecord> {
  const result = await prisma().workflowDefinition.updateMany({
    where: { id: toId(id), draftVersion: expectedDraftVersion },
    data: { draftDefinitionJson: patch.draftDefinitionJson, draftVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition draftVersion is stale.', { id, expectedDraftVersion });
  }
  return (await getWorkflowDefinitionById(id))!;
}

/**
 * `ApplyDraftOperations(expectedDraftVersion)` (doc 02 section 13) — parses the current
 * `draftDefinitionJson` as canonical AWM, runs the pure atomic applier (doc 02 section 12), and
 * persists the resulting normalized candidate under the same CAS fence as
 * `updateWorkflowDefinitionDraft`. On any applier failure, nothing is persisted (the applier
 * itself never mutates the current row; the CAS write only happens after it returns
 * successfully) — this is what "no partial candidate authority" means at the repository
 * boundary. `WF_DEF_STALE_DRAFT_VERSION` in this repository always means the *outer* CAS race;
 * a stale/invalid *operation* payload throws the applier's own doc 03 section 14/30 code first.
 */
export async function applyDraftOperationsToDefinition(
  id: number,
  expectedDraftVersion: number,
  operations: readonly WorkflowDraftOperation[],
): Promise<{ record: WorkflowDefinitionRecord } & DraftOperationApplyResult> {
  const existing = await getWorkflowDefinitionById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition not found.', { id });
  }
  if (existing.draftVersion !== expectedDraftVersion) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition draftVersion is stale.', { id, expectedDraftVersion });
  }

  const currentDraft = JSON.parse(existing.draftDefinitionJson) as WorkflowModel;
  const applyResult = applyDraftOperations(currentDraft, operations);

  const record = await updateWorkflowDefinitionDraft(id, expectedDraftVersion, {
    draftDefinitionJson: JSON.stringify(applyResult.candidate),
  });

  return { record, ...applyResult };
}

/** CAS lifecycle transition — guard from transitions.ts; throws `WF_DEF_NOT_STARTABLE` on illegal command, `WF_EXEC_STALE_STATE_VERSION` on version race. */
export async function transitionWorkflowDefinitionLifecycle(
  id: number,
  expectedStateVersion: number,
  command: WorkflowDefinitionLifecycleCommand,
): Promise<WorkflowDefinitionRecord> {
  const existing = await getWorkflowDefinitionById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { id });
  }
  const nextStatus = nextWorkflowDefinitionLifecycle(existing.lifecycleStatus, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', `Illegal lifecycle command ${command} from ${existing.lifecycleStatus}.`, { id, command });
  }
  const result = await prisma().workflowDefinition.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    data: { lifecycleStatus: nextStatus, stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getWorkflowDefinitionById(id))!;
}

/** CAS pointer update used by revision-publication orchestration (later slice) to repoint the current published revision atomically alongside a lifecycle transition. Exposed here because it is a WorkflowDefinition-owned mutation. */
export async function setCurrentPublishedRevision(
  id: number,
  expectedStateVersion: number,
  currentPublishedRevisionId: number,
): Promise<WorkflowDefinitionRecord> {
  const result = await prisma().workflowDefinition.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    data: { currentPublishedRevisionId: toId(currentPublishedRevisionId), stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getWorkflowDefinitionById(id))!;
}

/** CAS unpublish — clears the published revision pointer and transitions lifecycle to DRAFT when legal. */
export async function unpublishWorkflowDefinitionAtomically(
  id: number,
  expectedStateVersion: number,
  unpublishedBy: number | null = null,
): Promise<WorkflowDefinitionRecord> {
  const existing = await getWorkflowDefinitionById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { id });
  }
  if (existing.currentPublishedRevisionId === null) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Workflow is not published.', { id });
  }
  const nextStatus = nextWorkflowDefinitionLifecycle(existing.lifecycleStatus, 'UNPUBLISH');
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', `Cannot unpublish from ${existing.lifecycleStatus}.`, { id });
  }
  const result = await prisma().workflowDefinition.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion, currentPublishedRevisionId: { not: null } },
    data: {
      currentPublishedRevisionId: null,
      lifecycleStatus: nextStatus,
      stateVersion: { increment: 1 },
      lastUnpublishedAt: new Date(),
      lastUnpublishedBy: unpublishedBy != null ? toId(unpublishedBy) : null,
    },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getWorkflowDefinitionById(id))!;
}
