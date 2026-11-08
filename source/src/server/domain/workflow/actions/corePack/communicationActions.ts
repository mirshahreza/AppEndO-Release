import { sendEmail } from '../../../../services/email/email.service';
import { validateMcpRemoteUrl, createSsrfGuardedFetch } from '../../../../services/ai/mcp/mcpUrlGuard';
import { parseNotificationUserId } from '../../../../services/notifications/userNotification.service';
import { dispatchNotification, dispatchNotificationForRole } from '../../../../services/notifications/notificationDispatch';
import type { ActionDefinition, ActionExecutor } from '../types';

/**
 * Communication Action pack (doc 04 section 4). In-app notifications persist to
 * `base_user_notifications` (generic, not workflow-specific) so SLA NOTIFY escalation and
 * `communication.notification-send` share one primitive.
 */

const inlineSchema = () => ({ type: 'INLINE' as const, schema: {} });

export const communicationEmailSendDefinition: ActionDefinition = {
  key: 'communication.email-send',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email', title: 'To' },
        subject: { type: 'string' },
        text: { type: 'string', title: 'Body (plain text)' },
        html: { type: 'string', title: 'Body (HTML, optional)' },
      },
      required: ['to', 'subject', 'text'],
    },
  },
  outputSchema: {
    type: 'INLINE',
    schema: { type: 'object', properties: { delivered: { type: 'boolean' }, mode: { type: 'string', description: '"smtp" when actually sent, "log" when SMTP is disabled in settings.' } } },
  },
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['communication.email'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['communication', 'email'],
};

export const communicationEmailSendExecutor: ActionExecutor = {
  /**
   * Wraps the real, already-governed `sendEmail` (src/server/services/email/email.service.ts) —
   * SMTP transport/settings/from-address resolution is that service's authority, not
   * reimplemented here. `sendEmail` itself degrades to `{ delivered: false, mode: 'log' }` when
   * SMTP is disabled in settings; that is surfaced as SUCCEEDED (not a failure) with the mode in
   * the output, since a disabled-SMTP dev environment is expected/non-exceptional, not an Action
   * failure — the caller can branch on `output.delivered`.
   */
  async execute(context, _config, input) {
    const { to, subject, text, html } = (input ?? {}) as { to?: unknown; subject?: unknown; text?: unknown; html?: unknown };
    if (typeof to !== 'string' || typeof subject !== 'string' || typeof text !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.to/subject/text (strings).' };
    }
    try {
      const result = await sendEmail({ to, subject, text, html: typeof html === 'string' ? html : undefined });
      context.writeTraceMetadata({ type: 'EMAIL_SEND_RESULT', payload: { mode: result.mode } });
      return { status: 'SUCCEEDED', output: { delivered: result.delivered, mode: result.mode } };
    } catch (error) {
      // A synchronous rejection from sendEmail (e.g. SMTP auth/connection failure) is a known
      // failure, not the crash-mid-external-call uncertainty that WF_ACTION_OUTCOME_UNKNOWN
      // denotes (doc 04 section 5) — errorCode here is this Action's own vocabulary (doc 04
      // section 8 types it as plain `string`, distinct from the closed WF_ engine-error registry).
      const safeMessage = error instanceof Error ? error.message : 'Email delivery failed.';
      return { status: 'FAILED', errorCode: 'EMAIL_SEND_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};

export const communicationNotificationSendDefinition: ActionDefinition = {
  key: 'communication.notification-send',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        userId: { type: ['integer', 'string'], title: 'User id' },
        roleId: { type: 'string', title: 'Role name (fan-out to members when userId is omitted)' },
        title: { type: 'string' },
        body: { type: 'string' },
        severity: { type: 'string', enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
        href: { type: 'string', title: 'Optional deep link' },
      },
      required: ['title', 'body'],
    },
  },
  outputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'number' },
        userIds: { type: 'array', items: { type: 'integer' } },
      },
    },
  },
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['communication.notification'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['communication', 'notification'],
};

