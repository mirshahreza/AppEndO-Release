import { toPositionalParams } from '../db/database';
import type { LogRecord } from './Logger';

export const APP_LOG_ROW_COLUMN_COUNT = 12;

export type AppLogRowValues = [
  string,
  number | null,
  string | null,
  number | null,
  string,
  string,
  string,
  number,
  number,
  string | null,
  number,
  string,
];

const safeSerializeMeta = (meta: unknown): string | null => {
  if (meta === undefined || meta === null) return null;
  try {
    return JSON.stringify(meta);
  } catch {
    return JSON.stringify({ serializationError: true, type: typeof meta });
  }
};

export const mapLogRecordToRowValues = (entry: LogRecord): AppLogRowValues => {
  const actorValue = typeof entry.actor === 'string' ? entry.actor : 'SYSTEM';
  const levelValue = typeof entry.level === 'string' ? entry.level : String(entry.level || 'INFO');
  const contextValue = typeof entry.context === 'string' ? entry.context : String(entry.context || 'UnknownContext');
  const messageValue = typeof entry.message === 'string'
    ? entry.message
    : (entry.message === undefined || entry.message === null ? '' : JSON.stringify(entry.message));
  const createdAtValue = typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString();
  const serializedMeta = safeSerializeMeta(entry.meta);
  const messageSize = Buffer.byteLength(messageValue, 'utf8');
  const metaSize = serializedMeta ? Buffer.byteLength(serializedMeta, 'utf8') : 0;
  const callSuccessValue = entry.callSuccess === null ? null : (entry.callSuccess ? 1 : 0);
  const failureReasonValue = typeof entry.failureReason === 'string' ? entry.failureReason : null;
  const durationMsValue = (typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs))
    ? Math.max(0, Math.round(entry.durationMs))
    : null;

  return [
    actorValue,
    callSuccessValue,
    failureReasonValue,
    durationMsValue,
    levelValue,
    contextValue,
    messageValue,
    messageSize,
    serializedMeta ? 1 : 0,
    serializedMeta,
    metaSize,
    createdAtValue,
  ];
};

export const buildAppLogBatchInsertSql = (rowCount: number): string => {
  const rowPlaceholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const valuesClause = Array.from({ length: rowCount }, () => rowPlaceholder).join(', ');
  return toPositionalParams(`
    INSERT INTO base_logs_app (
      actor, call_success, failure_reason, duration_ms, level, context, message,
      message_size, has_meta, meta_json, meta_size, created_at
    )
    VALUES ${valuesClause}
  `);
};

export const flattenAppLogRowValues = (rows: AppLogRowValues[]): unknown[] =>
  rows.flatMap((row) => [...row]);
