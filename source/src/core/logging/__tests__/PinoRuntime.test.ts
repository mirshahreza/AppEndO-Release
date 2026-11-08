import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Pool } from 'pg';
import { LogLevel, logger } from '../Logger';
import { initPinoRuntime, shutdownLogPersistence, flushLogPersistence } from '../PinoRuntime';

describe('PinoRuntime', () => {
  beforeEach(async () => {
    await shutdownLogPersistence();
  });

  afterEach(async () => {
    await shutdownLogPersistence();
  });

  it('routes app logs through pino multistream into batched DB inserts', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const pool = { query } as unknown as Pool;

    initPinoRuntime(pool, {
      minLevel: LogLevel.INFO,
      batchSize: 1,
      flushIntervalMs: 60_000,
      maxQueueSize: 100,
    });

    logger.info('Server', 'started', { success: true, actor: 'SYSTEM' });
    await flushLogPersistence();
    await shutdownLogPersistence();

    expect(query).toHaveBeenCalledTimes(1);
    const [, values] = query.mock.calls[0] as [string, unknown[]];
    expect(values).toContain('Server');
    expect(values).toContain('started');
  });
});
