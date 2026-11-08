import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { findWorkflowByWebhookSecret } from '../services/workflow/webhookSecretService';
import { startWorkflowInstance } from '../domain/workflow/engine/startService';
import { ingestWorkflowEvent } from '../domain/workflow/engine/eventIngressService';
import type { JsonValue } from '../domain/workflow/awm/types';
import { handleWorkflowError } from './workflowTransportSupport';

/**
 * p-68 WHOOK Part A — the external ingress surface: `POST /api/workflow-hooks/:token`. Not
 * session-authenticated (mounted outside the platform's `requireAuth` gate — see
 * `bootstrapFullRuntime.ts`'s `/workflow-hooks` allowlist entry); the URL token IS the credential.
 * A missing/disabled/wrong token gets a generic 404 — never 401/403 — so the response can't be used
 * to distinguish "wrong secret" from "no such endpoint" (no token-guessing oracle).
 *
 * Optional envelope `{ eventName, correlation, payload }` also feeds the workflow event bus so a
 * WAIT_EVENT or EVENT-start workflow can correlate/start from the same POST.
 */
const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

export class WorkflowHooksController {
  invoke = asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.params.token;
    const binding = await findWorkflowByWebhookSecret(rawToken);
    if (!binding) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    const body = (req.body ?? null) as JsonValue;
    const envelope = asRecord(body);
    const eventName = typeof envelope?.eventName === 'string' ? envelope.eventName.trim() : '';
    if (eventName) {
      await ingestWorkflowEvent({
        eventName,
        eventSourceIdentity: `webhook:${binding.workflowDefinitionId}`,
        payload: (envelope?.payload ?? body) as JsonValue,
        correlationValue: envelope?.correlation as JsonValue | undefined,
        providerEventId: typeof envelope?.providerEventId === 'string' ? envelope.providerEventId : undefined,
        deduplicationKey: typeof envelope?.deduplicationKey === 'string' ? envelope.deduplicationKey : undefined,
        leaseOwnerId: `webhook:${binding.workflowDefinitionId}`,
      });
    }

    const result = await startWorkflowInstance({
      workflowRevisionId: binding.workflowRevisionId,
      input: body,
      startedByType: 'EXTERNAL_CONSUMER',
      startType: 'WEBHOOK',
    });

    res.status(202).json({ success: true, instanceId: result.instance.id });
  }, 'Failed to start Workflow instance from webhook.', { onError: handleWorkflowError });
}
