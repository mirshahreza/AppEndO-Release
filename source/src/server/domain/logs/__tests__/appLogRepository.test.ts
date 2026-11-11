import { afterEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  baseAppLog: {
    findMany: vi.fn(async () => []),
  },
};

vi.mock('../../../db/prismaControlPlane', () => ({
  isPrismaControlPlaneReady: () => true,
  getPrismaControlPlane: () => prismaMock,
}));

vi.mock('../../../db/controlPlaneDatabase', () => ({
  readControlPlaneDatabaseSettings: () => ({ provider: 'sqlserver', url: '', engine: 'prisma' }),
}));

vi.mock('../../../config/settingsFile', () => ({
  SETTINGS_PATH: '/tmp/settings.json',
}));

import { listAppLogsFiltered } from '../appLogRepository';

describe('appLogRepository', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('avoids duplicate id in orderBy for default sort (SQL Server compatibility)', async () => {
    await listAppLogsFiltered({ limit: 10 });

    expect(prismaMock.baseAppLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ id: 'desc' }],
      }),
    );
  });

  it('keeps id as tie-breaker when sorting by another column', async () => {
    await listAppLogsFiltered({ limit: 10, sortBy: 'timestamp', sortDir: 'asc' });

    expect(prismaMock.baseAppLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }, { id: 'desc' }],
      }),
    );
  });

  it('filters HTTP logs by requestId stored in metaJson', async () => {
    await listAppLogsFiltered({ limit: 10, requestId: 'req-abc-1' });

    expect(prismaMock.baseAppLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            { OR: [{ metaJson: { contains: 'req-abc-1' } }] },
          ],
        }),
      }),
    );
  });
});
