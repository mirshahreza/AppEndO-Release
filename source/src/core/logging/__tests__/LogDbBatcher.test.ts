import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { LogLevel, type LogRecord } from '../Logger';
import { createPgPoolLogDbBatcher } from '../LogDbBatcher';
import { shouldPersistLogToDb } from '../logPersistenceConfig';
import { APP_LOG_ROW_COLUMN_COUNT, buildAppLogBatchInsertSql } from '../logRecordDbMapper';

const buildEntry = (level: LogLevel, message: string): LogRecord => ({
  timestamp: '2026-06-13T12:00:00.000Z',
  actor: 'SYSTEM',
  callSuccess: null,
  failureReason: null,
  durationMs: null,
  level,
  context: 'Test',
  message,
});

describe('logPersistenceConfig', () => {
  it('persists INFO and above but not DEBUG by default', () => {
    expect(shouldPersistLogToDb(LogLevel.DEBUG, LogLevel.INFO)).toBe(false);
    expect(shouldPersistLogToDb(LogLevel.INFO, LogLevel.INFO)).toBe(true);
    expect(shouldPersistLogToDb(LogLevel.WARN, LogLevel.INFO)).toBe(true);
    expect(shouldPersistLogToDb(LogLevel.ERROR, LogLevel.INFO)).toBe(true);
  });
});

describe('logRecordDbMapper', () => {
  it('builds positional SQL for multi-row batch inserts', () => {
    const sql = buildAppLogBatchInsertSql(2);
    expect(sql).toContain('INSERT INTO base_logs_app');
    expect(sql.match(/\$\d+/g)?.length).toBe(2 * APP_LOG_ROW_COLUMN_COUNT);
  });
});

describe('LogDbBatcher', () => {
  it('writes queued logs in a single batch insert', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 2 }));
    const pool = { query } as unknown as Pool;
    const batcher = createPgPoolLogDbBatcher(pool, {
      batchSize: 10,
      flushIntervalMs: 60_000,
      maxQueueSize: 100,
      minLevel: LogLevel.INFO,
    });

    batcher.enqueue(buildEntry(LogLevel.DEBUG, 'debug-only'));
    batcher.enqueue(buildEntry(LogLevel.INFO, 'first'));
    batcher.enqueue(buildEntry(LogLevel.WARN, 'second'));

    await batcher.flush();

    expect(query).toHaveBeenCalledTimes(1);
    const firstCall = query.mock.calls[0];
    expect(firstCall).toBeDefined();
    const values = firstCall?.[1] as unknown[];
    expect(values).toHaveLength(2 * APP_LOG_ROW_COLUMN_COUNT);
    expect(batcher.getQueueSize()).toBe(0);

    await batcher.shutdown();
  });

  it('flushes remaining rows on shutdown', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const pool = { query } as unknown as Pool;
    const batcher = createPgPoolLogDbBatcher(pool, {
      batchSize: 50,
      flushIntervalMs: 60_000,
      maxQueueSize: 100,
      minLevel: LogLevel.INFO,
    });

    batcher.enqueue(buildEntry(LogLevel.ERROR, 'shutdown flush'));
    await batcher.shutdown();

    expect(query).toHaveBeenCalledTimes(1);
    expect(batcher.getQueueSize()).toBe(0);
  });
});
