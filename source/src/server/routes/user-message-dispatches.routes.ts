import { Router, type Express } from 'express';
import { UserMessageDispatchesController } from '../controllers/userMessageDispatches.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';

export const mountUserMessageDispatchesRoutes = (app: Express): void => {
  const controller = new UserMessageDispatchesController();
  const authOnly = requireAuth;
  const listRateLimit = createUserRateLimiter({ keyPrefix: 'user-message-dispatches-list', maxPerMinute: 240 });
  const router = Router();

  router.get('/', authOnly, listRateLimit, controller.list);
  router.get('/:dispatchId', authOnly, listRateLimit, controller.getById);

  app.use('/api/user-message-dispatches', router);
};
