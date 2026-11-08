import { Router, type Express } from 'express';
import { LogsController } from '../controllers/logs.controller';
import { requireRole } from '../middleware/auth.middleware';
import { LogsService, type LogsServiceDeps } from '../services/logs.service';

export const mountLogsRoutes = (app: Express, deps: LogsServiceDeps): void => {
  const service = new LogsService(deps);
  const controller = new LogsController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/config', controller.getConfig);
  router.post('/config', controller.saveConfig);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.delete('/', controller.clearAll);

  app.use('/api/logs', adminOnly, router);
};
