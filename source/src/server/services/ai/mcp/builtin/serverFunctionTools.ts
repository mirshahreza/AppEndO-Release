import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import { executeServerFunction } from '../../../../../core/api/sandbox';
import { buildRequestFromTestPayload } from '../../../../../shared/server-functions/testPayloadRequest';
import type { EdgeDbQueryFn } from '../../../server-function.service';
import { listManagedFunctions, findManagedFunctionById } from '../../../../domain/functions/functionRepository';
import { executeManagedFunctionForJob } from '../../../jobs/jobServerFunctionExecutor';
import { parseMetadataRecord } from '../../../../../shared/api/server-functions/buildFunctionDerivedMetadata';

export const LIST_SERVER_FUNCTIONS_TOOL_NAME = 'list_server_functions';
export const GET_SERVER_FUNCTION_TOOL_NAME = 'get_server_function';
export const TEST_SERVER_FUNCTION_TOOL_NAME = 'test_server_function';

const EDGE_SOURCE_PREVIEW_MAX = 12_000;

const noopDbQuery: EdgeDbQueryFn = async () => ({ data: [], count: 0 });

const createCaptureResponse = () => {
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
      return { statusCode, body: headersSent ? body : { success: true } };
    },
  };

  return res;
};

type ServerFunctionSummary = {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  engineType: string;
  language: string;
  runtimeVersion: string;
  timeoutMs: number;
  updatedAt: string;
};

const summarizeFunction = (
  fn: NonNullable<Awaited<ReturnType<typeof findManagedFunctionById>>>,
): ServerFunctionSummary => ({
  id: fn.id,
  name: fn.name,
  folder: fn.folder,
  method: fn.method,
  path: fn.path,
  engineType: fn.engine_type,
  language: fn.language,
  runtimeVersion: fn.runtime_version,
  timeoutMs: fn.timeout_ms,
  updatedAt: fn.updated_at,
});

export const executeListServerFunctions = async (args: Record<string, unknown>) => {
  const folderFilter = typeof args.folder === 'string' ? args.folder.trim().toLowerCase() : '';
  const pathFilter = typeof args.pathContains === 'string' ? args.pathContains.trim().toLowerCase() : '';

  let items = (await listManagedFunctions()).map(summarizeFunction);

  if (folderFilter) {
    items = items.filter((item) => item.folder.toLowerCase().includes(folderFilter));
  }
  if (pathFilter) {
    items = items.filter((item) => item.path.toLowerCase().includes(pathFilter));
  }

  items.sort((left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name));

  return {
    ok: true as const,
    summary: `Listed ${items.length} managed server function(s).`,
    data: { items, totalCount: items.length },
  };
};

export const executeGetServerFunction = async (args: Record<string, unknown>) => {
  const functionId = typeof args.functionId === 'string' ? args.functionId.trim() : '';
  if (!functionId) {
    return {
      ok: false as const,
      summary: 'functionId is required.',
      error: 'missing_function_id',
    };
  }

  const fn = await findManagedFunctionById(functionId);
  if (!fn) {
    return {
      ok: false as const,
      summary: `Edge function "${functionId}" was not found.`,
      error: 'function_not_found',
    };
  }

  const includeSource = args.includeSource !== false;
  const source = includeSource
    ? (fn.code.length > EDGE_SOURCE_PREVIEW_MAX
      ? `${fn.code.slice(0, EDGE_SOURCE_PREVIEW_MAX)}\n/* …truncated… */`
      : fn.code)
    : undefined;

  // Statically-derived contract (see buildFunctionDerivedMetadata.ts) — populated whenever the
  // function is saved. Give the agent this structured signal directly instead of forcing it to
  // reverse-engineer input/output shape from raw source alone (root cause of GAP-2/AppEndoo V4).
  const derived = parseMetadataRecord(fn.metadata_json)?.derived;
  const contract = derived
    ? {
      requestExample: derived.requestExample,
      validationFields: derived.docHints.validationFields,
      outputFields: derived.docHints.outputFields,
      queryFields: derived.docHints.queryFields,
      paramFields: derived.docHints.paramFields,
      summary: derived.docHints.summary,
      hasNoDetectedFields: (
        derived.docHints.validationFields.length === 0
        && derived.docHints.outputFields.length === 0
        && derived.docHints.queryFields.length === 0
        && derived.docHints.paramFields.length === 0
      ),
    }
    : undefined;

  return {
    ok: true as const,
    summary: contract?.hasNoDetectedFields
      ? `Loaded server function "${fn.name}" (${fn.method} ${fn.path}). No input/output fields were statically detected — confirm the real shape with test_server_function or by reading the source before binding a UI to specific fields.`
      : `Loaded server function "${fn.name}" (${fn.method} ${fn.path}).`,
    data: {
      ...summarizeFunction(fn),
      testPayload: fn.test_payload,
      contract,
      source,
      sourceTruncated: includeSource && fn.code.length > EDGE_SOURCE_PREVIEW_MAX,
    },
  };
};

