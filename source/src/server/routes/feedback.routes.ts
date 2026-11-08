import { Router, type Express } from 'express';
import multer from 'multer';
import { FeedbackController } from '../controllers/feedback.controller';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { FeedbackService } from '../services/feedback/feedback.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});

export const mountFeedbackRoutes = (app: Express, settingsPath: string): void => {
  const service = new FeedbackService(settingsPath);
  const controller = new FeedbackController(service);
  const adminGuard = createBuiltInRouteGuard('ADMIN');
  const router = Router();
  const adminRouter = Router();

  router.get('/policy', controller.getBootPolicy);
  router.get('/subjects', controller.getSubjects);
  router.post('/', optionalAuth, controller.submit);
  router.post('/attachments', optionalAuth, upload.array('files', 3), controller.uploadAttachments);
  router.get('/attachments/:id', requireAuth, controller.downloadAttachment);

  router.get('/mine', requireAuth, controller.listMine);
  router.get('/mine/:id', requireAuth, controller.getMine);
  router.post('/mine/:id/messages', requireAuth, controller.postMineMessage);
  router.post('/mine/:id/mark-read', requireAuth, controller.markMineRead);

  router.get('/inbox', requireAuth, controller.listAdmin);
  router.get('/:id', requireAuth, controller.getAdmin);
  router.post('/:id/messages', requireAuth, controller.postAdminMessage);
  router.post('/:id/claim', requireAuth, controller.claim);
  router.patch('/:id/assign', requireAuth, adminGuard, controller.assign);
  router.patch('/:id/status', requireAuth, controller.updateStatus);

  adminRouter.get('/config', controller.getAdminConfig);
  adminRouter.put('/config', controller.putAdminConfig);

  app.use('/api/feedback', router);
  app.use('/api/settings/feedback', requireAuth, adminGuard, adminRouter);
};
