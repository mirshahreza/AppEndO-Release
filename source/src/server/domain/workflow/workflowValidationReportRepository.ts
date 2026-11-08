import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import type { WorkflowValidationReportRecord, WorkflowValidationStatus } from './types';

const mapWorkflowValidationReportRecord = (row: {
  id: bigint;
  workflowDefinitionId: bigint;
  revisionId: bigint | null;
  draftVersion: number;
  status: string;
  validatorVersion: string;
  issuesJson: string;
  coverageSummaryJson: string | null;
  createdAt: Date | null;
}): WorkflowValidationReportRecord => ({
  id: fromId(row.id),
  workflowDefinitionId: fromId(row.workflowDefinitionId),
  revisionId: toNullableId(row.revisionId),
  draftVersion: row.draftVersion,
  status: row.status as WorkflowValidationStatus,
  validatorVersion: row.validatorVersion,
  issuesJson: row.issuesJson,
  coverageSummaryJson: row.coverageSummaryJson,
  createdAt: toIsoString(row.createdAt),
});

export type CreateValidationReportInput = {
  workflowDefinitionId: number;
  revisionId?: number;
  draftVersion: number;
  status: WorkflowValidationStatus;
  validatorVersion: string;
  issuesJson: string;
  coverageSummaryJson?: string;
};

/**
 * Immutable by construction — this module intentionally exposes no update/patch function.
 * `architecture.test.ts`/a reflection test asserts that absence directly (doc 03 section 16).
 */
export async function createValidationReport(input: CreateValidationReportInput): Promise<WorkflowValidationReportRecord> {
  const row = await prisma().workflowValidationReport.create({
    data: {
      workflowDefinitionId: toId(input.workflowDefinitionId),
      revisionId: input.revisionId != null ? toId(input.revisionId) : null,
      draftVersion: input.draftVersion,
      status: input.status,
      validatorVersion: input.validatorVersion,
      issuesJson: input.issuesJson,
      coverageSummaryJson: input.coverageSummaryJson ?? null,
    },
  });
  return mapWorkflowValidationReportRecord(row);
}

export async function getValidationReportById(id: number): Promise<WorkflowValidationReportRecord | undefined> {
  const row = await prisma().workflowValidationReport.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowValidationReportRecord(row) : undefined;
}

export async function findValidationReportsByDefinitionDraftVersion(
  workflowDefinitionId: number,
  draftVersion: number,
): Promise<WorkflowValidationReportRecord[]> {
  const rows = await prisma().workflowValidationReport.findMany({
    where: { workflowDefinitionId: toId(workflowDefinitionId), draftVersion },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapWorkflowValidationReportRecord);
}

export async function findValidationReportsByRevisionId(revisionId: number): Promise<WorkflowValidationReportRecord[]> {
  const rows = await prisma().workflowValidationReport.findMany({
    where: { revisionId: toId(revisionId) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapWorkflowValidationReportRecord);
}
