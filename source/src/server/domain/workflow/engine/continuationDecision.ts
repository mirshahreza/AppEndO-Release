import type { JsonValue } from '../awm/types';

/**
 * Closed `ContinuationDecision` contract — sole authority per
 * docs/standards/workflow-engine-testing.md (doc 06 §15)
 * returns exactly one of these; repositories expose semantic transaction methods corresponding to
 * each kind and never accept arbitrary downstream row construction. Unknown decision kinds fail
 * with `WF_EXEC_ENGINE_INVARIANT`.
 *
 * Slice 5 scope note: the type is declared in full (it is the frozen wire contract every later
 * slice's node executor must also return), but only `SELECT_EDGE`, `COMPLETE_INSTANCE`,
 * `FAIL_INSTANCE` and `NO_CONTINUATION` have an executing repository transaction method in this
 * slice — `START_PARALLEL`/`RECORD_JOIN_ARRIVAL` (Slice 7) and `CREATE_WAIT` (Slices 6/8/9) are
 * typed now and wired to their real transaction methods in the slices that own PARALLEL_SPLIT/
 * PARALLEL_JOIN/DELAY/WAIT_EVENT/WORK_ITEM/SUBFLOW node dispatch. A Slice-5 node executor that
 * would need to produce one of those kinds (i.e. any node of those kinds) is out of this slice's
 * dispatch surface entirely — see `nodeExecution.ts`.
 */

export type ResolvedWaitCreation = {
  waitType: 'TIMER' | 'EVENT' | 'HUMAN' | 'SUBFLOW';
  dueAt?: string;
  timeoutAt?: string;
  eventName?: string;
  correlationKey?: string;
  correlationValueHash?: string;
  correlationEncoderVersion?: string;
  correlationHashAlgorithm?: string;
  childInstanceId?: number;
  workItemId?: number;
};

export type ContinuationDecision =
  | { kind: 'SELECT_EDGE'; edgeKey: string; nodeOutput: JsonValue; outputAssignments?: Record<string, JsonValue> }
  | { kind: 'START_PARALLEL'; splitNodeKey: string; branches: { edgeKey: string; branchTokenDescriptor: string }[] }
  | { kind: 'RECORD_JOIN_ARRIVAL'; joinNodeKey: string; branchTokenId: string }
  | { kind: 'CREATE_WAIT'; waitType: 'TIMER' | 'EVENT' | 'HUMAN' | 'SUBFLOW'; resolvedWait: ResolvedWaitCreation }
  | { kind: 'COMPLETE_INSTANCE'; output: JsonValue }
  | { kind: 'FAIL_INSTANCE'; errorCode: string; safeMessage: string; classifiedDetails?: JsonValue }
  | { kind: 'NO_CONTINUATION'; reason: 'INSTANCE_NOT_EXECUTABLE' | 'ALREADY_WON' | 'LATE_RESULT' };

export const CONTINUATION_DECISION_KINDS_IMPLEMENTED_IN_SLICE_5 = ['SELECT_EDGE', 'COMPLETE_INSTANCE', 'FAIL_INSTANCE', 'NO_CONTINUATION'] as const;
