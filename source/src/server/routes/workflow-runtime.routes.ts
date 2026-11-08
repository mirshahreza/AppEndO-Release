import { Router, type Express } from 'express';
import { WorkflowRuntimeController } from '../controllers/workflowRuntime.controller';
import { requireRole } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';

/**
 * `WorkflowRuntimeService` transport (doc 02 section 13) — Start/Suspend/Resume/Cancel/
 * RetryFailedNode/ForceNewInvocation/InspectInstance. Admin-only, same convention as
 * `workflows.routes.ts` (operator-grade commands; doc 09 section 4's authorized-scope
 * model is not implemented, same carried-forward gap as every prior slice's operational entry
 * points). `Start` additionally goes through the platform's one real rate-limiting primitive
 * (`createUserRateLimiter`, doc 10 section 4) — it is keyed on the authenticated session's
 * `req.auth.userId`, which is exactly the identity this admin-authenticated surface uses, so it
 * applies correctly here (unlike a true external/anonymous caller, which this surface does not
 * serve — see `docs/standards/workflow-engine-testing.md`).
 */
export const mountWorkflowRuntimeRoutes = (app: Express): void => {
  const controller = new WorkflowRuntimeController();
  const adminOnly = requireRole('ADMIN');
  const startRateLimit = createUserRateLimiter({ keyPrefix: 'workflow-start', maxPerMinute: 120 });
  const router = Router();

  router.get('/instances', controller.listInstances);
  router.post('/definitions/:definitionId/start', startRateLimit, controller.start);
  router.post('/revisions/:revisionId/start', startRateLimit, controller.startOnRevision);
  router.post('/instances/:instanceId/suspend', controller.suspend);
  router.post('/instances/:instanceId/resume', controller.resume);
  router.post('/instances/:instanceId/cancel', controller.cancel);
  router.get('/instances/:instanceId/inspect', controller.inspect);
  router.post('/nodes/:nodeInstanceId/retry', controller.retryNode);
  router.post('/nodes/:nodeInstanceId/force-new-invocation', controller.forceNewInvocation);
  router.post('/definitions/:definitionId/webhook-secret/rotate', controller.rotateWebhookSecret);
  router.get('/definitions/:definitionId/webhook-secret/status', controller.webhookSecretStatus);
  router.get('/dead-letters', controller.listDeadLetters);
  router.get('/dead-letters/:deadLetterId', controller.getDeadLetter);
  router.post('/dead-letters/:deadLetterId/resolve', controller.resolveDeadLetter);
  router.get('/sla-violations', controller.listSlaViolations);

  app.use('/api/workflow-runtime', adminOnly, router);
};
