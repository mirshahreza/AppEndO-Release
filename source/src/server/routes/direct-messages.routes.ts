import { Router, type Express } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';
import { DirectMessagesController } from '../controllers/directMessages.controller';
import { DirectMessageService } from '../services/direct-messages/directMessage.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});

export const mountDirectMessagesRoutes = (app: Express, settingsPath: string): void => {
  const service = new DirectMessageService(settingsPath);
  const controller = new DirectMessagesController(service);
  const router = Router();
  const rateLimit = createUserRateLimiter({ keyPrefix: 'direct-messages', maxPerMinute: 90 });

  router.get('/recipients', requireAuth, rateLimit, controller.searchRecipients);
  router.post('/attachments', requireAuth, rateLimit, upload.array('files', 3), controller.uploadAttachments);
  router.get('/attachments/:attachmentId', requireAuth, rateLimit, controller.downloadAttachment);
  router.post('/threads', requireAuth, rateLimit, controller.createThread);
  router.get('/threads/:threadId', requireAuth, rateLimit, controller.getThread);
  router.get('/threads/:threadId/messages', requireAuth, rateLimit, controller.listMessages);
  router.post('/threads/:threadId/messages', requireAuth, rateLimit, controller.sendMessage);
  router.post('/threads/:threadId/read', requireAuth, rateLimit, controller.markRead);

  app.use('/api/direct-messages', router);
};
