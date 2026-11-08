import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/auth.middleware', () => ({
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hasAdminRole: () => true,
  normalizeAuthRoles: () => ['ADMIN'],
}));

vi.mock('../../services/openApiSpec.service', () => ({
  openApiSpecService: {
    getAggregatedSpec: vi.fn(async () => ({ openapi: '3.1.2', paths: {} })),
    getAggregatedSpecForPrincipal: vi.fn(async () => ({ openapi: '3.1.2', paths: {} })),
    getFunctionSpec: vi.fn(async () => ({ openapi: '3.1.2', paths: { '/api/demo': {} } })),
    getDocsStatusForPrincipal: vi.fn(async () => ({
      generatedAt: '2026-07-04T12:00:00.000Z',
      routeCount: 1,
      scope: 'all',
    })),
    findFunctionInput: vi.fn(async () => ({
      id: 'smoke.echo',
      name: 'echo',
      folder: 'smoke',
      method: 'GET',
      path: '/api/smoke/echo',
    })),
    listAccessibleRoutesForPrincipal: vi.fn(async () => ([
      {
        id: 'smoke.echo',
        name: 'echo',
        folder: 'smoke',
        method: 'GET',
        path: '/api/smoke/echo',
        code: '',
        metadata_json: null,
        test_payload: '{}',
        engine_type: 'SANDBOX_JS',
        is_built_in: true,
      },
    ])),
    invalidate: vi.fn(),
  },
}));

vi.mock('../../services/openApiDocRefresh', () => ({
  refreshOpenApiDocumentationCaches: vi.fn(),
}));

describe('docs.routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    const { mountDocsRoutes } = await import('../docs.routes');
    mountDocsRoutes(app);

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

  it('registers aggregated Swagger UI at GET /api/docs', async () => {
    const response = await fetch(`${baseUrl}/api/docs`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain('swagger-ui');
  });

  it('registers aggregated OpenAPI JSON at GET /api/docs/openapi.json', async () => {
    const response = await fetch(`${baseUrl}/api/docs/openapi.json`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ openapi: '3.1.2' });
  });

  it('registers accessible route list at GET /api/docs/routes', async () => {
    const response = await fetch(`${baseUrl}/api/docs/routes`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      count: 1,
      items: [{
        id: 'smoke.echo',
        name: 'echo',
        method: 'GET',
        path: '/api/smoke/echo',
      }],
    });
  });

  it('registers scoped OpenAPI JSON for dotted function ids', async () => {
    const response = await fetch(`${baseUrl}/api/docs/routes/smoke.echo/openapi.json`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ openapi: '3.1.2' });
  });

  it('registers manual refresh at POST /api/docs/refresh', async () => {
    const { refreshOpenApiDocumentationCaches } = await import('../../services/openApiDocRefresh');
    const response = await fetch(`${baseUrl}/api/docs/refresh`, { method: 'POST' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(refreshOpenApiDocumentationCaches).toHaveBeenCalled();
  });

  it('renders documentation version control without refresh button on GET /api/docs', async () => {
    const response = await fetch(`${baseUrl}/api/docs`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toContain('appemdo-docs-refresh');
    expect(html).toContain('appemdo-docs-version-icon');
    expect(html).toContain('appemdo-docs-version-live');
    expect(html).toContain('onComplete');
  });

  it('registers docs status at GET /api/docs/status', async () => {
    const response = await fetch(`${baseUrl}/api/docs/status`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      generatedAt: '2026-07-04T12:00:00.000Z',
      routeCount: 1,
      scope: 'all',
    });
  });
});
