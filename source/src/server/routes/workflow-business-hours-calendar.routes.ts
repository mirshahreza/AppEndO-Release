import { Router, type Express } from 'express';
import { WorkflowBusinessHoursCalendarController } from '../controllers/workflowBusinessHoursCalendar.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

/** HWF-2.2 — read: any authenticated user; write: ADMIN only (a platform-wide setting). */
export const mountWorkflowBusinessHoursCalendarRoutes = (app: Express): void => {
  const controller = new WorkflowBusinessHoursCalendarController();
  const router = Router();

  router.get('/', requireAuth, controller.get);
  router.put('/', requireRole('ADMIN'), controller.update);

  app.use('/api/workflow-business-hours-calendar', router);
};
