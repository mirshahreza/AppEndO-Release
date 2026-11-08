import type { Pool } from 'pg';
import { createDbBatchQueue, type DbBatchQueue } from './DbBatchQueue';
import type { LogRecord } from './Logger';
import {
  buildAppLogBatchInsertSql,
  flattenAppLogRowValues,
  mapLogRecordToRowValues,
} from './logRecordDbMapper';
import {
  normalizeLogDbPersistenceSettings,
  shouldPersistLogToDb,
  type LogDbPersistenceSettings,
} from './logPersistenceConfig';

export type LogDbBatcherOptions = {
  persistence?: LogDbPersistenceSettings;
  insertBatch: (batch: LogRecord[]) => Promise<void>;
};

export type LogDbBatcher = DbBatchQueue<LogRecord>;

export const createLogDbBatcher = (options: LogDbBatcherOptions): LogDbBatcher => {
  const persistence = normalizeLogDbPersistenceSettings(options.persistence);

  return createDbBatchQueue<LogRecord>({
    batchSize: persistence.batchSize,
    flushIntervalMs: persistence.flushIntervalMs,
    maxQueueSize: persistence.maxQueueSize,
    errorLabel: 'LogPersistence',
    shouldEnqueue: (entry) => shouldPersistLogToDb(entry.level, persistence.minLevel),
    insertBatch: options.insertBatch,
  });
};

export const createPgPoolLogDbBatcher = (
  pool: Pool,
  persistence?: LogDbPersistenceSettings,
): LogDbBatcher => createLogDbBatcher({
  persistence,
  insertBatch: async (batch) => {
    if (batch.length === 0) return;
    const rows = batch.map(mapLogRecordToRowValues);
    const sql = buildAppLogBatchInsertSql(rows.length);
    const values = flattenAppLogRowValues(rows);
    await pool.query(sql, values);
  },
});
