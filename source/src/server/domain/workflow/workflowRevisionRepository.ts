import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import {
  nextPublicationBindingState,
  type PublicationBindingCommand,
  type PublicationStatus,
  type BindingStatus,
} from './transitions';
import { allocateNextRevisionNumber } from './monotonicAllocation';
import type { WorkflowRevisionRecord } from './types';
import { createWorkflowRevisionInputSchema } from './schemas';
import type { z } from 'zod';

export type CreateWorkflowRevisionInput = z.infer<typeof createWorkflowRevisionInputSchema>;

const mapWorkflowRevisionRecord = (row: {
  id: bigint;
  workflowDefinitionId: bigint;
  revisionNumber: number;
  sourceDraftVersion: number;
  definitionJson: string;
  actionBindingsJson: string;
  schemaProjectionsJson: string | null;
  semanticFingerprint: string;
  publicationStatus: string;
  bindingStatus: string;
  validationReportId: bigint | null;
  stateVersion: number;
  publishedAt: Date | null;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
}): WorkflowRevisionRecord => ({
  id: fromId(row.id),
  workflowDefinitionId: fromId(row.workflowDefinitionId),
  revisionNumber: row.revisionNumber,
  sourceDraftVersion: row.sourceDraftVersion,
  definitionJson: row.definitionJson,
  actionBindingsJson: row.actionBindingsJson,
  schemaProjectionsJson: row.schemaProjectionsJson,
  semanticFingerprint: row.semanticFingerprint,
  publicationStatus: row.publicationStatus as PublicationStatus,
  bindingStatus: row.bindingStatus as BindingStatus,
  validationReportId: toNullableId(row.validationReportId),
  stateVersion: row.stateVersion,
  publishedAt: toIsoString(row.publishedAt),
  createdAt: toIsoString(row.createdAt),
  createdBy: toNullableId(row.createdBy),
  updatedAt: toIsoString(row.updatedAt),
  updatedBy: toNullableId(row.updatedBy),
});

/** Allocates the next revision number and creates one immutable VALIDATING candidate (doc 03 section 28). */
export async function createCandidateWorkflowRevision(input: CreateWorkflowRevisionInput): Promise<WorkflowRevisionRecord> {
  const parsed = createWorkflowRevisionInputSchema.parse(input);
  const revisionNumber = await allocateNextRevisionNumber(parsed.workflowDefinitionId);
  const row = await prisma().workflowRevision.create({
    data: {
      workflowDefinitionId: toId(parsed.workflowDefinitionId),
      revisionNumber,
      sourceDraftVersion: parsed.sourceDraftVersion,
      definitionJson: parsed.definitionJson,
      actionBindingsJson: parsed.actionBindingsJson,
      schemaProjectionsJson: parsed.schemaProjectionsJson ?? null,
      semanticFingerprint: parsed.semanticFingerprint,
      publicationStatus: 'VALIDATING',
      bindingStatus: parsed.bindingStatus,
      createdBy: parsed.createdBy != null ? toId(parsed.createdBy) : null,
      updatedBy: parsed.createdBy != null ? toId(parsed.createdBy) : null,
    },
  });
  return mapWorkflowRevisionRecord(row);
}

export async function getWorkflowRevisionById(id: number): Promise<WorkflowRevisionRecord | undefined> {
  const row = await prisma().workflowRevision.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowRevisionRecord(row) : undefined;
}

export async function listWorkflowRevisionsByDefinition(workflowDefinitionId: number): Promise<WorkflowRevisionRecord[]> {
  const rows = await prisma().workflowRevision.findMany({
    where: { workflowDefinitionId: toId(workflowDefinitionId) },
    orderBy: { revisionNumber: 'desc' },
  });
  return rows.map(mapWorkflowRevisionRecord);
}

export async function countWorkflowRevisionsByDefinition(workflowDefinitionId: number): Promise<number> {
  return prisma().workflowRevision.count({
    where: { workflowDefinitionId: toId(workflowDefinitionId) },
  });
}

