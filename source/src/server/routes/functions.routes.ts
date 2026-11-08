import { Router, type Express } from 'express';
import { FunctionsController } from '../controllers/functions.controller';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { requireRole } from '../middleware/auth.middleware';
import type { FunctionsServiceDeps } from '../services/functions.service';
import { FunctionsService } from '../services/functions.service';

export const mountFunctionsRoutes = (app: Express, deps: FunctionsServiceDeps): void => {
  const service = new FunctionsService(deps);
  const controller = new FunctionsController(service, deps);
  const routeGuard = createBuiltInRouteGuard('ADMIN');
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  // Studio catalog extension — mount outside built-in route guard (same path family as sandbox GET /api/functions).
  app.get('/api/functions/catalog/unused', adminOnly, controller.listUnused);

  router.get('/entity-access/:entityKind/:entityKey', controller.getEntityFunctionAccess);
  router.put('/entity-access/:entityKind/:entityKey', controller.replaceEntityFunctionAccess);
  router.get('/system', controller.listSystem);
  router.get('/', controller.list);
  // Express 4 skips path segments containing a dot unless the param pattern allows it.
  router.put('/builtin/:id([^/]+)', controller.updateBuiltIn);
  router.put('/package/:id([^/]+)', controller.updatePackage);
  router.post('/', controller.create);
  router.put('/:id([^/]+)', controller.update);
  router.delete('/:id([^/]+)', controller.remove);

  app.use('/api/functions', routeGuard, router);
};
