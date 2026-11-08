import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createPgPoolAuthAuditDbBatcher } from '../AuthAuditDbBatcher';
import { AUTH_AUDIT_ROW_COLUMN_COUNT, buildAuthAuditBatchInsertSql } from '../authAuditRecordDbMapper';

describe('authAuditRecordDbMapper', () => {
  it('builds positional SQL for multi-row auth audit batch inserts', () => {
    const sql = buildAuthAuditBatchInsertSql(3);
    expect(sql).toContain('INSERT INTO base_logs_auth_audit');
    expect(sql.match(/\$\d+/g)?.length).toBe(3 * AUTH_AUDIT_ROW_COLUMN_COUNT);
  });
});

describe('AuthAuditDbBatcher', () => {
  it('writes queued auth audit events in one batch insert', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 2 }));
    const pool = { query } as unknown as Pool;
    const batcher = createPgPoolAuthAuditDbBatcher(pool, {
      batchSize: 10,
      flushIntervalMs: 60_000,
      maxQueueSize: 100,
    });

    batcher.enqueue({
      userId: 1,
      email: 'user@example.com',
      eventType: 'LOGIN_SUCCESS',
      success: true,
      reason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      metadataJson: null,
    });
    batcher.enqueue({
      userId: null,
      email: 'user@example.com',
      eventType: 'LOGIN_FAILED',
      success: false,
      reason: 'Invalid password',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      metadataJson: '{"attempt":1}',
    });

    await batcher.flush();

    expect(query).toHaveBeenCalledTimes(1);
    const firstCall = query.mock.calls[0];
    expect(firstCall?.[1]).toHaveLength(2 * AUTH_AUDIT_ROW_COLUMN_COUNT);
    expect(batcher.getQueueSize()).toBe(0);

    await batcher.shutdown();
  });
});
