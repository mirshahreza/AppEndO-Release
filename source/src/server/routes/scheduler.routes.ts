import { Router, type Express } from 'express';
import { SchedulerController } from '../controllers/scheduler.controller';
import { requireRole } from '../middleware/auth.middleware';
import type { SchedulerServiceDeps } from '../services/scheduler/scheduler.service';
import { SchedulerService } from '../services/scheduler/scheduler.service';

export const mountSchedulerRoutes = (app: Express, deps: SchedulerServiceDeps): void => {
  const service = new SchedulerService(deps);
  const controller = new SchedulerController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/', controller.getSnapshot);
  router.put('/', controller.replaceSettings);
  router.post('/tasks', controller.addTask);
  router.put('/tasks/:id', controller.updateTask);
  router.delete('/tasks/:id', controller.removeTask);
  router.post('/tasks/:id/run-now', controller.runTaskNow);
  router.get('/cron/preview', controller.previewCron);

  app.use('/api/scheduler', adminOnly, router);
};

export type { SchedulerService };
