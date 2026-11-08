import type { Pool } from 'pg';
import { createDbBatchQueue, type DbBatchQueue } from './DbBatchQueue';
import {
  buildAuthAuditBatchInsertSql,
  flattenAuthAuditRowValues,
  mapAuthAuditEntryToRowValues,
  type AuthAuditQueueEntry,
} from './authAuditRecordDbMapper';
import {
  normalizeDbBatchSettings,
  type DbBatchSettings,
} from './logPersistenceConfig';

export type AuthAuditDbBatcherOptions = {
  batch?: DbBatchSettings;
  insertBatch: (entries: AuthAuditQueueEntry[]) => Promise<void>;
};

export type AuthAuditDbBatcher = DbBatchQueue<AuthAuditQueueEntry>;

export const createAuthAuditDbBatcher = (options: AuthAuditDbBatcherOptions): AuthAuditDbBatcher => {
  const batch = normalizeDbBatchSettings(options.batch);

  return createDbBatchQueue<AuthAuditQueueEntry>({
    batchSize: batch.batchSize,
    flushIntervalMs: batch.flushIntervalMs,
    maxQueueSize: batch.maxQueueSize,
    errorLabel: 'AuthAuditPersistence',
    insertBatch: options.insertBatch,
  });
};

export const createPgPoolAuthAuditDbBatcher = (
  pool: Pool,
  batch?: DbBatchSettings,
): AuthAuditDbBatcher => createAuthAuditDbBatcher({
  batch,
  insertBatch: async (entries) => {
    if (entries.length === 0) return;
    const rows = entries.map(mapAuthAuditEntryToRowValues);
    const sql = buildAuthAuditBatchInsertSql(rows.length);
    const values = flattenAuthAuditRowValues(rows);
    await pool.query(sql, values);
  },
});
