import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import type { PrismaTransactionClient } from './prismaHelpers';
import { allocateNextTraceSequenceNumber, allocateNextTraceSequenceNumberInTx } from './monotonicAllocation';
import type { WorkflowTraceRecord, WorkflowActorType, WorkItemEscalationActorType } from './types';
import type { WorkflowTraceType } from './traceTypes';

const mapWorkflowTraceRecord = (row: {
  id: bigint;
  workflowInstanceId: bigint;
  nodeInstanceId: bigint | null;
  sequenceNumber: number;
  traceType: string;
  payloadSchemaVersion: number;
  occurredAt: Date | null;
  actorType: string;
  actorId: bigint | null;
  coreEvidenceJson: string;
  diagnosticPayloadJson: string | null;
  dataClassification: string;
}): WorkflowTraceRecord => ({
  id: fromId(row.id),
  workflowInstanceId: fromId(row.workflowInstanceId),
  nodeInstanceId: toNullableId(row.nodeInstanceId),
  sequenceNumber: row.sequenceNumber,
  traceType: row.traceType,
  payloadSchemaVersion: row.payloadSchemaVersion,
  occurredAt: toIsoString(row.occurredAt),
  actorType: row.actorType as WorkflowActorType,
  actorId: toNullableId(row.actorId),
  coreEvidenceJson: row.coreEvidenceJson,
  diagnosticPayloadJson: row.diagnosticPayloadJson,
  dataClassification: row.dataClassification,
});

export type AppendTraceInput = {
  workflowInstanceId: number;
  nodeInstanceId?: number;
  traceType: WorkflowTraceType;
  /** `WorkflowTrace.actorType` is a plain string column (doc 03 section 12) — widened beyond `WorkflowActorType` to also accept the escalation-only `SYSTEM_ESCALATION` literal (doc 03 section 17), matching `WorkItemEscalationRecord.actorType`'s own widening. */
  actorType: WorkflowActorType | WorkItemEscalationActorType;
  actorId?: number;
  coreEvidenceJson: string;
  diagnosticPayloadJson?: string;
  dataClassification?: string;
};

/** Append-only — allocates the sequence number via the CAS counter (doc 03 section 13 forbids deriving it from the maximum existing row). Emission call sites (constructing real payloads at each engine decision point) are a later delivery slice; this is the storage primitive. */
export async function appendTrace(input: AppendTraceInput): Promise<WorkflowTraceRecord> {
  const sequenceNumber = await allocateNextTraceSequenceNumber(input.workflowInstanceId);
  const row = await prisma().workflowTrace.create({
    data: {
      workflowInstanceId: toId(input.workflowInstanceId),
      nodeInstanceId: input.nodeInstanceId != null ? toId(input.nodeInstanceId) : null,
      sequenceNumber,
      traceType: input.traceType,
      actorType: input.actorType,
      actorId: input.actorId != null ? toId(input.actorId) : null,
      coreEvidenceJson: input.coreEvidenceJson,
      diagnosticPayloadJson: input.diagnosticPayloadJson ?? null,
      dataClassification: input.dataClassification ?? 'INTERNAL',
    },
  });
  return mapWorkflowTraceRecord(row);
}

/**
 * Slice 10 tx-aware sibling of `appendTrace` — doc 06 section 4 requires "node success/output,
 * required trace core evidence, downstream durable work and aggregate status" to commit atomically,
 * so real emission call sites (`engine/traceEmission.ts` and its callers) must write the trace row
 * through the same transaction client as the state mutation it documents, not through `appendTrace`'s
 * implicit `prisma()` call. Identical body otherwise.
 */
export async function appendTraceInTx(tx: PrismaTransactionClient, input: AppendTraceInput): Promise<WorkflowTraceRecord> {
  const sequenceNumber = await allocateNextTraceSequenceNumberInTx(tx, input.workflowInstanceId);
  const row = await tx.workflowTrace.create({
    data: {
      workflowInstanceId: toId(input.workflowInstanceId),
      nodeInstanceId: input.nodeInstanceId != null ? toId(input.nodeInstanceId) : null,
      sequenceNumber,
      traceType: input.traceType,
      actorType: input.actorType,
      actorId: input.actorId != null ? toId(input.actorId) : null,
      coreEvidenceJson: input.coreEvidenceJson,
      diagnosticPayloadJson: input.diagnosticPayloadJson ?? null,
      dataClassification: input.dataClassification ?? 'INTERNAL',
    },
  });
  return mapWorkflowTraceRecord(row);
}

/** Proof ordering is `sequenceNumber ASC` only — never timestamps (doc 03 section 29). */
export async function listTraceByInstance(workflowInstanceId: number): Promise<WorkflowTraceRecord[]> {
  const rows = await prisma().workflowTrace.findMany({
    where: { workflowInstanceId: toId(workflowInstanceId) },
    orderBy: { sequenceNumber: 'asc' },
  });
  return rows.map(mapWorkflowTraceRecord);
}
