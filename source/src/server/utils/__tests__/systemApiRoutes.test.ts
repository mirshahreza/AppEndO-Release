import express from 'express';
import { describe, expect, it } from 'vitest';
import { collectSystemApiRoutes, joinRoutePaths } from '../systemApiRoutes';

describe('joinRoutePaths', () => {
  it('joins mount prefixes with nested route paths', () => {
    expect(joinRoutePaths('', '/api/health')).toBe('/api/health');
    expect(joinRoutePaths('/api/users', '/')).toBe('/api/users');
    expect(joinRoutePaths('/api/users', '/:id')).toBe('/api/users/:id');
    expect(joinRoutePaths('/api/auth', '/login')).toBe('/api/auth/login');
  });
});

describe('collectSystemApiRoutes', () => {
  it('discovers nested router routes mounted under /api', async () => {
    const app = express();

    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    app.get('/api/ready', (_req, res) => {
      res.json({ status: 'ready' });
    });

    const usersRouter = express.Router();
    usersRouter.get('/', (_req, res) => {
      res.json({ success: true });
    });
    usersRouter.post('/:id/reset-password', (_req, res) => {
      res.json({ success: true });
    });
    usersRouter.patch('/:id/lock', (_req, res) => {
      res.json({ success: true });
    });

    app.use('/api/users', usersRouter);

    const routes = await collectSystemApiRoutes(app);
    const signatures = routes.map((route) => `${route.method} ${route.path}`);

    expect(signatures).toContain('GET /api/health');
    expect(signatures).toContain('GET /api/ready');
    expect(signatures).toContain('GET /api/users');
    expect(signatures).toContain('POST /api/users/:id/reset-password');
    expect(signatures).toContain('PATCH /api/users/:id/lock');
    expect(routes.length).toBeGreaterThanOrEqual(4);
  });

  it('ignores non-api and wildcard routes', async () => {
    const app = express();

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });
    app.get('*', (_req, res) => {
      res.send('spa');
    });

    const routes = await collectSystemApiRoutes(app);
    expect(routes).toEqual([]);
  });

  it('skips handler preview formatting when includePreviewCode is false', async () => {
    const app = express();

    app.get('/api/health', function healthHandler(_req, res) {
      res.json({ status: 'ok' });
    });

    const [summaryRoute] = await collectSystemApiRoutes(app, { includePreviewCode: false });
    const [previewRoute] = await collectSystemApiRoutes(app, { includePreviewCode: true });

    expect(summaryRoute.code).toContain('Built-in system route preview only');
    expect(summaryRoute.code).not.toContain('healthHandler');
    expect(previewRoute.code).toContain('healthHandler');
  });
});
