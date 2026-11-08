import { describe, expect, it, vi } from 'vitest';
import {
  mergeBuiltinFunctionDefaults,
} from '../builtinFunctionRegistry.service';
import { BUILTIN_AUTHENTICATED_ACCESS_CONTROL, INITIAL_FUNCTIONS } from '../../../shared/api/contracts/server-functions/initialFunctions';

describe('builtinFunctionRegistry.service', () => {
  it('merges persisted overrides onto curated defaults', () => {
    const defaults = INITIAL_FUNCTIONS.find((item) => item.id === 'fn-users-list');
    expect(defaults).toBeTruthy();

    const merged = mergeBuiltinFunctionDefaults(defaults!, {
      accessControl: BUILTIN_AUTHENTICATED_ACCESS_CONTROL,
      enableLogs: false,
      testPayload: '{"query":{"page":2}}',
    });

    expect(merged.accessControl.accessMode).toBe('authenticated');
    expect(merged.enableLogs).toBe(false);
    expect(merged.testPayload).toBe('{"query":{"page":2}}');
    expect(merged.routeKey).toBe('GET /api/users');
  });

  it('merges runtime and cache overrides onto curated defaults', () => {
    const defaults = INITIAL_FUNCTIONS.find((item) => item.id === 'fn-users-list');
    expect(defaults).toBeTruthy();

    const merged = mergeBuiltinFunctionDefaults(defaults!, {
      useGlobalConfig: false,
      timeoutMs: 3000,
      memoryLimit: 256,
      runtimeVersion: 'v18.x',
      cacheEnabled: true,
      cacheTtlMs: 60000,
      cacheByParam: true,
      cacheByUser: true,
    });

    expect(merged.useGlobalConfig).toBe(false);
    expect(merged.timeoutMs).toBe(3000);
    expect(merged.memoryLimit).toBe(256);
    expect(merged.runtimeVersion).toBe('v18.x');
    expect(merged.cacheEnabled).toBe(true);
    expect(merged.cacheTtlMs).toBe(60000);
    expect(merged.cacheByParam).toBe(true);
    expect(merged.cacheByUser).toBe(true);
  });

  it('merges audit metadata overrides onto curated defaults', () => {
    const defaults = INITIAL_FUNCTIONS.find((item) => item.id === 'fn-users-list');
    expect(defaults).toBeTruthy();

    const merged = mergeBuiltinFunctionDefaults(defaults!, {
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'platform',
      updatedAt: '2026-06-01T12:00:00.000Z',
      updatedBy: 'admin@append.os',
    });

    expect(merged.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(merged.created_by).toBe('platform');
    expect(merged.updated_at).toBe('2026-06-01T12:00:00.000Z');
    expect(merged.updated_by).toBe('admin@append.os');
  });
});
