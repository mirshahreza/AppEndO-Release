import multer from 'multer';
import { Router, type Express } from 'express';
import { PlatformWebFontsController } from '../controllers/platformWebFonts.controller';
import { requireRole } from '../middleware/auth.middleware';
import { getDefaultPlatformWebFontsService } from '../services/platform/platformWebFonts.service';

const webFontUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const mountPlatformWebFontsRoutes = (app: Express): void => {
  const service = getDefaultPlatformWebFontsService();
  const controller = new PlatformWebFontsController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/', controller.listFonts);
  router.post('/upload', adminOnly, webFontUpload.single('file'), controller.uploadFont);
  router.put('/:fontId/script', adminOnly, controller.updateFontScript);
  router.delete('/:fontId', adminOnly, controller.deleteFont);

  app.use('/api/platform/web-fonts', router);
};
