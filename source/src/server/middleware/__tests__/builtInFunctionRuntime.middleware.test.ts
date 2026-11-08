import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBuiltInRuntimePolicy } from '../builtInFunctionRuntime.middleware';
import { INITIAL_FUNCTIONS } from '../../../shared/api/contracts/server-functions/initialFunctions';
import { mergeBuiltinFunctionDefaults } from '../../services/builtinFunctionRegistry.service';

const cacheGet = vi.fn();
const cacheSet = vi.fn();

vi.mock('../../../core/cache/CacheManager', () => ({
  cacheManager: {
    get: (...args: unknown[]) => cacheGet(...args),
    set: (...args: unknown[]) => cacheSet(...args),
  },
}));

vi.mock('../../services/resolveServerFunctionRuntimeConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/resolveServerFunctionRuntimeConfig')>();
  return {
    ...actual,
    resolveServerFunctionRuntimeConfig: vi.fn((input) => actual.resolveServerFunctionRuntimeConfig({
      timeoutMs: 25,
      cacheTtlMs: 60000,
      cacheByParam: false,
      cacheByUser: false,
      ...input,
    })),
  };
});

describe('applyBuiltInRuntimePolicy', () => {
  const defaults = INITIAL_FUNCTIONS.find((item) => item.id === 'fn-users-list');
  const record = mergeBuiltinFunctionDefaults(defaults!, { cacheEnabled: true });

  beforeEach(() => {
    vi.clearAllMocks();
    cacheGet.mockResolvedValue(null);
    cacheSet.mockResolvedValue(undefined);
  });

  it('returns false and serves cached GET responses without calling next', async () => {
    cacheGet.mockResolvedValue({
      statusCode: 200,
      body: { success: true, items: [] },
      contentType: 'json',
    });

    const req = {
      method: 'GET',
      params: {},
      query: {},
      auth: { userId: 1 },
    } as unknown as Request;

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = {
      headersSent: false,
      statusCode: 200,
      status,
      json,
      on: vi.fn(),
    } as unknown as Response;

    const shouldContinue = await applyBuiltInRuntimePolicy(req, res, record);
    expect(shouldContinue).toBe(false);
    expect(json).toHaveBeenCalledWith({ success: true, items: [] });
  });

  it('returns true for uncached requests so handlers can run', async () => {
    const req = {
      method: 'GET',
      params: {},
      query: {},
      auth: { userId: 1 },
    } as unknown as Request;

    const res = {
      headersSent: false,
      statusCode: 200,
      json: vi.fn().mockReturnValue({}),
      send: vi.fn().mockReturnValue({}),
      on: vi.fn(),
    } as unknown as Response;

    const shouldContinue = await applyBuiltInRuntimePolicy(req, res, record);
    expect(shouldContinue).toBe(true);
  });

  it('does not arm execution timeout when response cache is disabled', async () => {
    vi.useFakeTimers();
    const profileDefaults = INITIAL_FUNCTIONS.find((item) => item.id === 'fn-profile-get');
    const profileRecord = mergeBuiltinFunctionDefaults(profileDefaults!, { cacheEnabled: false });

    const req = {
      method: 'GET',
      params: {},
      query: {},
      auth: { userId: 1 },
    } as unknown as Request;

    const json = vi.fn();
    const res = {
      headersSent: false,
      statusCode: 200,
      status: vi.fn(() => ({ json })),
      json,
      send: vi.fn(),
      on: vi.fn(),
    } as unknown as Response;

    const shouldContinue = await applyBuiltInRuntimePolicy(req, res, profileRecord);
    expect(shouldContinue).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(json).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('does not arm execution timeout when response cache is enabled', async () => {
    vi.useFakeTimers();

    const req = {
      method: 'GET',
      params: {},
      query: {},
      auth: { userId: 1 },
    } as unknown as Request;

    const json = vi.fn();
    const res = {
      headersSent: false,
      statusCode: 200,
      status: vi.fn(() => ({ json })),
      json,
      send: vi.fn(),
      on: vi.fn(),
    } as unknown as Response;

    const shouldContinue = await applyBuiltInRuntimePolicy(req, res, record);
    expect(shouldContinue).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(json).not.toHaveBeenCalledWith({
      success: false,
      error: 'Built-in route execution timed out.',
    });

    vi.useRealTimers();
  });
});
