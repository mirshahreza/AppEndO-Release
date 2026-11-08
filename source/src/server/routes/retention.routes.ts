import { Router, type Express } from 'express';
import { RetentionController } from '../controllers/retention.controller';
import { requireRole } from '../middleware/auth.middleware';

export const mountRetentionRoutes = (app: Express): void => {
  const controller = new RetentionController();
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/destinations', controller.destinations);
  router.post('/test-destination', controller.testDestination);
  router.post('/dry-run', controller.dryRun);
  router.post('/run', controller.run);

  app.use('/api/retention', adminOnly, router);
};
