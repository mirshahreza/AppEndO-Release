import { Router, type Express } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { RouteLoadingController } from '../controllers/routeLoading.controller';
import { SessionContextSettingsController } from '../controllers/session-context-settings.controller';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { RouteLoadingService } from '../services/routeLoading/routeLoading.service';
import { SettingsService, type SettingsServiceDeps } from '../services/settings.service';

export const mountSettingsRoutes = (app: Express, deps: SettingsServiceDeps): void => {
  const service = new SettingsService(deps);
  const controller = new SettingsController(service);
  const sessionContextController = new SessionContextSettingsController();
  const routeLoadingController = new RouteLoadingController(
    new RouteLoadingService(deps.settingsPath),
  );
  const routeGuard = createBuiltInRouteGuard('ADMIN');
  const router = Router();

  router.get('/node', controller.getNodeSettings);
  router.put('/node', controller.putNodeSettings);
  router.get('/security', controller.getSecuritySettings);
  router.put('/security', controller.putSecuritySettings);
  router.get('/transfer/catalog', controller.getTransferCatalog);
  router.post('/transfer/export', controller.exportTransfer);
  router.post('/transfer/import', controller.importTransfer);
  router.get('/export/platform', controller.exportPlatform);
  router.post('/import/platform', controller.importPlatform);
  router.get('/session-context', sessionContextController.list);
  router.put('/session-context', sessionContextController.save);
  router.get('/route-loading/config', routeLoadingController.getAdminConfig);
  router.put('/route-loading/config', routeLoadingController.putAdminConfig);
  router.get('/', controller.get);
  router.post('/', controller.post);

  app.use('/api/settings', routeGuard, router);
};
