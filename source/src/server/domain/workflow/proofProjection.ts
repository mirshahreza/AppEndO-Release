import { listTraceByInstance } from './workflowTraceRepository';
import { isWorkflowTraceType } from './traceTypes';
import type { WorkflowTraceType, WorkflowTracePayloadMapV1 } from './traceTypes';
import type { WorkflowTraceRecord } from './types';

/**
 * The read-side Proof projection (doc 03 sections 12/29, doc 09 section 7, doc 11 section 11) —
 * "WorkflowTrace/Proof records deterministic execution evidence." `traceTypes.ts` is sole authority
 * for the closed `WorkflowTraceType` registry and each type's payload shape; this module builds
 * typed DTOs from raw `WorkflowTrace` rows without maintaining any independent trace-type or
 * payload-shape registry of its own (doc 03 section 12's "storage, emitters, Proof projections and
 * consumers MUST NOT maintain independent... registries").
 *
 * Proof ordering is `sequenceNumber ASC` only (already what `listTraceByInstance` returns) —
 * `occurredAt` is carried through for display but never used to order or break ties.
 */

/**
 * No retention/redaction/purge job exists anywhere in this repository yet (a real, honestly-carried
 * gap — doc 03 section 10/21's retention policy is declared in the frozen contract but has no
 * implementing job in this codebase as of Slice 10). Only `PRESENT`/`NOT_RECORDED` are reachable
 * today; `REDACTED`/`PURGED` are declared now so a future retention job can set them on this same
 * DTO shape without a breaking change, per doc 03 section 12's "typed evidence DTOs explicitly
 * represent redacted/purged optional fields and never infer a missing causal fact" — the shape
 * already distinguishes "never had diagnostics" from "had diagnostics, no longer available."
 */
export type ProofDiagnosticStatus = 'PRESENT' | 'NOT_RECORDED' | 'REDACTED' | 'PURGED';

export type ProofEntry = {
  sequenceNumber: number;
  traceType: string;
  /** False for any trace type outside the closed V1 registry — doc 03 section 12: "unknown future trace types may be retained but are not deterministic Proof evidence until registered." */
  isRegisteredType: boolean;
  nodeInstanceId: number | null;
  occurredAt: string | null;
  actorType: string;
  actorId: number | null;
  dataClassification: string;
  /** Parsed `coreEvidenceJson` — the required causal facts (doc 03 section 12). Always present for a registered type; an unregistered type's shape is not validated against `WorkflowTracePayloadMapV1`. */
  coreEvidence: Record<string, unknown>;
  diagnosticStatus: ProofDiagnosticStatus;
  diagnosticPayload: unknown | null;
};

function mapRowToProofEntry(row: WorkflowTraceRecord): ProofEntry {
  return {
    sequenceNumber: row.sequenceNumber,
    traceType: row.traceType,
    isRegisteredType: isWorkflowTraceType(row.traceType),
    nodeInstanceId: row.nodeInstanceId,
    occurredAt: row.occurredAt,
    actorType: row.actorType,
    actorId: row.actorId,
    dataClassification: row.dataClassification,
    coreEvidence: JSON.parse(row.coreEvidenceJson) as Record<string, unknown>,
    diagnosticStatus: row.diagnosticPayloadJson != null ? 'PRESENT' : 'NOT_RECORDED',
    diagnosticPayload: row.diagnosticPayloadJson != null ? (JSON.parse(row.diagnosticPayloadJson) as unknown) : null,
  };
}

/** Raw Proof stream — every retained trace row for the instance, `sequenceNumber ASC`, including any unregistered type (retained but flagged non-authoritative). */
export async function listProofEntriesForInstance(workflowInstanceId: number): Promise<ProofEntry[]> {
  const rows = await listTraceByInstance(workflowInstanceId);
  return rows.map(mapRowToProofEntry);
}

/** Deterministic Proof only — filters out any row whose `traceType` is outside the closed V1 registry (doc 03 section 12/doc 11 section 11: "unregistered trace types are not deterministic Proof evidence"). Every V1 emitter in this codebase only ever writes registered types, so this filter is currently a no-op in practice — it exists because the frozen contract requires Proof consumers to apply it, not storage to guarantee it never needs to. */
export async function buildDeterministicProofForInstance(workflowInstanceId: number): Promise<ProofEntry[]> {
  const all = await listProofEntriesForInstance(workflowInstanceId);
  return all.filter((entry) => entry.isRegisteredType);
}

/** Typed accessor for one entry's core evidence against the exact registered payload shape for its `traceType` — throws if the type is unregistered (callers should check `isRegisteredType` first, or use `buildDeterministicProofForInstance`). */
export function typedCoreEvidence<T extends WorkflowTraceType>(entry: ProofEntry, expectedType: T): WorkflowTracePayloadMapV1[T] {
  if (entry.traceType !== expectedType) {
    throw new Error(`Proof entry traceType "${entry.traceType}" does not match expected "${expectedType}".`);
  }
  return entry.coreEvidence as WorkflowTracePayloadMapV1[T];
}
