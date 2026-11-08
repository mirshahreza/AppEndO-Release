import crypto from 'node:crypto';
import type { RecordEventKind, RecordEventValue } from '../../../shared/api/contracts/record-events';
import { prisma } from '../users/prismaHelpers';
import { logger } from '../../../core/logging/Logger';
import { SAMPLE_MOCK_CHANGE_REASON } from '../../../shared/api/contracts/record-events';
import type { ChangeReasonPolicy } from '../../../shared/api/contracts/record-events';
import { assertChangeReason, parseChangeReason, type ChangeReason } from './changeReason';
import { resolveFunctionChangeReason } from './functionChangeReason';
import { emitRecordEvent } from './emitRecordEvent';
import { getPlatformHistoryMark, valuesEqual } from './platformHistoryMarks';
import { ensureRecordEventTables, getRecordEventModel } from './recordEventSequelizeModels';

export const SAMPLE_MOCK_SUBJECT_KIND = 'base_sample_mock_records';

export type SampleMockHistorySnapshot = {
  id: string;
  code: string;
  title: string;
  statusId: string;
  statusLabel: string;
  ownerId: string | null;
  parentId: string | null;
  locked: boolean;
  city: string | null;
  tags: Array<{ id: string; label: string }>;
};

const MARK = () => getPlatformHistoryMark(SAMPLE_MOCK_SUBJECT_KIND)!;
const scalar = (value: unknown): RecordEventValue => ({ value: value ?? null });
const assoc = (id: string, label?: string): RecordEventValue => ({ id, label: label ?? id });

const emitChange = async (input: {
  subjectId: string;
  eventKind: RecordEventKind;
  field: string;
  fromValue?: RecordEventValue | null;
  toValue?: RecordEventValue | null;
  reason: ChangeReason;
  correlationId: string;
  inProcess?: boolean;
  idempotencyKey?: string;
}) => {
  await emitRecordEvent({
    subjectKind: SAMPLE_MOCK_SUBJECT_KIND,
    subjectId: input.subjectId,
    eventKind: input.eventKind,
    source: 'patch',
    field: input.field,
    fromValue: input.fromValue,
    toValue: input.toValue,
    reasonCode: input.reason.code,
    reasonText: input.reason.text,
    correlationId: input.correlationId,
    historyEnabled: true,
    inProcess: input.inProcess,
    idempotencyKey: input.idempotencyKey,
    actorKind: input.inProcess ? 'system' : undefined,
  });
};

export const loadSampleMockHistorySnapshot = async (
  id: string,
): Promise<SampleMockHistorySnapshot | null> => {
  let recordId: bigint;
  try {
    recordId = BigInt(id);
  } catch {
    return null;
  }
  const row = await prisma().baseSampleMockRecord.findUnique({
    where: { id: recordId },
    include: {
      status: true,
      detail: true,
      recordTags: { include: { tag: true } },
    },
  });
  if (!row) return null;
  return {
    id: String(row.id),
    code: row.code,
    title: row.title,
    statusId: String(row.statusId),
    statusLabel: row.status.title,
    ownerId: row.ownerId != null ? String(row.ownerId) : null,
    parentId: row.parentId != null ? String(row.parentId) : null,
    locked: Boolean(row.locked),
    city: row.detail?.city ?? null,
    tags: row.recordTags.map((link) => ({
      id: String(link.tagId),
      label: link.tag.title,
    })),
  };
};

