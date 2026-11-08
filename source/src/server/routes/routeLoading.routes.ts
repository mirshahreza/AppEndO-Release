import { Router, type Express } from 'express';
import { RouteLoadingController } from '../controllers/routeLoading.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { RouteLoadingService } from '../services/routeLoading/routeLoading.service';

export const mountRouteLoadingRoutes = (app: Express, settingsPath: string): void => {
  const service = new RouteLoadingService(settingsPath);
  const controller = new RouteLoadingController(service);
  const adminGuard = createBuiltInRouteGuard('ADMIN');
  const adminRouter = Router();

  adminRouter.get('/config', controller.getAdminConfig);
  adminRouter.put('/config', controller.putAdminConfig);

  app.use('/api/settings/route-loading', requireAuth, adminGuard, adminRouter);
};
