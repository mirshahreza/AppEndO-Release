import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/hawiety/hawietyRuntime', () => ({
  requireHawietyPackage: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/auth.middleware', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  normalizeAuthRoles: () => ['ADMIN'],
}));

const { getHwyGeoResponsibilityCenterStatsMock } = vi.hoisted(() => ({
  getHwyGeoResponsibilityCenterStatsMock: vi.fn(async () => ({
    montadheminCount: 12,
    tosighMaleCount: 3,
    tosighFemaleCount: 2,
    nakhebinCount: 4000,
    totalMembers: 12,
    necessaryCoursesYes: null,
    necessaryCoursesNo: null,
    profileCompleteYes: null,
    profileCompleteNo: null,
  })),
}));

vi.mock('../../domain/hwy/hwyGeoResponsibility.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/hwy/hwyGeoResponsibility.service')>();
  return {
    ...actual,
    getHwyGeoResponsibilityCenterStats: getHwyGeoResponsibilityCenterStatsMock,
  };
});

describe('hwy geo-responsibility center-stats route', () => {
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

  it('GET /api/hwy/geo-responsibility/center-stats returns stats payload', async () => {
    const response = await fetch(
      `${baseUrl}/api/hwy/geo-responsibility/center-stats?level=circle&geoBaseInfoId=geo-1`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.montadheminCount).toBe(12);
    expect(body.data.tosighMaleCount).toBe(3);
    expect(body.data.nakhebinCount).toBe(4000);
  });

  it('GET /api/hwy/geo-responsibility/center-stats validates query', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/geo-responsibility/center-stats?level=circle`);
    expect(response.status).toBe(400);
  });
});
