import { Router, type Express } from 'express';
import { SampleMockController } from '../controllers/sample-mock.controller';
import { SampleMockService } from '../services/sample-mock/sample-mock.service';

export const mountSampleMockRoutes = (app: Express): void => {
  const controller = new SampleMockController(new SampleMockService());
  const router = Router();

  router.get('/lookups', controller.lookups);
  router.get('/records', controller.list);
  router.post('/records/bulk', controller.createBulk);
  router.post('/records', controller.create);
  router.get('/records/:id', controller.getById);
  router.patch('/records/:id/approve', controller.approve);
  router.patch('/records/:id/lock', controller.lock);
  router.patch('/records/:id', controller.patch);
  router.delete('/records/:id', controller.remove);

  app.use('/api/sample-mock', router);
};
