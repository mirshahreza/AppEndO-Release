import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeGetServerFunction,
  executeListServerFunctions,
  executeTestServerFunction,
  GET_SERVER_FUNCTION_TOOL_NAME,
  LIST_SERVER_FUNCTIONS_TOOL_NAME,
  TEST_SERVER_FUNCTION_TOOL_NAME,
} from '../serverFunctionTools';

const mockFunctions = [
  {
    id: 'custom.hello',
    name: 'Hello',
    folder: 'custom',
    method: 'GET',
    path: '/api/custom/hello',
    code: 'async function handler() { return { success: true, data: "ok" }; }\nvoid handler();',
    language: 'ts',
    test_payload: '{"name":"world"}',
    runtime_version: 'v20.x',
    memory_limit: 128,
    timeout_ms: 1500,
    cache_enabled: false,
    cache_ttl_ms: 180000,
    cache_by_param: false,
    cache_by_user: false,
    engine_type: 'SANDBOX_JS',
    metadata_json: null,
    access_control: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    created_by: null,
    updated_by: null,
  },
  {
    id: 'math.sum-two',
    name: 'Sum Two',
    folder: 'math',
    method: 'POST',
    path: '/api/math/sum-two',
    code: 'async function handler() { return { success: true }; }\nvoid handler();',
    language: 'ts',
    test_payload: '{"a":0,"b":0}',
    runtime_version: 'v20.x',
    memory_limit: 128,
    timeout_ms: 1500,
    cache_enabled: false,
    cache_ttl_ms: 180000,
    cache_by_param: false,
    cache_by_user: false,
    engine_type: 'SANDBOX_JS',
    metadata_json: JSON.stringify({
      derived: {
        codeFingerprint: 'fnv1a:test',
        generatedAt: '2026-06-01T00:00:00.000Z',
        requestExample: { a: 0, b: 0 },
        docHints: {
          validationFields: ['a', 'b'],
          outputFields: ['sum'],
          queryFields: [],
          paramFields: [],
        },
      },
    }),
    access_control: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    created_by: null,
    updated_by: null,
  },
  {
    id: 'scheduler.sample-heartbeat',
    name: 'Sample Heartbeat',
    folder: 'scheduler',
    method: 'POST',
    path: '/api/scheduler/sample-heartbeat',
    code: 'async function handler() { const payload = req.body || {}; return res.json({ success: true, payload }); }\nhandler();',
    language: 'ts',
    test_payload: '{}',
    runtime_version: 'v20.x',
    memory_limit: 128,
    timeout_ms: 3000,
    cache_enabled: false,
    cache_ttl_ms: 180000,
    cache_by_param: false,
    cache_by_user: false,
    engine_type: 'SANDBOX_JS',
    metadata_json: JSON.stringify({
      derived: {
        codeFingerprint: 'fnv1a:test',
        generatedAt: '2026-07-12T21:27:34.675Z',
        requestExample: {},
        docHints: {
          validationFields: [],
          outputFields: [],
          queryFields: [],
          paramFields: [],
        },
      },
    }),
    access_control: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    created_at: '2026-07-11T22:23:56.157Z',
    updated_at: '2026-07-12T21:27:34.680Z',
    created_by: null,
    updated_by: null,
  },
];

vi.mock('../../../../../domain/functions/functionRepository', () => ({
  listManagedFunctions: vi.fn(async () => mockFunctions),
  findManagedFunctionById: vi.fn(async (functionId: string) => (
    mockFunctions.find((fn) => fn.id === functionId) ?? null
  )),
}));

vi.mock('../../../../../../core/api/sandbox', () => ({
  executeServerFunction: vi.fn(async (_code: string, _req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(400).json({ success: false, error: 'Missing serpapi key' });
  }),
}));

vi.mock('../../../../jobs/jobServerFunctionExecutor', () => ({
  executeManagedFunctionForJob: vi.fn(async () => ({
    statusCode: 200,
    body: { success: true, data: 'ok' },
  })),
}));

describe('appendo-server-functions pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers edge pack tools', () => {
    const registry = createPhase1ToolRegistry('agent', ['edge']);
    registerBuiltinCapabilityPacks(registry, ['appendo-server-functions']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-server-functions').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('lists server functions with filters', async () => {
    const all = await executeListServerFunctions({});
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.data?.totalCount).toBe(mockFunctions.length);
    }

    const filtered = await executeListServerFunctions({ folder: 'custom' });
    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.data?.items[0]?.id).toBe('custom.hello');
    }
  });

  it('loads server function metadata and source', async () => {
    const result = await executeGetServerFunction({ functionId: 'custom.hello' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.path).toBe('/api/custom/hello');
      expect(result.data?.source).toContain('handler');
      expect(result.data?.contract).toBeUndefined();
    }
  });

  it('surfaces the derived contract (validation/output fields) when metadata is present', async () => {
    const result = await executeGetServerFunction({ functionId: 'math.sum-two' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.contract?.validationFields).toEqual(['a', 'b']);
      expect(result.data?.contract?.outputFields).toEqual(['sum']);
      expect(result.data?.contract?.hasNoDetectedFields).toBe(false);
      expect(result.summary).not.toContain('No input/output fields');
    }
  });

  it('warns the agent when no fields were statically detected (e.g. a raw req.body echo)', async () => {
    const result = await executeGetServerFunction({ functionId: 'scheduler.sample-heartbeat' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.contract?.hasNoDetectedFields).toBe(true);
      expect(result.summary).toContain('No input/output fields were statically detected');
    }
  });

  it('tests server function execution', async () => {
    const result = await executeTestServerFunction({ functionId: 'custom.hello' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.statusCode).toBe(200);
    }
  });

  it('runs unsaved editor source like Test Console Execute', async () => {
    const result = await executeTestServerFunction({
      functionId: 'custom.hello',
      source: 'edgeRes.status(400).json({ error: "Missing serpapi key" });',
      payload: { q: 'news' },
    });
    expect(result.ok).toBe(false);
    expect(result.data?.statusCode).toBe(400);
    expect(result.data?.usedUnsavedSource).toBe(true);
    expect(result.data?.body).toEqual({ success: false, error: 'Missing serpapi key' });
  });

  it('exposes catalog tool names', () => {
    expect(LIST_SERVER_FUNCTIONS_TOOL_NAME).toBe('list_server_functions');
    expect(GET_SERVER_FUNCTION_TOOL_NAME).toBe('get_server_function');
    expect(TEST_SERVER_FUNCTION_TOOL_NAME).toBe('test_server_function');
  });
});
