import { Router, type Express } from 'express';
import { CacheController } from '../controllers/cache.controller';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { SETTINGS_PATH } from '../config/settingsFile';
import { CacheService } from '../services/cache.service';

export const mountCacheRoutes = (app: Express): void => {
  const service = new CacheService({ settingsPath: SETTINGS_PATH });
  const controller = new CacheController(service);
  const routeGuard = createBuiltInRouteGuard('ADMIN');
  const router = Router();

  router.get('/settings', controller.getSettings);
  router.put('/settings', controller.updateSettings);
  router.post('/settings/test', controller.testSettings);
  router.get('/status', controller.getStatus);
  router.get('/', controller.list);
  router.get('/:key', controller.getEntry);
  router.delete('/', controller.clearAll);
  router.delete('/:key', controller.deleteKey);

  app.use('/api/cache', routeGuard, router);
};
