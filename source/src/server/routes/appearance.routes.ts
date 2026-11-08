import { Router, type Express } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  buildAppearanceSession,
  resetUserShellExperienceToPortalDefaults,
  updateUserShellExperience,
  writePortalShellAppearanceDefaults,
} from '../services/appearance/appearance.service';
import type { ActorContext } from '../types/requestContext';
import { asyncHandler } from '../utils/asyncHandler';

const actorFromRequest = (req: {
  auth?: { userId?: number; email?: string; role?: string; roles?: string[] };
}): ActorContext => {
  const roles = req.auth?.roles ?? (req.auth?.role ? [req.auth.role] : []);
  const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
  return {
    userId: Number(req.auth?.userId ?? 0),
    email: req.auth?.email,
    role: req.auth?.role,
    isAdmin,
  };
};

export const mountAppearanceRoutes = (app: Express): void => {
  const router = Router();
  const adminOnly = requireRole('ADMIN');

  router.get(
    '/session',
    asyncHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      const mountId = String(req.query.mountId ?? 'studio').trim();
      const session = await buildAppearanceSession(userId, mountId, req.auth?.roles);
      res.json(session);
    }, 'Failed to load appearance session.'),
  );

  router.put(
    '/me',
    asyncHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      const next = await updateUserShellExperience(actorFromRequest(req), userId, req.body);
      res.json({ success: true, userExperience: next });
    }, 'Failed to save shell experience.'),
  );

  router.post(
    '/me/reset',
    asyncHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      await resetUserShellExperienceToPortalDefaults(actorFromRequest(req), userId);
      const mountId = String(req.query.mountId ?? 'studio').trim();
      const session = await buildAppearanceSession(userId, mountId, req.auth?.roles);
      res.json(session);
    }, 'Failed to reset shell experience.'),
  );

  router.put(
    '/portal-defaults/:mountId',
    adminOnly,
    asyncHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      const mountId = String(req.params.mountId ?? '').trim();
      const portalDefaults = await writePortalShellAppearanceDefaults(
        actorFromRequest(req),
        mountId,
        req.body,
      );
      res.json({ success: true, mountId, portalDefaults });
    }, 'Failed to save portal appearance defaults.'),
  );

  app.use('/api/appearance', requireAuth, router);
};
