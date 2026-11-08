import { executeServerFunction } from '../../../core/api/sandbox';
import { buildRequestFromTestPayload } from '../../../shared/server-functions/testPayloadRequest';
import { findManagedFunctionById } from '../../domain/functions/functionRepository';
import { RESERVED_SCHEDULED_START_FUNCTION_ID } from '../../domain/workflow/publication/bindingAdapters/scheduleBindingAdapter';
import { startWorkflowInstance } from '../../domain/workflow/engine/startService';
import type { EdgeDbQueryFn } from '../server-function.service';

type JobEdgeExecutionResult = {
  statusCode: number;
  body: unknown;
};

const createMockResponse = () => {
  let statusCode = 200;
  let headersSent = false;
  let body: unknown = null;

  const res = {
    status(code: number) {
      statusCode = Number(code) || 200;
      return res;
    },
    json(payload: unknown) {
      headersSent = true;
      body = payload;
      return res;
    },
    send(payload: unknown) {
      headersSent = true;
      body = payload;
      return res;
    },
    get headersSent() {
      return headersSent;
    },
    get captured() {
      return { statusCode, body };
    },
  };

  return res;
};

/**
 * WFV2-3: the reserved SCHEDULE-start function never runs through the sandbox — see
 * `scheduleBindingAdapter.ts`'s module doc for why (no sandbox-to-engine bridge exists). Intercept
 * it here, before `executeServerFunction` ever compiles/runs its placeholder code.
 */
const runReservedScheduledStart = async (payload: Record<string, unknown>): Promise<JobEdgeExecutionResult> => {
  const workflowRevisionId = Number(payload.workflowRevisionId);
  if (!Number.isFinite(workflowRevisionId)) {
    throw new Error('Scheduled workflow start job payload is missing a numeric workflowRevisionId.');
  }

  const result = await startWorkflowInstance({
    workflowRevisionId,
    input: null,
    startedByType: 'SYSTEM',
    startedById: null,
    startType: 'SCHEDULE',
  });

  return { statusCode: 200, body: { success: true, instanceId: result.instance.id } };
};

export const executeManagedFunctionForJob = async (
  functionId: string,
  payload: Record<string, unknown>,
  edgeDbQuery: EdgeDbQueryFn,
): Promise<JobEdgeExecutionResult> => {
  if (functionId === RESERVED_SCHEDULED_START_FUNCTION_ID) {
    return runReservedScheduledStart(payload);
  }

  const managed = await findManagedFunctionById(functionId);
  if (!managed) {
    throw new Error(`Managed function "${functionId}" was not found.`);
  }

  const request = buildRequestFromTestPayload(managed.method || 'POST', payload);

  const req = {
    method: request.method,
    body: request.body,
    query: request.query,
    params: request.params,
    headers: request.headers,
  };

  const res = createMockResponse();

  await executeServerFunction(managed.code, req, res, {
    timeoutMs: managed.timeout_ms,
    language: managed.language,
    dbQuery: edgeDbQuery,
  });

  const captured = res.captured;
  if (!res.headersSent) {
    return { statusCode: 200, body: { success: true } };
  }

  if (captured.statusCode >= 400) {
    const message = typeof captured.body === 'object' && captured.body
      ? String((captured.body as Record<string, unknown>).error || JSON.stringify(captured.body))
      : String(captured.body);
    throw new Error(message || `Edge function failed with status ${captured.statusCode}.`);
  }

  return captured;
};
