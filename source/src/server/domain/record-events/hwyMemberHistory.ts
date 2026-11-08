import crypto from 'node:crypto';
import type { RecordEventKind, RecordEventValue } from '../../../shared/api/contracts/record-events';
import { emitRecordEvent } from './emitRecordEvent';
import { getPlatformHistoryMark, valuesEqual } from './platformHistoryMarks';
import type { HwyMemberHistorySnapshot } from './hwyMemberHistoryFields';

const scalar = (value: unknown): RecordEventValue => ({ value: value ?? null });

const mark = () => getPlatformHistoryMark('hwy_members');

export async function emitHwyMemberDirectoryPatchHistory(input: {
  memberId: number;
  before: HwyMemberHistorySnapshot;
  after: HwyMemberHistorySnapshot;
  actorUserId?: number | null;
  correlationId?: string;
}): Promise<void> {
  const platformMark = mark();
  if (!platformMark?.history.enabled) {
    return;
  }

  const lifecycleField = platformMark.history.lifecycleField ?? 'membership_status_code';
  const correlationId = input.correlationId?.trim() || crypto.randomUUID();
  const subjectId = String(input.memberId);

  const diffs: Array<{ field: string; eventKind: RecordEventKind; redact: boolean }> = [];
  const keys = new Set([...Object.keys(input.before), ...Object.keys(input.after)]);

  for (const field of keys) {
    const columnHistory = platformMark.columns[field];
    const isLifecycle = field === lifecycleField;
    if (!columnHistory?.track && !isLifecycle) {
      continue;
    }
    const from = input.before[field] ?? null;
    const to = input.after[field] ?? null;
    if (valuesEqual(from, to)) {
      continue;
    }
    diffs.push({
      field,
      eventKind: isLifecycle ? 'status.changed' : 'field.changed',
      redact: Boolean(columnHistory?.redact),
    });
  }

  if (!diffs.length) {
    return;
  }

  for (const diff of diffs) {
    await emitRecordEvent({
      subjectKind: 'hwy_members',
      subjectId,
      eventKind: diff.eventKind,
      source: 'patch',
      field: diff.field,
      fromValue: scalar(input.before[diff.field] ?? null),
      toValue: scalar(input.after[diff.field] ?? null),
      redact: diff.redact,
      correlationId,
      actorUserId: input.actorUserId ?? null,
      actorKind: input.actorUserId ? 'user' : 'system',
      inProcess: false,
      historyEnabled: true,
    });
  }
}
