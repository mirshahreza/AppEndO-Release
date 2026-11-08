import { randomUUID } from 'node:crypto';
import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import type { WorkflowDesignerViewRecord } from './types';
import { createWorkflowDesignerViewInputSchema } from './schemas';
import type { z } from 'zod';

export type CreateWorkflowDesignerViewInput = z.infer<typeof createWorkflowDesignerViewInputSchema>;

const REVISION_BOUND_SENTINEL_PREFIX = 'revision-bound:';
const DRAFT_BOUND_SENTINEL_PREFIX = 'draft-bound:';

const buildDraftIdentityKey = (workflowDefinitionId: number, draftVersion: number | null): string =>
  draftVersion != null ? `draft:${workflowDefinitionId}:${draftVersion}` : `${DRAFT_BOUND_SENTINEL_PREFIX}${randomUUID()}`;

const buildRevisionIdentityKey = (workflowRevisionId: number | null): string =>
  workflowRevisionId != null ? `revision:${workflowRevisionId}` : `${REVISION_BOUND_SENTINEL_PREFIX}${randomUUID()}`;

const mapWorkflowDesignerViewRecord = (row: {
  id: bigint;
  workflowDefinitionId: bigint;
  workflowRevisionId: bigint | null;
  draftVersion: number | null;
  viewSchemaVersion: number;
  viewJson: string;
  updatedBy: bigint | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkflowDesignerViewRecord => ({
  id: fromId(row.id),
  workflowDefinitionId: fromId(row.workflowDefinitionId),
  workflowRevisionId: toNullableId(row.workflowRevisionId),
  draftVersion: row.draftVersion,
  viewSchemaVersion: row.viewSchemaVersion,
  viewJson: row.viewJson,
  updatedBy: toNullableId(row.updatedBy),
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

const assertXor = (input: CreateWorkflowDesignerViewInput): void => {
  if ((input.workflowRevisionId != null) === (input.draftVersion != null)) {
    throw new WorkflowDomainError(
      'WF_DEF_INVALID_REFERENCE',
      'Exactly one of workflowRevisionId or draftVersion must be supplied (XOR).',
      input,
    );
  }
};

/** Draft view identity is `(workflowDefinitionId, draftVersion)` with `workflowRevisionId = null`; upserts the single draft-bound row for that key. */
export async function upsertDraftView(input: CreateWorkflowDesignerViewInput & { draftVersion: number }): Promise<WorkflowDesignerViewRecord> {
  assertXor(input);
  const draftIdentityKey = buildDraftIdentityKey(input.workflowDefinitionId, input.draftVersion);
  const row = await prisma().workflowDesignerView.upsert({
    where: { draftIdentityKey },
    create: {
      workflowDefinitionId: toId(input.workflowDefinitionId),
      draftVersion: input.draftVersion,
      viewSchemaVersion: input.viewSchemaVersion,
      viewJson: input.viewJson,
      updatedBy: input.updatedBy != null ? toId(input.updatedBy) : null,
      draftIdentityKey,
      revisionIdentityKey: buildRevisionIdentityKey(null),
    },
    update: {
      viewJson: input.viewJson,
      viewSchemaVersion: input.viewSchemaVersion,
      updatedBy: input.updatedBy != null ? toId(input.updatedBy) : null,
    },
  });
  return mapWorkflowDesignerViewRecord(row);
}

/** Published-view snapshot bound to exactly one `workflowRevisionId` — read-only after creation, no draft mutation authority. */
export async function createRevisionSnapshotView(
  input: CreateWorkflowDesignerViewInput & { workflowRevisionId: number },
): Promise<WorkflowDesignerViewRecord> {
  assertXor(input);
  const row = await prisma().workflowDesignerView.create({
    data: {
      workflowDefinitionId: toId(input.workflowDefinitionId),
      workflowRevisionId: toId(input.workflowRevisionId),
      viewSchemaVersion: input.viewSchemaVersion,
      viewJson: input.viewJson,
      updatedBy: input.updatedBy != null ? toId(input.updatedBy) : null,
      draftIdentityKey: buildDraftIdentityKey(input.workflowDefinitionId, null),
      revisionIdentityKey: buildRevisionIdentityKey(input.workflowRevisionId),
    },
  });
  return mapWorkflowDesignerViewRecord(row);
}

export async function getViewByDraftIdentity(workflowDefinitionId: number, draftVersion: number): Promise<WorkflowDesignerViewRecord | undefined> {
  const row = await prisma().workflowDesignerView.findUnique({
    where: { draftIdentityKey: buildDraftIdentityKey(workflowDefinitionId, draftVersion) },
  });
  return row ? mapWorkflowDesignerViewRecord(row) : undefined;
}

export async function getViewByRevisionIdentity(workflowRevisionId: number): Promise<WorkflowDesignerViewRecord | undefined> {
  const row = await prisma().workflowDesignerView.findUnique({
    where: { revisionIdentityKey: buildRevisionIdentityKey(workflowRevisionId) },
  });
  return row ? mapWorkflowDesignerViewRecord(row) : undefined;
}
