import { Router, type Express } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { ProfileService } from '../services/profile.service';

export const mountProfileRoutes = (app: Express): void => {
  const service = new ProfileService();
  const controller = new ProfileController(service);
  const routeGuard = createBuiltInRouteGuard();
  const router = Router();

  router.get('/', requireAuth, controller.getProfile);
  router.get('/me/attributes-summary', requireAuth, controller.getMyAttributeSummary);
  router.get('/me/editable-attributes', requireAuth, controller.getMyEditableAttributes);
  router.put('/me/editable-attributes', requireAuth, controller.updateMyEditableAttributes);
  router.put('/me/grid-column-layouts', requireAuth, controller.updateMyGridColumnLayout);
  router.get('/me/dashboard-layout', requireAuth, controller.getMyDashboardLayout);
  router.put('/me/dashboard-layout', requireAuth, controller.updateMyDashboardLayout);
  router.get('/me/linked-identities', requireAuth, controller.getLinkedIdentities);
  router.get('/me/editable-fields', requireAuth, controller.getMyEditableProfileFields);
  router.put('/me/editable-fields', requireAuth, controller.updateMyEditableProfileFields);
  router.put('/me', requireAuth, controller.updateMyAccount);
  router.put('/', requireAuth, controller.updateProfile);

  app.use('/api/profile', routeGuard, router);
};
