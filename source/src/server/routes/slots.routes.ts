import { Router, type Express } from 'express';
import { SlotsController } from '../controllers/slots.controller';
import { requireRole } from '../middleware/auth.middleware';

export const mountSlotsRoutes = (app: Express): void => {
  const controller = new SlotsController();
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/', controller.list);

  app.use('/api/slots', adminOnly, router);
};
