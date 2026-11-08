import { Router, type Express } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { createKeyedRateLimiter } from '../middleware/rateLimit';
import { resolveAuthRateLimitKey } from '../middleware/authRateLimitKey';
import { WorkbooksController } from '../controllers/workbooks.controller';

const workbookOpenRateLimit = createKeyedRateLimiter({
  keyPrefix: 'workbook-open',
  maxPerMinute: 30,
  keyFor: (req) => `${resolveAuthRateLimitKey(req)}:${String(req.params.id ?? '')}`,
});

export const mountWorkbooksRoutes = (app: Express): void => {
  const controller = new WorkbooksController();
  const router = Router();

  router.get('/resolve-username', requireAuth, controller.resolveUsername);
  router.get('/shared', requireAuth, controller.listShared);
  router.get('/', requireAuth, controller.list);
  router.post('/', requireAuth, controller.create);
  router.get('/:id/open', optionalAuth, workbookOpenRateLimit, controller.open);
  router.patch('/:id/open', optionalAuth, workbookOpenRateLimit, controller.update);
  router.patch('/:id/access', requireAuth, controller.updateAccess);
  router.get('/:id', requireAuth, controller.get);
  router.patch('/:id', requireAuth, controller.update);
  router.delete('/:id', requireAuth, controller.remove);

  app.use('/api/workbooks', router);
};