export const emitSampleMockCreatedHistory = async (
  snapshot: SampleMockHistorySnapshot,
  options: { inProcess?: boolean; idempotencyPrefix?: string } = {},
): Promise<void> => {
  if (!MARK().history.enabled) return;
  const reason = parseChangeReason();
  const correlationId = crypto.randomUUID();
  const prefix = options.idempotencyPrefix;
  await emitRecordEvent({
    subjectKind: SAMPLE_MOCK_SUBJECT_KIND,
    subjectId: snapshot.id,
    eventKind: 'created',
    source: 'patch',
    correlationId,
    historyEnabled: true,
    inProcess: options.inProcess,
    actorKind: options.inProcess ? 'system' : undefined,
    idempotencyKey: prefix ? `${prefix}:created:-` : undefined,
    reasonCode: reason.code,
    reasonText: reason.text,
  });
  if (snapshot.tags.length === 0) return;
  for (const tag of snapshot.tags) {
    await emitChange({
      subjectId: snapshot.id,
      eventKind: 'association.added',
      field: 'tags',
      toValue: assoc(tag.id, tag.label),
      reason,
      correlationId,
      inProcess: options.inProcess,
      idempotencyKey: prefix ? `${prefix}:association.added:${tag.id}` : undefined,
    });
  }
};

export const emitSampleMockDeletedHistory = async (
  subjectId: string,
  policy?: ChangeReasonPolicy,
): Promise<void> => {
  if (!MARK().history.enabled) return;
  const resolved = policy ?? await resolveFunctionChangeReason(
    'DELETE',
    '/api/sample-mock/records/:id',
    SAMPLE_MOCK_CHANGE_REASON,
  );
  const reason = parseChangeReason();
  await assertChangeReason({ policy: resolved, reason });
  await emitRecordEvent({
    subjectKind: SAMPLE_MOCK_SUBJECT_KIND,
    subjectId,
    eventKind: 'deleted',
    source: 'patch',
    historyEnabled: true,
    reasonCode: reason.code,
    reasonText: reason.text,
  });
};

export const emitSampleMockSnapshotDiff = async (
  before: SampleMockHistorySnapshot,
  after: SampleMockHistorySnapshot,
  options: { inProcess?: boolean; idempotencyPrefix?: string; policy?: ChangeReasonPolicy } = {},
): Promise<void> => {
  if (!MARK().history.enabled) return;
  const reason = parseChangeReason();
  if (!options.inProcess) {
    const policy = options.policy ?? await resolveFunctionChangeReason(
      'PATCH',
      '/api/sample-mock/records/:id',
      SAMPLE_MOCK_CHANGE_REASON,
    );
    await assertChangeReason({ policy, reason });
  }
  const correlationId = crypto.randomUUID();
  const prefix = options.idempotencyPrefix;
  const columns = MARK().columns;
  const lifecycleField = MARK().history.lifecycleField;

  const tracked: Array<{
    field: string;
    history: ReturnType<typeof MARK>['columns'][string] | undefined;
    from: unknown;
    to: unknown;
    toValue: RecordEventValue;
    fromValue: RecordEventValue;
  }> = [
    {
      field: 'title',
      history: columns.title,
      from: before.title,
      to: after.title,
      fromValue: scalar(before.title),
      toValue: scalar(after.title),
    },
    {
      field: 'code',
      history: columns.code,
      from: before.code,
      to: after.code,
      fromValue: scalar(before.code),
      toValue: scalar(after.code),
    },
    {
      field: 'status_id',
      history: columns.status_id,
      from: before.statusId,
      to: after.statusId,
      fromValue: assoc(before.statusId, before.statusLabel),
      toValue: assoc(after.statusId, after.statusLabel),
    },
    {
      field: 'locked',
      history: columns.locked,
      from: before.locked,
      to: after.locked,
      fromValue: scalar(before.locked),
      toValue: scalar(after.locked),
    },
    {
      field: 'owner_id',
      history: columns.owner_id,
      from: before.ownerId,
      to: after.ownerId,
      fromValue: scalar(before.ownerId),
      toValue: scalar(after.ownerId),
    },
    {
      field: 'parent_id',
      history: columns.parent_id,
      from: before.parentId,
      to: after.parentId,
      fromValue: scalar(before.parentId),
      toValue: scalar(after.parentId),
    },
    {
      field: 'detail.city',
      history: columns['detail.city'],
      from: before.city,
      to: after.city,
      fromValue: scalar(before.city),
      toValue: scalar(after.city),
    },
  ];

  for (const item of tracked) {
    if (!item.history?.track && lifecycleField !== item.field) continue;
    if (valuesEqual(item.from, item.to)) continue;
    const eventKind: RecordEventKind = lifecycleField === item.field ? 'status.changed' : 'field.changed';
    await emitChange({
      subjectId: after.id,
      eventKind,
      field: item.field,
      fromValue: item.fromValue,
      toValue: item.toValue,
      reason,
      correlationId,
      inProcess: options.inProcess,
      idempotencyKey: prefix ? `${prefix}:${eventKind}:${item.field}` : undefined,
    });
  }

  const beforeTags = new Map(before.tags.map((tag) => [tag.id, tag]));
  const afterTags = new Map(after.tags.map((tag) => [tag.id, tag]));
  const added = after.tags.filter((tag) => !beforeTags.has(tag.id));
  const removed = before.tags.filter((tag) => !afterTags.has(tag.id));
  if (added.length || removed.length) {
    for (const tag of added) {
      await emitChange({
        subjectId: after.id,
        eventKind: 'association.added',
        field: 'tags',
        toValue: assoc(tag.id, tag.label),
        reason,
        correlationId,
        inProcess: options.inProcess,
        idempotencyKey: prefix ? `${prefix}:association.added:${tag.id}` : undefined,
      });
    }
    for (const tag of removed) {
      await emitChange({
        subjectId: after.id,
        eventKind: 'association.removed',
        field: 'tags',
        fromValue: assoc(tag.id, tag.label),
        reason,
        correlationId,
        inProcess: options.inProcess,
        idempotencyKey: prefix ? `${prefix}:association.removed:${tag.id}` : undefined,
      });
    }
  }
};

