import { Router, type Express } from 'express';
import { BaseInfoController } from '../controllers/base-info.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { BaseInfoService } from '../services/base-info.service';

export const mountBaseInfoRoutes = (app: Express): void => {
  const service = new BaseInfoService();
  const controller = new BaseInfoController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/options', requireAuth, controller.listOptions);
  router.get('/tree', requireAuth, controller.listTree);
  router.get('/children', requireAuth, controller.listChildren);
  router.get('/:id', requireAuth, controller.getOne);
  router.post('/', adminOnly, controller.create);
  router.put('/:id', adminOnly, controller.update);
  router.post('/:id/move', adminOnly, controller.move);
  router.delete('/:id', adminOnly, controller.remove);
  router.patch('/:id/active', adminOnly, controller.setActive);

  app.use('/api/base-info', router);
};