/** Dossier / list UIs — omit AWM JSON blobs; load detail via getWorkflowRevisionById. */
export async function listWorkflowRevisionSummariesByDefinition(
  workflowDefinitionId: number,
): Promise<WorkflowRevisionRecord[]> {
  const rows = await prisma().workflowRevision.findMany({
    where: { workflowDefinitionId: toId(workflowDefinitionId) },
    orderBy: { revisionNumber: 'desc' },
    select: {
      id: true,
      workflowDefinitionId: true,
      revisionNumber: true,
      sourceDraftVersion: true,
      semanticFingerprint: true,
      publicationStatus: true,
      bindingStatus: true,
      validationReportId: true,
      stateVersion: true,
      publishedAt: true,
      createdAt: true,
      createdBy: true,
      updatedAt: true,
      updatedBy: true,
    },
  });
  return rows.map((row) =>
    mapWorkflowRevisionRecord({
      ...row,
      definitionJson: '{}',
      actionBindingsJson: '[]',
      schemaProjectionsJson: null,
    }),
  );
}

/**
 * Package removal impact analysis source query (Slice 12, doc 09 section 9) — every `PUBLISHED`
 * revision, bounded. `actionBindingsJson` is portable `TEXT` (doc 03 section 3), not an indexable
 * JSON column across the Postgres/MSSQL/MySQL/SQLite targets this schema supports, so "does this
 * revision reference Action X" is a broad-read-then-filter-in-app-code scan — the same shape
 * `workItemInboxService.ts`/`dueTimerScannerService.ts`/`recoveryService.ts` already use for
 * non-indexable business predicates, not a new pattern.
 */
export async function listPublishedRevisionsForActionImpactScan(limit = 5000): Promise<WorkflowRevisionRecord[]> {
  const rows = await prisma().workflowRevision.findMany({
    where: { publicationStatus: 'PUBLISHED' },
    take: limit,
    orderBy: { id: 'asc' },
  });
  return rows.map(mapWorkflowRevisionRecord);
}

/**
 * Attaches the validation report produced for this exact candidate (doc 03 section 28: "binds
 * validation evidence to that candidate"). Not CAS-fenced: called exactly once, immediately after
 * `createCandidateWorkflowRevision`, by the same publication operation that created the row —
 * there is no concurrent-writer window for this field between creation and attachment.
 */
export async function attachValidationReportToRevision(revisionId: number, validationReportId: number): Promise<WorkflowRevisionRecord> {
  await prisma().workflowRevision.update({
    where: { id: toId(revisionId) },
    data: { validationReportId: toId(validationReportId) },
  });
  return (await getWorkflowRevisionById(revisionId))!;
}

export async function findWorkflowRevisionByDefinitionAndNumber(
  workflowDefinitionId: number,
  revisionNumber: number,
): Promise<WorkflowRevisionRecord | undefined> {
  const row = await prisma().workflowRevision.findUnique({
    where: { workflowDefinitionId_revisionNumber: { workflowDefinitionId: toId(workflowDefinitionId), revisionNumber } },
  });
  return row ? mapWorkflowRevisionRecord(row) : undefined;
}

/**
 * CAS publication/binding transition — guard from transitions.ts; throws
 * `WF_DEF_STALE_REVISION_VERSION` on illegal command or version race.
 */
export async function transitionPublicationBindingState(
  id: number,
  expectedStateVersion: number,
  command: PublicationBindingCommand,
): Promise<WorkflowRevisionRecord> {
  const existing = await getWorkflowRevisionById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', 'WorkflowRevision not found.', { id });
  }
  const next = nextPublicationBindingState(
    { publicationStatus: existing.publicationStatus, bindingStatus: existing.bindingStatus },
    command,
  );
  if (!next) {
    throw new WorkflowDomainError(
      'WF_DEF_STALE_REVISION_VERSION',
      `Illegal publication/binding command ${command} from ${existing.publicationStatus}/${existing.bindingStatus}.`,
      { id, command },
    );
  }
  const result = await prisma().workflowRevision.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    data: {
      publicationStatus: next.publicationStatus,
      bindingStatus: next.bindingStatus,
      stateVersion: { increment: 1 },
      publishedAt: next.publicationStatus === 'PUBLISHED' && existing.publicationStatus !== 'PUBLISHED' ? new Date() : undefined,
    },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', 'WorkflowRevision stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getWorkflowRevisionById(id))!;
}

/**
 * Atomically commits: revision publication/binding transition to PUBLISHED, the definition's
 * `currentPublishedRevisionId` pointer, and the definition lifecycle transition — one
 * transaction, per doc 03 section 10 ("Transition to PUBLISHED, the applicable WorkflowDefinition
 * lifecycle transition and update of currentPublishedRevisionId are one transaction"). A stale
 * expected version on either aggregate aborts the whole transaction.
 */
