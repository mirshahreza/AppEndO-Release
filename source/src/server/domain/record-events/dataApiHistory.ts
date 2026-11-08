import type { Transaction } from 'sequelize';
import type { Request } from 'express';
import type {
  EdgeApiDefinition,
  EdgeApiOperation,
  EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import type { RecordEventKind, RecordEventValue } from '../../../shared/api/contracts/record-events';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { getEdgeModelStudioMeta } from '../../services/data-api/edgeModelStudioMetaStore';
import { resolvePrimaryKeyField } from '../../services/data-api/sequelize/buildDynamicModel';
import { stripReservedClientKeys } from '../client-context/collectClientContext';
import { dataApiOperationAllowsChangeReason } from '../../../shared/api/contracts/record-events';
import { assertChangeReason, parseChangeReason } from './changeReason';
import { emitRecordEvent, emitRecordEventBestEffort } from './emitRecordEvent';
import { getPlatformHistoryMark, valuesEqual } from './platformHistoryMarks';
import { logger } from '../../../core/logging/Logger';

const AUDIT_ONLY_FIELDS = new Set([
  'created_at', 'updated_at', 'created_by', 'updated_by',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
]);

const scalarValue = (value: unknown): RecordEventValue => ({ value });

const subjectIdFromRow = (model: EdgeModelDefinition, row: Record<string, unknown> | null | undefined): string | null => {
  if (!row) return null;
  const pk = resolvePrimaryKeyField(model.columns, model.primaryKey);
  const raw = row[pk] ?? row.id ?? row.Id;
  if (raw == null) return null;
  return String(raw);
};

export const prepareDataApiWriteBody = (body: unknown): unknown => stripReservedClientKeys(body);

export const emitDataApiHistory = async (input: {
  model: EdgeModelDefinition;
  definition?: EdgeApiDefinition | null;
  operationKind: EdgeApiOperation['kind'];
  operation?: EdgeApiOperation;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  req?: Request;
  source?: 'patch' | 'workflow' | 'status-log';
  transaction?: Transaction;
  correlationId?: string;
}): Promise<void> => {
  const mark = getPlatformHistoryMark(input.model.objectName);
  const studio = getEdgeModelStudioMeta(input.model.id);
  const history = studio.history ?? mark?.history;
  const source = input.source ?? 'patch';
  const reason = parseChangeReason(input.req);
  if (!history?.enabled) {
    return;
  }
  const skipReasonAssert = input.source === 'workflow'
    || !dataApiOperationAllowsChangeReason(input.operationKind);
  const assertReason = async () => {
    if (!skipReasonAssert) {
      await assertChangeReason({ policy: input.definition?.changeReason, reason });
    }
  };

  const lifecycleField = history.lifecycleField;
  const correlationId = input.correlationId;
  const sameSequelize = Boolean(
    input.transaction
    && input.transaction.sequelize === getControlPlaneSequelize(),
  );
  const transaction = sameSequelize ? input.transaction : undefined;
  const clientContextFields = input.operation?.clientContext?.fields;

  if (input.operationKind === 'create') {
    const subjectId = subjectIdFromRow(input.model, input.after);
    if (!subjectId) return;
    await assertReason();
    await emitRecordEvent({
      subjectKind: input.model.objectName,
      subjectId,
      eventKind: 'created',
      source,
      req: input.req,
      inProcess: source === 'workflow',
      clientContextFields,
      correlationId,
      transaction,
      historyEnabled: true,
      reasonCode: reason.code,
      reasonText: reason.text,
    });
    return;
  }

  if (input.operationKind === 'delete') {
    const subjectId = subjectIdFromRow(input.model, input.before);
    if (!subjectId) return;
    await assertReason();
    await emitRecordEvent({
      subjectKind: input.model.objectName,
      subjectId,
      eventKind: 'deleted',
      source,
      req: input.req,
      inProcess: source === 'workflow',
      clientContextFields,
      correlationId,
      transaction,
      historyEnabled: true,
      reasonCode: reason.code,
      reasonText: reason.text,
    });
    return;
  }

  const before = input.before ?? {};
  const after = input.after ?? {};
  const subjectId = subjectIdFromRow(input.model, after) ?? subjectIdFromRow(input.model, before);
  if (!subjectId) return;

  const columnMeta = new Map(studio.columnMeta.map((column) => [column.columnName, column]));
  const diffs: Array<{
    name: string;
    eventKind: RecordEventKind;
    redact: boolean;
  }> = [];

  for (const column of input.model.columns) {
    const name = column.field;
    if (AUDIT_ONLY_FIELDS.has(name)) continue;
    const columnHistory = columnMeta.get(name)?.history ?? mark?.columns[name];
    const isLifecycle = lifecycleField === name;
    if (!columnHistory?.track && !isLifecycle) continue;
    if (valuesEqual(before[name], after[name])) continue;
    diffs.push({
      name,
      eventKind: isLifecycle ? 'status.changed' : 'field.changed',
      redact: Boolean(columnHistory?.redact),
    });
  }

  if (diffs.length === 0) return;
  await assertReason();

  for (const diff of diffs) {
    await emitRecordEvent({
      subjectKind: input.model.objectName,
      subjectId,
      eventKind: diff.eventKind,
      source,
      field: diff.name,
      fromValue: scalarValue(before[diff.name] ?? null),
      toValue: scalarValue(after[diff.name] ?? null),
      redact: diff.redact,
      reasonCode: reason.code,
      reasonText: reason.text,
      req: input.req,
      inProcess: source === 'workflow',
      clientContextFields,
      correlationId,
      transaction,
      historyEnabled: true,
    });
  }
};

export const emitDataApiAccessDenied = (
  model: EdgeModelDefinition,
  subjectId: string | null,
  req?: Request,
): void => {
  const studio = getEdgeModelStudioMeta(model.id);
  const mark = getPlatformHistoryMark(model.objectName);
  if (!(studio.history ?? mark?.history)?.enabled) {
    return;
  }
  void emitRecordEventBestEffort({
    subjectKind: model.objectName,
    subjectId: subjectId ?? 'unknown',
    eventKind: 'access.denied',
    source: 'patch',
    outcome: 'denied',
    req,
    historyEnabled: true,
  }, (message, error) => {
    logger.error('RecordEvents', message, { error: error instanceof Error ? error.message : String(error) });
  });
};
