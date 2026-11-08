import { Router, type Express } from 'express';
import multer from 'multer';
import { WorkflowWorkItemsController } from '../controllers/workflowWorkItems.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../domain/workflow/workItemAttachmentRepository';

const attachmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES } });

/**
 * `WorkflowWorkItemService` transport (doc 02 section 13, doc 07 section 10). List/Get/Claim/
 * Complete require only `requireAuth` (any authenticated platform user) — real per-item eligibility
 * is enforced inside `workItemService.ts`, not at the route gate. Reassign is an elevated/operator
 * action and stays `requireRole('ADMIN')`, matching the runtime operational surface.
 */
export const mountWorkflowWorkItemsRoutes = (app: Express): void => {
  const controller = new WorkflowWorkItemsController();
  const authOnly = requireAuth;
  const adminOnly = requireRole('ADMIN');
  const listRateLimit = createUserRateLimiter({ keyPrefix: 'workflow-work-item-inbox', maxPerMinute: 240 });
  const claimCompleteRateLimit = createUserRateLimiter({ keyPrefix: 'workflow-work-item-mutate', maxPerMinute: 120 });
  const router = Router();

  router.get('/inbox', authOnly, listRateLimit, controller.listInbox);
  router.post('/instance/:instanceId', authOnly, claimCompleteRateLimit, controller.attachAdHoc);
  router.get('/:workItemId', authOnly, controller.getWorkItem);
  router.get('/:workItemId/transitions', authOnly, controller.getTransitions);
  router.get('/:workItemId/comments', authOnly, controller.listComments);
  router.post('/:workItemId/comments', authOnly, claimCompleteRateLimit, controller.createComment);
  router.get('/:workItemId/attachments', authOnly, controller.listAttachments);
  router.post('/:workItemId/attachments', authOnly, claimCompleteRateLimit, attachmentUpload.single('file'), controller.uploadAttachment);
  router.get('/:workItemId/attachments/:attachmentId', authOnly, controller.downloadAttachment);
  router.delete('/:workItemId/attachments/:attachmentId', authOnly, claimCompleteRateLimit, controller.deleteAttachment);
  router.post('/:workItemId/claim', authOnly, claimCompleteRateLimit, controller.claim);
  router.post('/:workItemId/complete', authOnly, claimCompleteRateLimit, controller.complete);
  router.post('/:workItemId/forward', authOnly, claimCompleteRateLimit, controller.forward);
  router.post('/:workItemId/reassign', adminOnly, controller.reassign);

  app.use('/api/workflow-work-items', router);
};
