import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Pool } from 'pg';
import { LogLevel } from '../Logger';
import { flushLogPersistence, getAuthAuditPinoLogger, initPinoRuntime, shutdownLogPersistence } from '../PinoRuntime';
import { logAuthEvent } from '../../../server/services/auth/sessionAudit.service';

describe('logPersistenceRuntime via PinoRuntime', () => {
  beforeEach(async () => {
    await shutdownLogPersistence();
  });

  afterEach(async () => {
    await shutdownLogPersistence();
  });

  it('initializes app and auth audit pino loggers together', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const pool = { query } as unknown as Pool;

    initPinoRuntime(pool, {
      minLevel: LogLevel.INFO,
      batchSize: 1,
      flushIntervalMs: 60_000,
      maxQueueSize: 100,
    });

    expect(getAuthAuditPinoLogger()).not.toBeNull();

    await logAuthEvent(
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
      'LOGOUT',
      { userId: 1, email: 'user@example.com', success: true },
    );

    await flushLogPersistence();
    await shutdownLogPersistence();

    expect(query).toHaveBeenCalledTimes(1);
  });
});
