import { Router, type Express } from 'express';
import { LibrariesController } from '../controllers/libraries.controller';
import { requireRole } from '../middleware/auth.middleware';

export const mountLibrariesRoutes = (app: Express): void => {
  const controller = new LibrariesController();
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/', controller.list);
  router.get('/search', controller.search);
  router.post('/install', controller.install);
  router.post('/upgrade', controller.upgrade);
  router.post('/uninstall', controller.uninstall);

  app.use('/api/libraries', adminOnly, router);
};
