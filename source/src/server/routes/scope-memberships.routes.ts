import { Router, type Express } from 'express';
import { ScopeMembershipsController } from '../controllers/scope-memberships.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { ScopeMembershipsService } from '../services/scope-memberships.service';

export const mountScopeMembershipsRoutes = (app: Express): void => {
  const service = new ScopeMembershipsService();
  const controller = new ScopeMembershipsController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/', requireAuth, controller.list);
  router.get('/events', requireAuth, controller.listEvents);
  router.get('/roles', requireAuth, controller.listRoles);
  router.get('/roles/events', requireAuth, controller.listRoleEvents);
  router.post('/roles', adminOnly, controller.createRole);
  router.delete('/roles/:id', adminOnly, controller.removeRole);
  router.post('/', adminOnly, controller.create);
  router.delete('/:id', adminOnly, controller.remove);

  app.use('/api/scope-memberships', router);
};
