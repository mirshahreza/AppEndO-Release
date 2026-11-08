import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/hawiety/hawietyRuntime', () => ({
  requireHawietyPackage: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  isHawietyRuntimeEnabled: () => true,
}));

vi.mock('../../middleware/auth.middleware', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  normalizeAuthRoles: () => ['ADMIN'],
}));

vi.mock('../../domain/hwy/hwyEtlSyncPlan.service', () => ({
  computeHwyEtlSyncPlan: vi.fn(async () => ({
    ready: true,
    message: 'mock',
    localMaxMemberId: 100,
    lookbackHours: 6,
    updatedSinceIso: '2026-01-01T00:00:00.000Z',
    lastChangeHistoryId: 0,
    legacyUpdatedMemberCount: 0,
    changeHistoryMemberCount: 0,
    targetMemberCount: 0,
    estimatedNewMembers: 0,
    runDomainModules: false,
    steps: ['New members (if any)'],
  })),
}));

describe('hwy ETL console routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    const { mountHwyRoutes } = await import('../hwy.routes');
    mountHwyRoutes(app);

    app.use('/api', (_req, res) => {
      res.status(404).json({ success: false, error: 'API route not found.' });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('GET /api/hwy/etl-console/status returns success payload', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/etl-console/status`);
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; status?: { legacy: unknown } };
    expect(body.success).toBe(true);
    expect(body.status?.legacy).toBeDefined();
  });

  it('POST /api/hwy/etl-console/sync-plan returns plan payload', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/etl-console/sync-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: { env: { HWY_ETL_SYNC_LOOKBACK_HOURS: 6 } } }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; plan?: { ready: boolean } };
    expect(body.success).toBe(true);
    expect(body.plan?.ready).toBe(true);
  });
});
