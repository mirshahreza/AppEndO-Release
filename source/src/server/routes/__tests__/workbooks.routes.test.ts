import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const workbookItem = {
  id: 'wb-1',
  name: 'Rate card',
  accessControl: {
    accessMode: 'authenticated',
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
  accessPermission: 'view',
  sharedMembers: [],
  viewerRole: 'owner',
};

const update = vi.fn(async () => workbookItem);
const updateAccess = vi.fn(async () => workbookItem);

vi.mock('../../middleware/auth.middleware', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  optionalAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/rateLimit', () => ({
  createKeyedRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/authRateLimitKey', () => ({
  resolveAuthRateLimitKey: () => 'test',
}));

vi.mock('../../services/workbooks/workbooks.service', () => ({
  getWorkbooksService: () => ({
    updateAccess,
    list: vi.fn(),
    listShared: vi.fn(),
    resolveUsername: vi.fn(),
    get: vi.fn(),
    open: vi.fn(),
    create: vi.fn(),
    update,
    remove: vi.fn(),
  }),
}));

describe('workbooks.routes access', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    const { mountWorkbooksRoutes } = await import('../workbooks.routes');
    mountWorkbooksRoutes(app);
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

  it('saves sharing on PATCH /api/workbooks/:id', async () => {
    const response = await fetch(`${baseUrl}/api/workbooks/wb-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessControl: { accessMode: 'authenticated' },
        permission: 'edit',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, item: { id: 'wb-1' } });
    expect(update).toHaveBeenCalled();
  });

  it('registers PATCH /api/workbooks/:id/access', async () => {
    const response = await fetch(`${baseUrl}/api/workbooks/wb-1/access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessControl: { accessMode: 'authenticated' },
        permission: 'view',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, item: { id: 'wb-1' } });
    expect(updateAccess).toHaveBeenCalled();
  });
});
