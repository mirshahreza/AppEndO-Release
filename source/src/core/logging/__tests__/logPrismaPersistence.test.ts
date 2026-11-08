import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel, type LogRecord } from '../Logger';
import { initLogPersistence, shutdownLogPersistence, getLogDbBatcher } from '../logPersistenceRuntime';

const prismaMock = {
  baseAppLog: {
    createMany: vi.fn(async () => ({ count: 1 })),
  },
  baseAuthAuditLog: {
    createMany: vi.fn(async () => ({ count: 0 })),
  },
};

vi.mock('../../../server/db/prismaControlPlane', () => ({
  isPrismaControlPlaneReady: () => true,
  getPrismaControlPlane: () => prismaMock,
}));

const buildEntry = (message: string): LogRecord => ({
  timestamp: '2026-07-05T19:00:00.000Z',
  actor: 'SYSTEM',
  callSuccess: null,
  failureReason: null,
  durationMs: null,
  level: LogLevel.INFO,
  context: 'Test',
  message,
});

describe('logPrismaPersistence', () => {
  afterEach(async () => {
    await shutdownLogPersistence();
    vi.clearAllMocks();
  });

  it('persists app logs through Prisma createMany when pg pool is unavailable', async () => {
    initLogPersistence({ kind: 'prisma' }, {
      batchSize: 1,
      flushIntervalMs: 60_000,
      maxQueueSize: 100,
      minLevel: LogLevel.INFO,
    });

    const batcher = getLogDbBatcher();
    expect(batcher).not.toBeNull();

    batcher!.enqueue(buildEntry('sqlserver smoke'));
    await batcher!.flush();

    expect(prismaMock.baseAppLog.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.baseAppLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          actor: 'SYSTEM',
          level: 'INFO',
          context: 'Test',
          message: 'sqlserver smoke',
        }),
      ],
    });
  });
});
