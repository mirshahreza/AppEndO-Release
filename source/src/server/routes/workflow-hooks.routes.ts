import { Router, type Express } from 'express';
import { WorkflowHooksController } from '../controllers/workflowHooks.controller';
import { createKeyedRateLimiter } from '../middleware/rateLimit';

/**
 * p-68 WHOOK Part A public ingress — deliberately mounted OUTSIDE `requireAuth` (see
 * `bootstrapFullRuntime.ts`'s `/api` gate, which allowlists the `/workflow-hooks` prefix). Rate
 * limiting is keyed by the URL token itself (falling back to IP if for some reason it's absent)
 * since there is no `req.auth.userId` for anonymous callers — `createUserRateLimiter` would be a
 * silent no-op here.
 */
export const mountWorkflowHooksRoutes = (app: Express): void => {
  const controller = new WorkflowHooksController();
  const hookRateLimit = createKeyedRateLimiter({
    keyPrefix: 'workflow-hook',
    maxPerMinute: 60,
    keyFor: (req) => req.params.token || req.ip || 'unknown',
  });
  const router = Router();

  router.post('/:token', hookRateLimit, controller.invoke);

  app.use('/api/workflow-hooks', router);
};
