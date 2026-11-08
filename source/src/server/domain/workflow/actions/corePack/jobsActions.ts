import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';
import { enqueueServerFunctionJob } from '../../../jobs/jobRepository';
import { findManagedFunctionById } from '../../../functions/functionRepository';

/**
 * Jobs Action pack (p-89 ACT-10) — enqueue a real `base_jobs` row for a managed Server Function.
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

export const jobsEnqueueDefinition: ActionDefinition = {
  key: 'jobs.enqueue',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      functionId: { type: 'string', description: 'Managed Server Function id (e.g. cms-settings.cms-settings-list).' },
      title: { type: 'string' },
      payload: { type: 'object' },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['functionId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      jobId: { type: 'integer' },
      functionId: { type: 'string' },
      status: { type: 'string' },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['jobs.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['jobs'],
};

export const jobsEnqueueExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const functionId = typeof record.functionId === 'string' ? record.functionId.trim() : '';
    if (!functionId) {
      return {
        status: 'FAILED',
        errorCode: 'JOBS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.functionId (non-empty string).',
      };
    }
    const managed = await findManagedFunctionById(functionId);
    if (!managed) {
      return {
        status: 'FAILED',
        errorCode: 'JOBS_FUNCTION_NOT_FOUND',
        errorClass: 'NOT_FOUND',
        safeMessage: `Managed function "${functionId}" was not found.`,
      };
    }
    const title = typeof record.title === 'string' ? record.title : undefined;
    const payload = asRecord(record.payload) ?? {};
    const actorUserId = parsePositiveId(record.actorUserId);
    try {
      const jobId = await enqueueServerFunctionJob({
        functionId,
        title,
        payload,
        createdBy: actorUserId,
        metadata: {
          source: 'manual',
          trigger: 'manual',
          triggeredAt: new Date().toISOString(),
        },
      });
      context.writeTraceMetadata({ type: 'JOBS_ENQUEUE', payload: { jobId, functionId } });
      return {
        status: 'SUCCEEDED',
        output: {
          jobId,
          functionId,
          status: 'pending',
          title: title ?? null,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Job enqueue failed.';
      return {
        status: 'FAILED',
        errorCode: 'JOBS_ENQUEUE_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};