const DEMO_CODES = ['ORD-001', 'ORD-002', 'ORD-007'] as const;

export const seedSampleMockRecordEvents = async (): Promise<void> => {
  await ensureRecordEventTables();
  const existing = await getRecordEventModel().count({
    where: { subjectKind: SAMPLE_MOCK_SUBJECT_KIND },
  });
  if (existing > 0) return;

  const rows = await prisma().baseSampleMockRecord.findMany({
    where: { code: { in: [...DEMO_CODES] } },
    include: {
      status: true,
      detail: true,
      recordTags: { include: { tag: true } },
    },
    orderBy: { code: 'asc' },
  });
  if (rows.length === 0) return;

  const openStatus = await prisma().baseSampleMockStatus.findUnique({ where: { code: 'open' } });
  const openId = openStatus ? String(openStatus.id) : null;
  const openLabel = openStatus?.title ?? 'Open';

  for (const row of rows) {
    const after: SampleMockHistorySnapshot = {
      id: String(row.id),
      code: row.code,
      title: row.title,
      statusId: String(row.statusId),
      statusLabel: row.status.title,
      ownerId: row.ownerId != null ? String(row.ownerId) : null,
      parentId: row.parentId != null ? String(row.parentId) : null,
      locked: Boolean(row.locked),
      city: row.detail?.city ?? null,
      tags: row.recordTags.map((link) => ({
        id: String(link.tagId),
        label: link.tag.title,
      })),
    };
    const prefix = `seed:sample-mock:${row.code}`;
    try {
      await emitSampleMockCreatedHistory({ ...after, tags: [] }, { inProcess: true, idempotencyPrefix: prefix });
      const before: SampleMockHistorySnapshot = {
        ...after,
        title: row.code.startsWith('ORD') ? 'New order' : after.title,
        statusId: openId ?? after.statusId,
        statusLabel: openLabel,
        locked: false,
        tags: [],
      };
      await emitSampleMockSnapshotDiff(before, after, { inProcess: true, idempotencyPrefix: prefix });
    } catch (error) {
      logger.warn(
        'RecordEvents',
        `Could not seed sample-mock record events for ${row.code}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
};
