import { Router, type Express } from 'express';
import { SshHubController } from '../controllers/ssh-hub.controller';
import { requireRole } from '../middleware/auth.middleware';
import { requireRemoteHubsPackage } from '../services/remote-hubs/remoteHubsRuntime';

export const mountSshHubRoutes = (app: Express): void => {
  const controller = new SshHubController();
  const router = Router();
  const adminOnly = requireRole('ADMIN');

  router.get('/connections', controller.list);
  router.get('/connections/:id', controller.getOne);
  router.get('/session', (_req, res) => {
    res.status(426).json({
      success: false,
      error: 'SSH Hub session requires a WebSocket upgrade to /api/ssh-hub/session.',
    });
  });
  router.post('/connections', controller.create);
  router.put('/connections/:id', controller.update);
  router.delete('/connections/:id', controller.remove);

  app.use('/api/ssh-hub', requireRemoteHubsPackage, adminOnly, router);
};