export const communicationNotificationSendExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const rec = (input ?? {}) as {
      userId?: unknown; roleId?: unknown; title?: unknown; body?: unknown; severity?: unknown; href?: unknown;
    };
    if (typeof rec.title !== 'string' || rec.title.trim().length === 0 || typeof rec.body !== 'string') {
      return { status: 'FAILED', errorCode: 'NOTIFICATION_FIELDS_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.title and input.body are required strings.' };
    }
    const title = rec.title.trim();
    const body = rec.body;
    const severity = typeof rec.severity === 'string' ? rec.severity : 'info';
    const href = typeof rec.href === 'string' ? rec.href : null;
    const userId = parseNotificationUserId(rec.userId);
    try {
      if (userId) {
        await dispatchNotification({ userId, title, body, severity, href, eventType: 'workflow' });
        return { status: 'SUCCEEDED', output: { created: 1, userIds: [userId] } };
      }
      if (typeof rec.roleId === 'string' && rec.roleId.trim()) {
        const fanout = await dispatchNotificationForRole({ roleId: rec.roleId.trim(), title, body, severity, href, eventType: 'workflow' });
        if (fanout.created === 0) {
          return { status: 'FAILED', errorCode: 'NOTIFICATION_ROLE_EMPTY', errorClass: 'VALIDATION', safeMessage: `No members found for role "${rec.roleId}".` };
        }
        return { status: 'SUCCEEDED', output: { created: fanout.created, userIds: fanout.userIds } };
      }
      return { status: 'FAILED', errorCode: 'NOTIFICATION_TARGET_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'Provide input.userId or input.roleId.' };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Notification persist failed.';
      return { status: 'FAILED', errorCode: 'NOTIFICATION_SEND_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};

/**
 * WFV2-7 — convenience wrapper over `integration.http-request` for the common "POST JSON to a
 * webhook URL" case. Reuses the same SSRF-guarded fetch primitive rather than inventing a second
 * outbound HTTP stack.
 */
const guardedFetch = createSsrfGuardedFetch();

export const communicationWebhookNotifyDefinition: ActionDefinition = {
  key: 'communication.webhook-notify',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri', title: 'Webhook URL' },
        payload: { title: 'JSON payload', description: 'Serialized as the POST request body.' },
        headers: { type: 'object', title: 'Extra headers (optional)' },
      },
      required: ['url', 'payload'],
    },
  },
  outputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'number' },
        ok: { type: 'boolean' },
        body: { description: 'Parsed JSON body, or raw text when the response is not JSON.' },
      },
    },
  },
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'SUPPORTED',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'HIGH',
  requiredCapabilities: ['integration.http'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['communication', 'webhook', 'integration'],
};

export const communicationWebhookNotifyExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const urlInput = (input as { url?: unknown })?.url;
    const payload = (input as { payload?: unknown })?.payload;
    const extraHeaders = (input as { headers?: unknown })?.headers;
    if (typeof urlInput !== 'string' || urlInput.length === 0) {
      return { status: 'FAILED', errorCode: 'WEBHOOK_URL_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.url is required.' };
    }

    let validatedUrl: URL;
    try {
      validatedUrl = await validateMcpRemoteUrl(urlInput);
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'URL failed SSRF validation.';
      return { status: 'FAILED', errorCode: 'WEBHOOK_URL_BLOCKED', errorClass: 'SSRF_BLOCKED', safeMessage };
    }

    try {
      const response = await guardedFetch(validatedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof extraHeaders === 'object' && extraHeaders !== null ? (extraHeaders as Record<string, string>) : {}),
        },
        body: JSON.stringify(payload ?? {}),
        signal: context.cancellationSignal,
      });
      const text = await response.text();
      let parsedBody: unknown = text;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        // non-JSON response body is returned as raw text
      }
      context.writeTraceMetadata({ type: 'WEBHOOK_NOTIFY_RESULT', payload: { status: response.status } });
      return { status: 'SUCCEEDED', output: { status: response.status, ok: response.ok, body: parsedBody as never } };
    } catch (error) {
      if (context.cancellationSignal.aborted) {
        return { status: 'FAILED', errorCode: 'WEBHOOK_CANCELLED', errorClass: 'CANCELLED', safeMessage: 'Webhook request was cancelled.' };
      }
      const safeMessage = error instanceof Error ? error.message : 'Webhook request failed.';
      return { status: 'FAILED', errorCode: 'WEBHOOK_NOTIFY_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};
