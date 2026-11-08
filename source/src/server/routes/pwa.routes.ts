import multer from 'multer';
import type { Express } from 'express';
import { Router } from 'express';
import { PwaController } from '../controllers/pwa.controller';
import { requireRole } from '../middleware/auth.middleware';
import { PwaService, type PwaServiceDeps } from '../services/pwa.service';

const pwaIconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const mountPwaRoutes = (app: Express, deps: PwaServiceDeps): void => {
  const service = new PwaService(deps);
  const controller = new PwaController(service);
  const adminOnly = requireRole('ADMIN');

  const publicRouter = Router();
  publicRouter.get('/config', controller.getConfig);
  publicRouter.get('/icons/:slot/file', controller.getIconFile);
  app.use('/api/pwa', publicRouter);
  app.get('/manifest.webmanifest', controller.getManifest);

  const adminRouter = Router();
  adminRouter.post('/icons/:slot/upload', pwaIconUpload.single('file'), controller.uploadIcon);
  adminRouter.delete('/icons/:slot', controller.deleteIcon);
  app.use('/api/pwa', adminOnly, adminRouter);
};
