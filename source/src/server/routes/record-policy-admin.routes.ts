import { Router, type Express } from 'express';
import { RecordPolicyAdminController } from '../controllers/record-policy-admin.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { RecordPolicyAdminService } from '../services/record-policy-admin.service';

export const mountRecordPolicyAdminRoutes = (app: Express): void => {
  const service = new RecordPolicyAdminService();
  const controller = new RecordPolicyAdminController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/dimensions', requireAuth, controller.listDimensions);
  router.get('/dimensions/:key', requireAuth, controller.getDimension);

  router.get('/policies', requireAuth, controller.listPolicies);
  router.get('/policies/:id', requireAuth, controller.getPolicy);
  router.put('/policies', adminOnly, controller.savePolicy);
  router.delete('/policies/:id', adminOnly, controller.removePolicy);

  router.get('/bindings/:edgeModelId', requireAuth, controller.getBinding);
  router.put('/bindings', adminOnly, controller.saveBinding);
  router.delete('/bindings/:edgeModelId', adminOnly, controller.removeBinding);

  router.get('/explain', adminOnly, controller.explain);

  app.use('/api/record-policy', router);
};
