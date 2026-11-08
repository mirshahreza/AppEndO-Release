import { ingestWorkflowEvent } from '../../engine/eventIngressService';
import type { JsonValue } from '../../awm/types';
import type { ActionDefinition, ActionExecutor } from '../types';

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

export const integrationEventPublishDefinition: ActionDefinition = {
  key: 'integration.event-publish',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      eventName: { type: 'string', title: 'Event name', description: 'Must match WAIT_EVENT.eventName or an EVENT start binding.' },
      payload: { title: 'Payload' },
      correlation: { title: 'Correlation value', description: 'Scalar used to match WAIT_EVENT correlation hashes.' },
      deduplicationKey: { type: 'string', title: 'Deduplication key (optional)' },
      providerEventId: { type: 'string' },
    },
    required: ['eventName'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      inboxId: { type: 'integer' },
      wasCreated: { type: 'boolean' },
      matchedWait: { type: 'boolean' },
      startedWorkflows: { type: 'integer' },
    },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['workflow.event'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['integration', 'event'],
};

export const integrationEventPublishExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const rec = (input ?? {}) as {
      eventName?: unknown; payload?: unknown; correlation?: unknown; deduplicationKey?: unknown; providerEventId?: unknown;
    };
    if (typeof rec.eventName !== 'string' || rec.eventName.trim().length === 0) {
      return { status: 'FAILED', errorCode: 'EVENT_NAME_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.eventName is required.' };
    }
    try {
      const outcome = await ingestWorkflowEvent({
        eventName: rec.eventName.trim(),
        eventSourceIdentity: `workflow:${context.workflowInstanceId}`,
        payload: (rec.payload ?? null) as JsonValue,
        correlationValue: rec.correlation as JsonValue | undefined,
        deduplicationKey: typeof rec.deduplicationKey === 'string' ? rec.deduplicationKey : undefined,
        providerEventId: typeof rec.providerEventId === 'string' ? rec.providerEventId : undefined,
        leaseOwnerId: `action:${context.nodeInstanceId}`,
      });
      return {
        status: 'SUCCEEDED',
        output: {
          inboxId: outcome.inbox.id,
          wasCreated: outcome.wasCreated,
          matchedWait: outcome.correlation?.matchedWaitId !== undefined,
          startedWorkflows: outcome.startFanout?.started ?? 0,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Event publish failed.';
      return { status: 'FAILED', errorCode: 'EVENT_PUBLISH_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};
