import { Router, type Express } from 'express';
import { RdpHubController } from '../controllers/rdp-hub.controller';
import { requireRole } from '../middleware/auth.middleware';
import { requireRemoteHubsPackage } from '../services/remote-hubs/remoteHubsRuntime';

export const mountRdpHubRoutes = (app: Express): void => {
  const controller = new RdpHubController();
  const router = Router();
  const adminOnly = requireRole('ADMIN');

  router.get('/status', controller.status);
  router.get('/connections', controller.list);
  router.get('/connections/:id', controller.getOne);
  router.post('/connections', controller.create);
  router.put('/connections/:id', controller.update);
  router.delete('/connections/:id', controller.remove);
  router.post('/connections/:id/ticket', controller.createTicket);

  app.use('/api/rdp-hub', requireRemoteHubsPackage, adminOnly, router);
};
