import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'append-builtin-fn-'));

vi.mock('../runtime/runtimePaths', () => ({
  runtimeDirs: {
    serverFunctions: path.join(tempRoot, 'server-functions'),
    serverFunctionsBuiltin: path.join(tempRoot, 'server-functions', 'builtin'),
    serverFunctionsLocks: path.join(tempRoot, 'server-functions', 'locks'),
    workspaceTemp: path.join(tempRoot, 'temp'),
  },
}));

describe('BuiltinFunctionMetadataStore', () => {
  beforeEach(async () => {
    const { ensureBuiltinFunctionStoreDirs } = await import('../BuiltinFunctionMetadataStore');
    ensureBuiltinFunctionStoreDirs();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('writes and reads built-in metadata overrides', async () => {
    const {
      writeBuiltinFunctionMetadata,
      readBuiltinFunctionMetadata,
    } = await import('../BuiltinFunctionMetadataStore');

    writeBuiltinFunctionMetadata(
      'fn-users-list',
      'GET',
      '/api/users',
      {
        accessControl: {
          accessMode: 'specific',
          allowRoles: ['USER'],
          allowUsers: [],
          denyRoles: [],
          denyUsers: [],
        },
        enableLogs: false,
        testPayload: '{"query":{"limit":5}}',
        cacheEnabled: true,
        cacheTtlMs: 120000,
        cacheByParam: true,
        timeoutMs: 5000,
      },
      'admin@append.os',
    );

    const stored = readBuiltinFunctionMetadata('fn-users-list');
    expect(stored?.accessControl?.allowRoles).toEqual(['USER']);
    expect(stored?.enableLogs).toBe(false);
    expect(stored?.testPayload).toBe('{"query":{"limit":5}}');
    expect(stored?.cacheEnabled).toBe(true);
    expect(stored?.cacheTtlMs).toBe(120000);
    expect(stored?.cacheByParam).toBe(true);
    expect(stored?.timeoutMs).toBe(5000);
    expect(stored?.createdBy).toBeNull();
    expect(stored?.createdAt).toBeTruthy();
    expect(stored?.updatedBy).toBe('admin@append.os');
    expect(stored?.updatedAt).toBeTruthy();

    writeBuiltinFunctionMetadata(
      'fn-users-list',
      'GET',
      '/api/users',
      { enableLogs: true },
      'editor@append.os',
    );

    const updated = readBuiltinFunctionMetadata('fn-users-list');
    expect(updated?.createdAt).toBe(stored?.createdAt);
    expect(updated?.createdBy).toBe(stored?.createdBy);
    expect(updated?.updatedBy).toBe('editor@append.os');
    expect(updated?.enableLogs).toBe(true);
  });
});
