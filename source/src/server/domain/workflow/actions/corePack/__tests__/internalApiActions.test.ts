import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerCoreActionPack } from '../index';
import { __resetActionRegistryForTests, getActionDefinition, resolveExactProvider } from '../../registry';
import { INTERNAL_API_CALL_ACTION_KEY, integrationInternalApiCallExecutor } from '../internalApiActions';
import { RESERVED_SCHEDULED_START_FUNCTION_ID } from '../../../../../../shared/api/contracts/server-functions/reservedFunctions';

vi.mock('../../../../functions/functionRepository', () => ({
  findManagedFunctionById: vi.fn(),
}));

vi.mock('../../../../../../core/api/sandbox', () => ({
  executeServerFunction: vi.fn(),
}));

import { findManagedFunctionById } from '../../../../functions/functionRepository';
import { executeServerFunction } from '../../../../../../core/api/sandbox';

const findManagedFunctionByIdMock = vi.mocked(findManagedFunctionById);
const executeServerFunctionMock = vi.mocked(executeServerFunction);

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('integration.internal-api-call', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    registerCoreActionPack();
    findManagedFunctionByIdMock.mockReset();
    executeServerFunctionMock.mockReset();
  });

  it('registers as an AVAILABLE core provider', () => {
    expect(getActionDefinition(INTERNAL_API_CALL_ACTION_KEY, '1')?.definition.availability).toBe('AVAILABLE');
    expect(() => resolveExactProvider(INTERNAL_API_CALL_ACTION_KEY, '1', 'core', '1')).not.toThrow();
  });

  it('fails validation when functionId is missing', async () => {
    const result = await integrationInternalApiCallExecutor.execute(fakeContext, {}, { payload: {} });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'INTERNAL_API_FUNCTION_REQUIRED' });
    expect(executeServerFunctionMock).not.toHaveBeenCalled();
  });

  it('rejects the reserved scheduled-start function', async () => {
    const result = await integrationInternalApiCallExecutor.execute(fakeContext, {}, {
      functionId: RESERVED_SCHEDULED_START_FUNCTION_ID,
    });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'INTERNAL_API_FUNCTION_RESERVED' });
  });

  it('fails when the managed function is missing', async () => {
    findManagedFunctionByIdMock.mockResolvedValue(null);
    const result = await integrationInternalApiCallExecutor.execute(fakeContext, {}, { functionId: 'math.missing' });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'INTERNAL_API_FUNCTION_NOT_FOUND' });
  });

  it('returns status/ok/body from an in-process Server Function invoke', async () => {
    findManagedFunctionByIdMock.mockResolvedValue({
      id: 'math.sum-two-numbers',
      method: 'POST',
      code: 'res.json({ sum: 3 })',
      language: 'ts',
      timeout_ms: 1500,
    } as never);
    executeServerFunctionMock.mockImplementation(async (_code, _req, res) => {
      (res as { json: (payload: unknown) => void }).json({ sum: 3 });
    });

    const result = await integrationInternalApiCallExecutor.execute(fakeContext, {}, {
      functionId: 'math.sum-two-numbers',
      payload: { a: 1, b: 2 },
    });

    expect(result).toEqual({
      status: 'SUCCEEDED',
      output: {
        functionId: 'math.sum-two-numbers',
        status: 200,
        ok: true,
        body: { sum: 3 },
      },
    });
    expect(executeServerFunctionMock).toHaveBeenCalledOnce();
  });
});
