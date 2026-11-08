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

vi.mock('../../domain/hwy/hwyBusinessRuleDocs.service', () => ({
  ensureHwyBusinessRuleDocCatalogRows: vi.fn(async () => 0),
  listHwyBusinessRuleDocs: vi.fn(async () => [
    {
      slug: 'membership-number',
      navGroupId: 'membership-identity',
      title: 'Membership number',
      introMarkdown: null,
      bodyMarkdown: 'Body',
      sortOrder: 0,
      updatedAt: null,
      updatedByUsername: null,
    },
  ]),
  readHwyBusinessRuleDoc: vi.fn(async () => null),
  updateHwyBusinessRuleDocMarkdown: vi.fn(async () => null),
}));

describe('hwy business rule docs routes', () => {
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

  it('GET /api/hwy/business-rules/docs returns success payload', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/business-rules/docs`);
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data?: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