export const executeTestServerFunction = async (args: Record<string, unknown>) => {
  const functionId = typeof args.functionId === 'string' ? args.functionId.trim() : '';
  const sourceOverride = typeof args.source === 'string' ? args.source : '';
  if (!functionId) {
    return {
      ok: false as const,
      summary: 'functionId is required.',
      error: 'missing_function_id',
    };
  }

  let payload: Record<string, unknown> = {};
  if (args.payload !== undefined) {
    if (!args.payload || typeof args.payload !== 'object' || Array.isArray(args.payload)) {
      return {
        ok: false as const,
        summary: 'payload must be a JSON object when provided.',
        error: 'invalid_payload',
      };
    }
    payload = args.payload as Record<string, unknown>;
  } else {
    const fn = await findManagedFunctionById(functionId);
    if (fn?.test_payload) {
      try {
        const parsed = JSON.parse(fn.test_payload);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          payload = parsed as Record<string, unknown>;
        }
      } catch {
        // ignore invalid stored test payload
      }
    }
  }

  const usedUnsavedSource = Boolean(sourceOverride.trim());

  try {
    if (usedUnsavedSource) {
      const managed = await findManagedFunctionById(functionId);
      const method = managed?.method || 'POST';
      const request = buildRequestFromTestPayload(method, payload);
      const req = {
        method: request.method,
        body: request.body,
        query: request.query,
        params: request.params,
        headers: request.headers,
      };
      const res = createCaptureResponse();
      await executeServerFunction(sourceOverride, req, res, {
        timeoutMs: managed?.timeout_ms ?? 5000,
        language: managed?.language ?? 'ts',
        dbQuery: noopDbQuery,
      });
      const captured = res.captured;
      const ok = captured.statusCode < 400;
      return {
        ok,
        summary: `Executed unsaved editor source for "${functionId}" with status ${captured.statusCode}.`,
        data: {
          functionId,
          statusCode: captured.statusCode,
          body: captured.body,
          usedUnsavedSource: true,
        },
        ...(ok ? {} : { error: 'handler_error' }),
      };
    }

    const result = await executeManagedFunctionForJob(functionId, payload, noopDbQuery);
    return {
      ok: true as const,
      summary: `Executed "${functionId}" with status ${result.statusCode}.`,
      data: {
        functionId,
        statusCode: result.statusCode,
        body: result.body,
        usedUnsavedSource: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      summary: `Edge function test failed: ${message}`,
      error: 'execution_failed',
    };
  }
};

export const createServerFunctionTools = (): NativeToolDefinition[] => [
  {
    name: LIST_SERVER_FUNCTIONS_TOOL_NAME,
    description: 'List managed server functions with optional folder or path filters.',
    group: 'edge',
    parameters: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Optional folder substring filter.' },
        pathContains: { type: 'string', description: 'Optional path substring filter.' },
      },
    },
    execute: async (args) => executeListServerFunctions(args),
  },
  {
    name: GET_SERVER_FUNCTION_TOOL_NAME,
    description: 'Load one server function by exact id: metadata, source code, and a statically-derived `contract` (validationFields/outputFields/queryFields/paramFields + a sample requestExample) extracted from the real code, not guessed. Use this before drafting any UI bound to a function — do not assume field shape from the function name. If `contract.hasNoDetectedFields` is true, no fields could be statically detected (e.g. a handler that only echoes req.body) — call test_server_function or read the source before binding specific fields, or ask the user what fields they need. Use list_server_functions first if you only know a partial name or folder.',
    group: 'edge',
    parameters: {
      type: 'object',
      properties: {
        functionId: { type: 'string', description: 'Managed function id.' },
        includeSource: { type: 'boolean', description: 'Include source preview (default true).' },
      },
      required: ['functionId'],
    },
    execute: async (args) => executeGetServerFunction(args),
  },
  {
    name: TEST_SERVER_FUNCTION_TOOL_NAME,
    description: 'Execute a server function the same way Test Console Execute does. Pass `source` to run unsaved editor code from the snapshot; omit source to run the last saved function. Optional `payload` defaults to stored test_payload (or snapshot testPayload). Inspect statusCode and body — 4xx is a handler result to fix, not a reason to skip the body.',
    group: 'edge',
    parameters: {
      type: 'object',
      properties: {
        functionId: { type: 'string', description: 'Managed function id.' },
        payload: { type: 'object', description: 'Optional request body for the function.' },
        source: { type: 'string', description: 'Unsaved editor source from the current snapshot. When set, runs this code instead of the last saved function.' },
      },
      required: ['functionId'],
    },
    execute: async (args) => executeTestServerFunction(args),
  },
];
