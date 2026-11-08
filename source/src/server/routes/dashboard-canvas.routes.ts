import { Router, type Express } from 'express';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.middleware';
import { createKeyedRateLimiter } from '../middleware/rateLimit';
import { resolveAuthRateLimitKey } from '../middleware/authRateLimitKey';
import { DashboardCanvasController } from '../controllers/dashboard-canvas.controller';

const publicOpenRateLimit = createKeyedRateLimiter({
  keyPrefix: 'dashboard-canvas-open',
  maxPerMinute: 240,
  keyFor: (req) => `${resolveAuthRateLimitKey(req)}:${String(req.params.pageId ?? req.params.id ?? '')}`,
});

export const mountDashboardCanvasRoutes = (app: Express): void => {
  const controller = new DashboardCanvasController();
  const router = Router();

  router.get('/pages/:pageId/config', optionalAuth, publicOpenRateLimit, controller.getConfig);
  router.get('/pages/:pageId/personalization', optionalAuth, publicOpenRateLimit, controller.getPersonalization);
  router.put('/pages/:pageId/personalization', requireAuth, controller.putPersonalization);
  router.post('/pages/:pageId/pivot', optionalAuth, publicOpenRateLimit, controller.pivot);
  router.post('/pivot', optionalAuth, publicOpenRateLimit, controller.pivot);
  router.get('/comments', optionalAuth, publicOpenRateLimit, controller.listComments);
  router.post('/comments', requireAuth, controller.createComment);
  router.get('/pages/:pageId/access', requireAuth, controller.getAccess);
  router.put('/pages/:pageId/access', requireAuth, controller.putAccess);
  router.post('/pages/:pageId/export', optionalAuth, publicOpenRateLimit, controller.exportPage);
  router.post('/pages/:pageId/snapshots', requireAuth, controller.createSnapshot);
  router.get('/snapshots/:id', optionalAuth, publicOpenRateLimit, controller.getSnapshot);
  router.post('/explain', optionalAuth, publicOpenRateLimit, controller.explain);
  router.post('/draft-widget', requireAuth, controller.draftWidget);

  app.use('/api/dashboard-canvas', router);
};

export const mountDataSourcePivotRoute = (app: Express): void => {
  const controller = new DashboardCanvasController();
  app.post(
    '/api/data-sources/:id/pivot',
    requireRole('ADMIN'),
    controller.dataSourcePivot,
  );
};
