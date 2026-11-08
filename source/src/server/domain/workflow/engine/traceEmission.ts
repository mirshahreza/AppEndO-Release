import { fromId, toId } from '../prismaHelpers';
import { appendTraceInTx } from '../workflowTraceRepository';
import type { WorkflowTraceType, WorkflowTracePayloadMapV1 } from '../traceTypes';
import type { WorkflowActorType, WorkItemEscalationActorType } from '../types';
import type { Tx } from './txTypes';

/**
 * Slice 10 — real `WorkflowTrace` emission. `traceTypes.ts` (Slice 1) is sole authority for the
 * closed `WorkflowTraceType` set and each type's mandatory payload shape
 * (`WorkflowTracePayloadMapV1`); this module is the only place that actually writes rows, so every
 * engine call site goes through `emitTrace`/`emitTraceAutoRevision` rather than hand-building
 * `appendTraceInTx` calls — this keeps "storage, emitters, Proof projections and consumers MUST NOT
 * maintain independent trace-type or payload-shape registries" (doc 03 section 12) true by
 * construction: the payload argument's type is checked against `WorkflowTracePayloadMapV1[T]`.
 *
 * Every registered V1 payload type below *is* the required core evidence (doc 03 section 12: "core
 * causal evidence cannot exist only in diagnostics") — there is no optional-diagnostic subset mixed
 * into `WorkflowTracePayloadMapV1` itself, so the whole payload is written to `coreEvidenceJson` and
 * `diagnosticPayloadJson` is left null for every V1 emission. A future payload version that adds
 * genuinely optional/redactable diagnostic fields would extend `AppendTraceInput`'s
 * `diagnosticPayloadJson` usage from a call site that has such data — no V1 call site does.
 */

export type EmitTraceInput<T extends WorkflowTraceType> = {
  workflowInstanceId: number;
  traceType: T;
  payload: WorkflowTracePayloadMapV1[T];
  nodeInstanceId?: number;
  actorType: WorkflowActorType | WorkItemEscalationActorType;
  actorId?: number;
  dataClassification?: string;
  /** Genuinely optional, non-causal supplementary detail (doc 03 section 12: "core causal evidence cannot exist only in diagnostics") — e.g. `SUBFLOW_COMPLETED`'s child-instance-status classification, which the closed V1 payload map reserves no core-evidence slot for and whose causal fact (the child's own terminal status) is already durably recorded on the child's own trace stream. */
  diagnosticPayloadJson?: string;
};

export async function emitTrace<T extends WorkflowTraceType>(tx: Tx, input: EmitTraceInput<T>): Promise<void> {
  await appendTraceInTx(tx, {
    workflowInstanceId: input.workflowInstanceId,
    nodeInstanceId: input.nodeInstanceId,
    traceType: input.traceType,
    actorType: input.actorType,
    actorId: input.actorId,
    coreEvidenceJson: JSON.stringify(input.payload),
    dataClassification: input.dataClassification,
    diagnosticPayloadJson: input.diagnosticPayloadJson,
  });
}

/**
 * `workflowRevisionId` (doc 03 section 29's mandatory base field on every V1 payload) lives only on
 * `WorkflowInstance`, not on any child row — deliberately not threaded as an extra parameter through
 * every one of the ~20 existing `apply*Continuation`/service function signatures (that would touch
 * every Slice 5-9 call site's input type, a much larger and riskier surface than one extra indexed
 * PK read per emission). Every emitting transaction already reads or writes `WorkflowInstance` (or a
 * child row keyed off it) before this runs, so the lookup is inside the same atomic transaction and
 * therefore consistent — it never observes a revision id from a different instance's row.
 */
export async function resolveWorkflowRevisionIdInTx(tx: Tx, workflowInstanceId: number): Promise<number> {
  const row = await tx.workflowInstance.findUniqueOrThrow({
    where: { id: toId(workflowInstanceId) },
    select: { workflowRevisionId: true },
  });
  return fromId(row.workflowRevisionId);
}

export type EmitTraceAutoRevisionInput<T extends WorkflowTraceType> = {
  workflowInstanceId: number;
  traceType: T;
  corePayload: Omit<WorkflowTracePayloadMapV1[T], 'workflowRevisionId'>;
  nodeInstanceId?: number;
  actorType: WorkflowActorType | WorkItemEscalationActorType;
  actorId?: number;
  dataClassification?: string;
  diagnosticPayloadJson?: string;
};

/** Convenience wrapper — resolves `workflowRevisionId` from the instance row and merges it into the payload, so call sites only ever supply the type-specific causal fields. */
export async function emitTraceAutoRevision<T extends WorkflowTraceType>(tx: Tx, input: EmitTraceAutoRevisionInput<T>): Promise<void> {
  const workflowRevisionId = await resolveWorkflowRevisionIdInTx(tx, input.workflowInstanceId);
  const payload = { ...input.corePayload, workflowRevisionId: String(workflowRevisionId) } as WorkflowTracePayloadMapV1[T];
  await emitTrace(tx, {
    workflowInstanceId: input.workflowInstanceId,
    traceType: input.traceType,
    payload,
    nodeInstanceId: input.nodeInstanceId,
    actorType: input.actorType,
    actorId: input.actorId,
    dataClassification: input.dataClassification,
    diagnosticPayloadJson: input.diagnosticPayloadJson,
  });
}
