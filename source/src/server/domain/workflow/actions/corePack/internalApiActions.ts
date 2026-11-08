import { createEdgeDbQueryExecutor } from '../../../../../core/database/EdgeDbRouter';
import { executeServerFunction } from '../../../../../core/api/sandbox';
import { RESERVED_SCHEDULED_START_FUNCTION_ID } from '../../../../../shared/api/contracts/server-functions/reservedFunctions';
import { buildRequestFromTestPayload } from '../../../../../shared/server-functions/testPayloadRequest';
import { SETTINGS_PATH } from '../../../../config/settingsFile';
import { getDataSourcesFromSettings } from '../../../../db/dataSourcesStore';
import { findManagedFunctionById } from '../../../functions/functionRepository';
import type { JsonValue } from '../../awm/types';
import type { ActionDefinition, ActionExecutor } from '../types';

/**
 * In-process call to a managed Server Function. Outbound `integration.http-request` cannot hit
 * the app's own `/api/*` (SSRF blocks loopback); this Action uses the same sandbox path Jobs use
 * (`executeServerFunction`) instead of HTTP.
 */

const edgeDbQuery = createEdgeDbQueryExecutor({
  getDataSources: () => getDataSourcesFromSettings(SETTINGS_PATH),
});

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

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

export const INTERNAL_API_CALL_ACTION_KEY = 'integration.internal-api-call';

export const integrationInternalApiCallDefinition: ActionDefinition = {
  key: INTERNAL_API_CALL_ACTION_KEY,
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      functionId: {
        type: 'string',
        title: 'Server function',
        description: 'Managed Server Function id (folder.name).',
      },
      payload: {
        type: 'object',
        title: 'Payload',
        description: 'Request payload. Same envelope as the function Test Console (body / query / params, or a flat JSON object).',
      },
    },
    required: ['functionId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      functionId: { type: 'string' },
      status: { type: 'number', title: 'HTTP status code' },
      ok: { type: 'boolean', description: 'True when status is 200-299.' },
      body: { description: 'JSON body from res.json, or raw text from res.send.' },
    },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'SUPPORTED',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'HIGH',
  requiredCapabilities: ['server-functions.invoke'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['integration', 'server-functions'],
};

export const integrationInternalApiCallExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const functionId = typeof record.functionId === 'string' ? record.functionId.trim() : '';
    if (!functionId) {
      return {
        status: 'FAILED',
        errorCode: 'INTERNAL_API_FUNCTION_REQUIRED',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.functionId (non-empty string).',
      };
    }
    if (functionId === RESERVED_SCHEDULED_START_FUNCTION_ID) {
      return {
        status: 'FAILED',
        errorCode: 'INTERNAL_API_FUNCTION_RESERVED',
        errorClass: 'VALIDATION',
        safeMessage: 'Reserved platform functions cannot run as an Internal API call.',
      };
    }

    const managed = await findManagedFunctionById(functionId);
    if (!managed) {
      return {
        status: 'FAILED',
        errorCode: 'INTERNAL_API_FUNCTION_NOT_FOUND',
        errorClass: 'NOT_FOUND',
        safeMessage: `Managed function "${functionId}" was not found.`,
      };
    }

    const payload = asRecord(record.payload) ?? {};
    const request = buildRequestFromTestPayload(managed.method || 'POST', payload);
    const req = {
      method: request.method,
      body: request.body,
      query: request.query,
      params: request.params,
      headers: request.headers,
    };
    const res = createMockResponse();

    try {
      await executeServerFunction(managed.code, req, res, {
        timeoutMs: managed.timeout_ms,
        language: managed.language,
        dbQuery: edgeDbQuery,
      });
    } catch (error) {
      if (context.cancellationSignal.aborted) {
        return {
          status: 'FAILED',
          errorCode: 'INTERNAL_API_CANCELLED',
          errorClass: 'CANCELLED',
          safeMessage: 'Internal API call was cancelled.',
        };
      }
      const safeMessage = error instanceof Error ? error.message : 'Internal API call failed.';
      return {
        status: 'FAILED',
        errorCode: 'INTERNAL_API_EXECUTION_FAILED',
        errorClass: 'EXECUTION_ERROR',
        safeMessage,
      };
    }

    const captured = res.captured;
    const statusCode = res.headersSent ? captured.statusCode : 200;
    const body = res.headersSent ? captured.body : { success: true };
    context.writeTraceMetadata({
      type: 'INTERNAL_API_CALL_RESULT',
      payload: { functionId, status: statusCode },
    });

    return {
      status: 'SUCCEEDED',
      output: {
        functionId,
        status: statusCode,
        ok: statusCode >= 200 && statusCode < 300,
        body: body as never,
      },
    };
  },
};
