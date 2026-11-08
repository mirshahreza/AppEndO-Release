import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const mockSession = {
  success: true,
  mountId: 'studio',
  isAdmin: true,
  portalDefaults: { version: 1, sidebarDefaultCollapsed: false, sidebarCollapsePolicy: 'rail' as const },
  userExperience: null,
  effective: {
    version: 1,
    sidebarCollapsed: false,
    sidebarCollapsePolicy: 'rail' as const,
    allowUserSidebarPreference: true,
    layoutWidth: 'fluid' as const,
    layoutWidthUserControl: true,
    navExpandedGroups: [] as string[],
  },
};

const buildAppearanceSession = vi.fn(async () => mockSession);
const updateUserShellExperience = vi.fn(async () => ({
  version: 1,
  sidebarCollapsed: true,
  layoutWidth: 'bounded' as const,
  navExpandedGroups: null,
}));
const resetUserShellExperienceToPortalDefaults = vi.fn(async () => undefined);
const writePortalShellAppearanceDefaults = vi.fn(async () => ({
  version: 1,
  sidebarDefaultCollapsed: true,
  sidebarCollapsePolicy: 'hidden' as const,
}));

vi.mock('../../middleware/auth.middleware', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.auth = { userId: 42, email: 'admin@test', role: 'ADMIN', roles: ['ADMIN'] };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/appearance/appearance.service', () => ({
  buildAppearanceSession,
  updateUserShellExperience,
  resetUserShellExperienceToPortalDefaults,
  writePortalShellAppearanceDefaults,
}));

describe('appearance.routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    buildAppearanceSession.mockClear();
    updateUserShellExperience.mockClear();
    resetUserShellExperienceToPortalDefaults.mockClear();
    writePortalShellAppearanceDefaults.mockClear();

    const app = express();
    app.use(express.json());
    const { mountAppearanceRoutes } = await import('../appearance.routes');
    mountAppearanceRoutes(app);

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

  it('GET /api/appearance/session returns session for authenticated user', async () => {
    const response = await fetch(`${baseUrl}/api/appearance/session?mountId=studio`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, mountId: 'studio' });
    expect(buildAppearanceSession).toHaveBeenCalledWith(42, 'studio', ['ADMIN']);
  });

  it('PUT /api/appearance/me saves user shell experience', async () => {
    const response = await fetch(`${baseUrl}/api/appearance/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, sidebarCollapsed: true }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      userExperience: { sidebarCollapsed: true },
    });
    expect(updateUserShellExperience).toHaveBeenCalled();
  });

  it('POST /api/appearance/me/reset clears user override and returns session', async () => {
    const response = await fetch(`${baseUrl}/api/appearance/me/reset?mountId=studio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, mountId: 'studio' });
    expect(resetUserShellExperienceToPortalDefaults).toHaveBeenCalled();
    expect(buildAppearanceSession).toHaveBeenCalledWith(42, 'studio', ['ADMIN']);
  });

  it('PUT /api/appearance/portal-defaults/:mountId saves portal defaults for admin', async () => {
    const response = await fetch(`${baseUrl}/api/appearance/portal-defaults/studio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sidebarCollapsePolicy: 'hidden' }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      mountId: 'studio',
      portalDefaults: { sidebarCollapsePolicy: 'hidden' },
    });
    expect(writePortalShellAppearanceDefaults).toHaveBeenCalled();
  });
});
