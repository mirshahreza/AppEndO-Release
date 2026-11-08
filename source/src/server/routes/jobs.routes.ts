import { Router, type Express } from 'express';
import { JobsController } from '../controllers/jobs.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { JobsService } from '../services/jobs/jobs.service';

export const mountJobsRoutes = (app: Express): void => {
  const service = new JobsService();
  const controller = new JobsController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/stream', controller.stream);
  router.get('/', controller.list);
  router.post('/', controller.enqueue);
  router.get('/:id', controller.getById);
  router.post('/:id/cancel', controller.cancel);
  router.post('/:id/retry', controller.retry);

  app.use('/api/jobs', adminOnly, router);

  // p-102 — the router above is entirely ADMIN-gated at the mount level; a non-admin user
  // starting their own background agent task still needs to be able to cancel it, so this is a
  // separate, ownership-checked (not role-checked) mount rather than a route on the admin router.
  const agentTaskRouter = Router();
  agentTaskRouter.post('/', controller.enqueueOwnAgentTask);
  agentTaskRouter.post('/:id/cancel', controller.cancelOwnAgentTask);
  app.use('/api/agent-tasks', requireAuth, agentTaskRouter);
};
