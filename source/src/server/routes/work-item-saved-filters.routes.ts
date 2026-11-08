import { Router, type Express } from 'express';
import { WorkItemSavedFiltersController } from '../controllers/workItemSavedFilters.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';

/** HWF-4.3 — self-service, any authenticated user manages only their own saved filters. */
export const mountWorkItemSavedFiltersRoutes = (app: Express): void => {
  const controller = new WorkItemSavedFiltersController();
  const authOnly = requireAuth;
  const rateLimit = createUserRateLimiter({ keyPrefix: 'work-item-saved-filters', maxPerMinute: 60 });
  const router = Router();

  router.get('/', authOnly, rateLimit, controller.list);
  router.post('/', authOnly, rateLimit, controller.create);
  router.delete('/:filterId', authOnly, rateLimit, controller.remove);

  app.use('/api/work-item-saved-filters', router);
};
