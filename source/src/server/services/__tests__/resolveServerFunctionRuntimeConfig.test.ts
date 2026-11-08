import { describe, expect, it } from 'vitest';
import { resolveServerFunctionRuntimeConfig } from '../resolveServerFunctionRuntimeConfig';

describe('resolveServerFunctionRuntimeConfig', () => {
  const globalSettings = {
    serverFunctionVmMode: 'v20.x',
    serverFunctionRamAllocation: 256,
    serverFunctionTimeout: 5000,
    serverFunctionAutoLogging: false,
  };

  it('uses per-function settings when useGlobalConfig is false', () => {
    const resolved = resolveServerFunctionRuntimeConfig({
      timeoutMs: 1200,
      memoryLimit: 64,
      runtimeVersion: 'v18.x',
      language: 'js',
      useGlobalConfig: false,
      enableLogs: false,
      cacheEnabled: true,
      cacheTtlMs: 90000,
      cacheByParam: true,
      cacheByUser: false,
    }, { globalSettings });

    expect(resolved).toEqual({
      timeoutMs: 1200,
      memoryLimit: 64,
      runtimeVersion: 'v18.x',
      language: 'js',
      enableLogs: false,
      cache: {
        enabled: true,
        ttlMs: 90000,
        byParam: true,
        byUser: false,
      },
    });
  });

  it('uses live global settings when useGlobalConfig is true', () => {
    const resolved = resolveServerFunctionRuntimeConfig({
      timeoutMs: 1200,
      memoryLimit: 64,
      runtimeVersion: 'v18.x',
      language: 'ts',
      useGlobalConfig: true,
      enableLogs: true,
    }, { globalSettings });

    expect(resolved.timeoutMs).toBe(5000);
    expect(resolved.memoryLimit).toBe(256);
    expect(resolved.runtimeVersion).toBe('v20.x');
    expect(resolved.language).toBe('ts');
    expect(resolved.enableLogs).toBe(true);
  });

  it('defaults useGlobalConfig to true and clamps memory to allowed values', () => {
    const resolved = resolveServerFunctionRuntimeConfig({
      memoryLimit: 200,
      timeoutMs: 99999,
    }, { globalSettings });

    expect(resolved.memoryLimit).toBe(256);
    expect(resolved.timeoutMs).toBe(5000);
  });

  it('falls back to global auto-logging when enableLogs is omitted', () => {
    const resolved = resolveServerFunctionRuntimeConfig({
      useGlobalConfig: false,
    }, { globalSettings });

    expect(resolved.enableLogs).toBe(false);
  });

  it('keeps per-function cache + language while inheriting global VM/RAM/timeout', () => {
    const resolved = resolveServerFunctionRuntimeConfig({
      timeoutMs: 1200,
      memoryLimit: 64,
      runtimeVersion: 'v18.x',
      language: 'js',
      useGlobalConfig: true,
      enableLogs: false,
      cacheEnabled: true,
      cacheTtlMs: 180000,
      cacheByParam: true,
      cacheByUser: true,
    }, { globalSettings });

    expect(resolved.timeoutMs).toBe(5000);
    expect(resolved.memoryLimit).toBe(256);
    expect(resolved.runtimeVersion).toBe('v20.x');
    expect(resolved.language).toBe('js');
    expect(resolved.enableLogs).toBe(false);
    expect(resolved.cache).toEqual({
      enabled: true,
      ttlMs: 180000,
      byParam: true,
      byUser: true,
    });
  });
});
