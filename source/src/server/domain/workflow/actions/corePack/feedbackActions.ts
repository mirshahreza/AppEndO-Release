import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';
import { SETTINGS_PATH } from '../../../../config/settingsFile';
import { FeedbackService, FeedbackServiceError } from '../../../../services/feedback/feedback.service';
import { findUserWorkflowSummary } from '../../../users/userRepository';
import type { AuthRequestContext } from '../../../../middleware/auth.middleware';

/**
 * Feedback Action pack (p-89 ACT-5) — in-process wrappers over FeedbackService.
 * Workflow HTTP cannot call `/api/feedback/*` (SSRF blocks loopback).
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const parsePositiveId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

let serviceSingleton: FeedbackService | null = null;
const getService = (): FeedbackService => {
  if (!serviceSingleton) serviceSingleton = new FeedbackService(SETTINGS_PATH);
  return serviceSingleton;
};

export const __resetFeedbackActionServiceForTests = (): void => {
  serviceSingleton = null;
};

const buildAuth = async (actorUserId: number): Promise<AuthRequestContext | null> => {
  const summary = await findUserWorkflowSummary(actorUserId);
  if (!summary) return null;
  const roles = summary.roles.map((r) => r.toUpperCase());
  return {
    userId: actorUserId,
    email: summary.email ?? '',
    role: roles[0] ?? 'USER',
    roles,
  };
};

const mapServiceError = (error: unknown) => {
  if (error instanceof FeedbackServiceError) {
    return {
      status: 'FAILED' as const,
      errorCode: error.code,
      errorClass: error.status === 404 ? 'NOT_FOUND' : error.status === 403 ? 'AUTHORIZATION' : 'EXTERNAL_ERROR',
      safeMessage: error.message,
    };
  }
  const safeMessage = error instanceof Error ? error.message : 'Feedback action failed.';
  return {
    status: 'FAILED' as const,
    errorCode: 'FEEDBACK_ACTION_FAILED',
    errorClass: 'EXTERNAL_ERROR',
    safeMessage,
  };
};

const ticketSummary = (ticket: Record<string, unknown>) => ({
  id: ticket.id ?? null,
  subject: ticket.subject ?? null,
  title: ticket.title ?? null,
  status: ticket.status ?? null,
  priority: ticket.priority ?? null,
  type: ticket.type ?? null,
  messageCount: ticket.messageCount ?? null,
  assigneeRoleName: ticket.assigneeRoleName ?? null,
  assigneeUserId: ticket.assigneeUserId ?? null,
});

export const feedbackGetDefinition: ActionDefinition = {
  key: 'feedback.get',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      feedbackId: { type: ['integer', 'string'], title: 'Feedback id' },
    },
    required: ['feedbackId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: {},
      subject: {},
      status: { type: 'string' },
      priority: {},
      title: {},
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['feedback.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['feedback'],
};

export const feedbackGetExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const feedbackId = parsePositiveId((input as { feedbackId?: unknown } | null)?.feedbackId);
    if (!feedbackId) {
      return {
        status: 'FAILED',
        errorCode: 'FEEDBACK_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.feedbackId (positive integer).',
      };
    }
    try {
      const detail = await getService().getTicketDetail(feedbackId, undefined, { skipViewAuth: true });
      context.writeTraceMetadata({ type: 'FEEDBACK_GET', payload: { feedbackId, status: detail.status } });
      return { status: 'SUCCEEDED', output: { ...ticketSummary(detail as unknown as Record<string, unknown>), ticket: detail } };
    } catch (error) {
      return mapServiceError(error);
    }
  },
};

export const feedbackUpdateStatusDefinition: ActionDefinition = {
  key: 'feedback.update-status',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      feedbackId: { type: ['integer', 'string'] },
      status: { type: 'string' },
      priority: { type: 'string' },
      actorUserId: { type: ['integer', 'string'], description: 'Admin/responder user performing the update.' },
    },
    required: ['feedbackId', 'status', 'actorUserId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: {},
      status: { type: 'string' },
      priority: {},
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['feedback.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['feedback'],
};

export const feedbackUpdateStatusExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const feedbackId = parsePositiveId(record.feedbackId);
    const actorUserId = parsePositiveId(record.actorUserId);
    const status = typeof record.status === 'string' ? record.status.trim() : '';
    if (!feedbackId || !actorUserId || !status) {
      return {
        status: 'FAILED',
        errorCode: 'FEEDBACK_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.feedbackId, status, and actorUserId.',
      };
    }
    const auth = await buildAuth(actorUserId);
    if (!auth) {
      return {
        status: 'FAILED',
        errorCode: 'FEEDBACK_ACTOR_NOT_FOUND',
        errorClass: 'NOT_FOUND',
        safeMessage: `Actor user ${actorUserId} was not found.`,
      };
    }
    try {
      const detail = await getService().updateStatus(
        feedbackId,
        {
          status: status as never,
          priority: typeof record.priority === 'string' ? record.priority as never : undefined,
        },
        auth,
      );
      context.writeTraceMetadata({ type: 'FEEDBACK_UPDATE_STATUS', payload: { feedbackId, status: detail.status } });
      return { status: 'SUCCEEDED', output: ticketSummary(detail as unknown as Record<string, unknown>) };
    } catch (error) {
      return mapServiceError(error);
    }
  },
};

export const feedbackPostMessageDefinition: ActionDefinition = {
  key: 'feedback.post-message',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      feedbackId: { type: ['integer', 'string'] },
      body: { type: 'string' },
      kind: { type: 'string', description: 'SUBMITTER | STAFF | INTERNAL' },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['feedbackId', 'body', 'actorUserId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: {},
      status: { type: 'string' },
      messageCount: {},
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['feedback.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['feedback'],
};

export const feedbackPostMessageExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const feedbackId = parsePositiveId(record.feedbackId);
    const actorUserId = parsePositiveId(record.actorUserId);
    const body = typeof record.body === 'string' ? record.body : '';
    if (!feedbackId || !actorUserId || !body.trim()) {
      return {
        status: 'FAILED',
        errorCode: 'FEEDBACK_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.feedbackId, body, and actorUserId.',
      };
    }
    const auth = await buildAuth(actorUserId);
    if (!auth) {
      return {
        status: 'FAILED',
        errorCode: 'FEEDBACK_ACTOR_NOT_FOUND',
        errorClass: 'NOT_FOUND',
        safeMessage: `Actor user ${actorUserId} was not found.`,
      };
    }
    const kind = typeof record.kind === 'string' ? record.kind : 'STAFF';
    try {
      const detail = await getService().postMessage(
        feedbackId,
        { body, kind: kind as never },
        auth,
        `wf-${context.workflowInstanceId}-${context.nodeInstanceId}`,
      );
      context.writeTraceMetadata({ type: 'FEEDBACK_POST_MESSAGE', payload: { feedbackId, kind } });
      return { status: 'SUCCEEDED', output: ticketSummary(detail as unknown as Record<string, unknown>) };
    } catch (error) {
      return mapServiceError(error);
    }
  },
};
