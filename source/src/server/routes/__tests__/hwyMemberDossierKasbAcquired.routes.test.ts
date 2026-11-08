import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/hawiety/hawietyRuntime', () => ({
  requireHawietyPackage: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/auth.middleware', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../domain/hwy/hwyMemberDossierSatellites.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/hwy/hwyMemberDossierSatellites.service')>();
  return {
    ...actual,
    listHwyMemberDossierKasbAcquired: vi.fn(async () => [
      {
        kasbMemberId: '1018688',
        kasbUsername: '101001',
        linkSlot: 'referrer' as const,
        referrerRelationId: '11183',
      },
    ]),
  };
});

describe('hwy member dossier kasb acquired route', () => {
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
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
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

  it('GET /api/hwy/member-directory/:memberId/kasb-acquired returns rows', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/member-directory/1036538/kasb-acquired?lang=ar`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].kasbUsername).toBe('101001');
  });
});
