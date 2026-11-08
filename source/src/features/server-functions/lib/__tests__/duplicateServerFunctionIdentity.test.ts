import { describe, expect, it } from 'vitest';
import type { ServerFunctionItem } from '../../types';
import {
  buildServerFunctionCatalogPath,
  buildServerFunctionPreviewPath,
  isServerFunctionIdentityTaken,
  suggestDuplicateServerFunctionName,
} from '../duplicateServerFunctionIdentity';

const baseFunction = (overrides: Partial<ServerFunctionItem> = {}): ServerFunctionItem => ({
  id: 'fn-1',
  name: 'hello',
  folder: 'users',
  method: 'GET',
  path: '/api/users/hello',
  code: 'res.json({ ok: true });',
  language: 'ts',
  testPayload: '{}',
  memoryLimit: 128,
  timeoutMs: 1500,
  runtimeVersion: 'v20.x',
  useGlobalConfig: true,
  enableLogs: true,
  cacheEnabled: false,
  cacheTtlMs: 3600000,
  accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
  ...overrides,
});

describe('duplicateServerFunctionIdentity', () => {
  it('suggests -copy suffix when available', () => {
    expect(suggestDuplicateServerFunctionName('users', 'hello', [baseFunction()])).toBe('hello-copy');
  });

  it('increments suffix when -copy is taken', () => {
    const functions = [
      baseFunction(),
      baseFunction({ id: 'fn-2', name: 'hello-copy', path: '/api/users/hello-copy' }),
    ];
    expect(suggestDuplicateServerFunctionName('users', 'hello', functions)).toBe('hello-copy-2');
  });

  it('detects folder+name collisions', () => {
    const functions = [baseFunction()];
    expect(isServerFunctionIdentityTaken(functions, 'users', 'hello')).toBe(true);
    expect(isServerFunctionIdentityTaken(functions, 'users', 'hello-copy')).toBe(false);
    expect(isServerFunctionIdentityTaken(functions, 'users', 'hello', 'fn-1')).toBe(false);
  });

  it('builds preview path from folder and name', () => {
    expect(buildServerFunctionPreviewPath('Users', 'hello-world')).toBe('/api/users/hello-world');
    expect(buildServerFunctionPreviewPath('Users', 'Hello World')).toBe('/api/users/helloworld');
  });

  it('builds flat catalog path from name only', () => {
    expect(buildServerFunctionCatalogPath('hello-world')).toBe('/api/hello-world');
  });
});
