import crypto from 'node:crypto';

export const RECORD_EVENT_GENESIS_HASH = '0'.repeat(64);

const HASH_KEYS = [
  'subject_kind',
  'subject_id',
  'subject_seq',
  'occurred_at',
  'actor_user_id',
  'acting_as_user_id',
  'actor_kind',
  'outcome',
  'event_kind',
  'field',
  'from_value',
  'to_value',
  'correlation_id',
  'prev_hash',
] as const;

export type RecordEventHashInput = {
  subjectKind: string;
  subjectId: string;
  subjectSeq: number;
  occurredAt: Date | string;
  actorUserId: number | null;
  actingAsUserId: number | null;
  actorKind: string;
  outcome: string;
  eventKind: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  correlationId: string;
  prevHash: string;
};

const toIso = (value: Date | string): string => (
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()
);

export const canonicalizeRecordEventForHash = (input: RecordEventHashInput): string => {
  const payload: Record<string, unknown> = {
    subject_kind: input.subjectKind,
    subject_id: input.subjectId,
    subject_seq: Number(input.subjectSeq),
    occurred_at: toIso(input.occurredAt),
    actor_user_id: input.actorUserId == null ? null : Number(input.actorUserId),
    acting_as_user_id: input.actingAsUserId == null ? null : Number(input.actingAsUserId),
    actor_kind: input.actorKind,
    outcome: input.outcome,
    event_kind: input.eventKind,
    field: input.field,
    from_value: input.fromValue,
    to_value: input.toValue,
    correlation_id: input.correlationId,
    prev_hash: input.prevHash,
  };
  return JSON.stringify(payload, [...HASH_KEYS]);
};

export const hashRecordEventRow = (input: RecordEventHashInput): string => (
  crypto.createHash('sha256').update(canonicalizeRecordEventForHash(input), 'utf8').digest('hex')
);

export const verifyRecordEventRowHash = (input: RecordEventHashInput, rowHash: string): boolean => (
  hashRecordEventRow(input) === rowHash
);
