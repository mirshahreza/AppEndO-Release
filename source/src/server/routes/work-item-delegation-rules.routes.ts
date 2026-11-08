import { Router, type Express } from 'express';
import { WorkItemDelegationRulesController } from '../controllers/workItemDelegationRules.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';

/** HWF-2.4 — self-service, any authenticated user manages only their own rules. */
export const mountWorkItemDelegationRulesRoutes = (app: Express): void => {
  const controller = new WorkItemDelegationRulesController();
  const authOnly = requireAuth;
  const rateLimit = createUserRateLimiter({ keyPrefix: 'work-item-delegation-rules', maxPerMinute: 60 });
  const router = Router();

  router.get('/', authOnly, rateLimit, controller.list);
  router.post('/', authOnly, rateLimit, controller.create);
  router.delete('/:ruleId', authOnly, rateLimit, controller.remove);

  app.use('/api/work-item-delegation-rules', router);
};
