import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const updatePackage = vi.fn(async (_ctx: unknown, catalogId: string) => ({
  body: { success: true as const, catalogId },
}));

vi.mock('../../middleware/builtInFunctionAccess.middleware', () => ({
  createBuiltInRouteGuard: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/functions.service', () => ({
  FunctionsService: class {
    updatePackage = updatePackage;
  },
}));

describe('functions.routes package API save', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    updatePackage.mockClear();
    const app = express();
    app.use(express.json());
    const { mountFunctionsRoutes } = await import('../functions.routes');
    mountFunctionsRoutes(app, { discoverSystemRoutes: async () => [] });

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

  it('accepts PUT /api/functions/package/:id when catalog id contains dots', async () => {
    const catalogId = 'pkg-api-demo-pack-demo-pack.health';
    const response = await fetch(`${baseUrl}/api/functions/package/${encodeURIComponent(catalogId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'export default async function handler() {}' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(updatePackage).toHaveBeenCalledWith(expect.anything(), catalogId, expect.any(Object));
  });
});