export async function activateWorkflowRevisionPublicationAtomically(input: {
  revisionId: number;
  expectedRevisionStateVersion: number;
  workflowDefinitionId: number;
  expectedDefinitionStateVersion: number;
  definitionLifecycle: { from: 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED'; command: 'FIRST_REVISION_PUBLISHED' } | null;
  publishedBy?: number | null;
}): Promise<{ revision: WorkflowRevisionRecord }> {
  return prisma().$transaction(async (tx) => {
    const revisionUpdate = await tx.workflowRevision.updateMany({
      where: { id: toId(input.revisionId), stateVersion: input.expectedRevisionStateVersion, publicationStatus: 'ACTIVATING_BINDING' },
      data: { publicationStatus: 'PUBLISHED', bindingStatus: 'ACTIVE', stateVersion: { increment: 1 }, publishedAt: new Date() },
    });
    if (revisionUpdate.count === 0) {
      throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', 'WorkflowRevision activation precondition failed.', input);
    }

    const definitionData: {
      currentPublishedRevisionId: bigint;
      stateVersion: { increment: number };
      lifecycleStatus?: string;
      lastPublishedAt: Date;
      lastPublishedBy: bigint | null;
    } = {
      currentPublishedRevisionId: toId(input.revisionId),
      stateVersion: { increment: 1 },
      lastPublishedAt: new Date(),
      lastPublishedBy: input.publishedBy != null ? toId(input.publishedBy) : null,
    };
    if (input.definitionLifecycle) {
      definitionData.lifecycleStatus = 'ACTIVE';
    }
    const definitionUpdate = await tx.workflowDefinition.updateMany({
      where: { id: toId(input.workflowDefinitionId), stateVersion: input.expectedDefinitionStateVersion },
      data: definitionData,
    });
    if (definitionUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition activation precondition failed.', input);
    }

    const row = await tx.workflowRevision.findUniqueOrThrow({ where: { id: toId(input.revisionId) } });
    return { revision: mapWorkflowRevisionRecord(row) };
  });
}

/**
 * MANUAL_API counterpart to `activateWorkflowRevisionPublicationAtomically` — same atomic
 * revision+definition-pointer+lifecycle commit (doc 03 section 10), but for the direct
 * `VALIDATING+NOT_REQUIRED -> PUBLISHED+NOT_REQUIRED` row (`PUBLISH_MANUAL_API`) instead of the
 * `ACTIVATING_BINDING+PENDING -> PUBLISHED+ACTIVE` row. Kept as a separate function rather than a
 * parameterized precondition to avoid touching the already-tested activation path's signature.
 */
export async function publishManualApiRevisionAtomically(input: {
  revisionId: number;
  expectedRevisionStateVersion: number;
  workflowDefinitionId: number;
  expectedDefinitionStateVersion: number;
  definitionLifecycle: { from: 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED'; command: 'FIRST_REVISION_PUBLISHED' } | null;
  publishedBy?: number | null;
}): Promise<{ revision: WorkflowRevisionRecord }> {
  return prisma().$transaction(async (tx) => {
    const revisionUpdate = await tx.workflowRevision.updateMany({
      where: { id: toId(input.revisionId), stateVersion: input.expectedRevisionStateVersion, publicationStatus: 'VALIDATING', bindingStatus: 'NOT_REQUIRED' },
      data: { publicationStatus: 'PUBLISHED', bindingStatus: 'NOT_REQUIRED', stateVersion: { increment: 1 }, publishedAt: new Date() },
    });
    if (revisionUpdate.count === 0) {
      throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', 'WorkflowRevision MANUAL_API publication precondition failed.', input);
    }

    const definitionData: {
      currentPublishedRevisionId: bigint;
      stateVersion: { increment: number };
      lifecycleStatus?: string;
      lastPublishedAt: Date;
      lastPublishedBy: bigint | null;
    } = {
      currentPublishedRevisionId: toId(input.revisionId),
      stateVersion: { increment: 1 },
      lastPublishedAt: new Date(),
      lastPublishedBy: input.publishedBy != null ? toId(input.publishedBy) : null,
    };
    if (input.definitionLifecycle) {
      definitionData.lifecycleStatus = 'ACTIVE';
    }
    const definitionUpdate = await tx.workflowDefinition.updateMany({
      where: { id: toId(input.workflowDefinitionId), stateVersion: input.expectedDefinitionStateVersion },
      data: definitionData,
    });
    if (definitionUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition activation precondition failed.', input);
    }

    const row = await tx.workflowRevision.findUniqueOrThrow({ where: { id: toId(input.revisionId) } });
    return { revision: mapWorkflowRevisionRecord(row) };
  });
}
