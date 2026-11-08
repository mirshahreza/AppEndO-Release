import { describe, expect, it } from 'vitest';
import express from 'express';
import { registerRouteDiscoveryApp } from '../serverRouteDiscoveryRegistry';
import { collectSystemApiRoutes } from '../systemApiRoutes';

describe('serverRouteDiscoveryRegistry', () => {
  it('prefers the registered app scan when deps discovery returns fewer routes', async () => {
    const app = express();
    app.get('/api/alpha/one', (_req, res) => { res.json({ ok: true }); });
    app.get('/api/alpha/two', (_req, res) => { res.json({ ok: true }); });
    app.get('/api/beta/three', (_req, res) => { res.json({ ok: true }); });
    registerRouteDiscoveryApp(app);

    const { resolveDiscoveredSystemRoutes } = await import('../serverRouteDiscoveryRegistry');
    const routes = await resolveDiscoveredSystemRoutes(async () => []);

    expect(routes.length).toBe(await collectSystemApiRoutes(app).then((items) => items.length));
    expect(routes.length).toBeGreaterThan(0);
  });
});
