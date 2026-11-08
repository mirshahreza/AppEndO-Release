import { Router, type Express } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';
import { PersonalInboxController } from '../controllers/personalInbox.controller';
import { PersonalInboxService } from '../services/personal-inbox/personalInbox.service';
import { FeedbackService } from '../services/feedback/feedback.service';
import { PersonalInboxCorrespondenceService } from '../services/personal-inbox/personalInboxCorrespondence.service';
import { PersonalInboxVocabService } from '../services/personal-inbox/personalInboxVocab.service';
import { PersonalInboxEnvelopeService } from '../services/personal-inbox/personalInboxEnvelope.service';
import { DirectMessageService } from '../services/direct-messages/directMessage.service';

export const mountPersonalInboxRoutes = (app: Express, settingsPath: string): void => {
  const feedbackService = new FeedbackService(settingsPath);
  const directMessageService = new DirectMessageService(settingsPath);
  const service = new PersonalInboxService(feedbackService);
  const correspondence = new PersonalInboxCorrespondenceService(feedbackService, directMessageService);
  const vocab = new PersonalInboxVocabService();
  const envelope = new PersonalInboxEnvelopeService(service, feedbackService, directMessageService);
  const controller = new PersonalInboxController(service, correspondence, vocab, envelope);
  const router = Router();
  const rateLimit = createUserRateLimiter({ keyPrefix: 'personal-inbox', maxPerMinute: 120 });

  router.get('/', requireAuth, rateLimit, controller.list);
  router.get('/summary', requireAuth, rateLimit, controller.summary);
  router.get('/folders', requireAuth, rateLimit, controller.listFolders);
  router.post('/folders', requireAuth, rateLimit, controller.createFolder);
  router.patch('/folders/:folderId', requireAuth, rateLimit, controller.renameFolder);
  router.delete('/folders/:folderId', requireAuth, rateLimit, controller.deleteFolder);
  router.post('/items/folders', requireAuth, rateLimit, controller.setItemFolders);
  router.post('/items/permanent-delete', requireAuth, rateLimit, controller.permanentDeleteItem);
  router.post('/dismiss-attention', requireAuth, rateLimit, controller.dismissAttention);
  router.post('/mark-unread', requireAuth, rateLimit, controller.markUnread);
  router.get('/items/detail', requireAuth, rateLimit, controller.itemDetail);
  router.get('/correspondence-vocab', requireAuth, rateLimit, controller.correspondenceVocab);
  router.post('/items/reply', requireAuth, rateLimit, controller.replyToItem);
  router.post('/items/forward', requireAuth, rateLimit, controller.forwardItem);

  app.use('/api/personal-inbox', router);
};
