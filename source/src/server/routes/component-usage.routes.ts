import type { Express } from 'express';
import { Router } from 'express';
import { ComponentUsageController } from '../controllers/component-usage.controller';

export const mountComponentUsageRoutes = (app: Express): void => {
  const controller = new ComponentUsageController();
  const router = Router();

  router.post('/hit', controller.recordHit);

  app.use('/api/component-usage', router);
};
