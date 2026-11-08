import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { insertManagedFunctionToStore } from '../../../../core/functions/FunctionFileStore';
import {
  buildPackageApiSupersedeRouteKeys,
  findManagedFunctionIdsSupersededByPackageApis,
  supersedeManagedFunctionsForPackageApis,
} from '../managedFunctionPackageOverride.service';
import type { ApiRegistryRecord } from '../../../domain/package-domain/types';

let tmpDir = '';
let origCwd = '';

const sampleApi = (overrides: Partial<ApiRegistryRecord> = {}): ApiRegistryRecord => ({
  apiId: 'get-test',
  conflictKey: 'GET /api/test/test',
  method: 'GET',
  path: '/api/test/test',
  httpPath: '/api/test/test',
  entry: 'api/test/test.ts',
  auth: 'admin',
  timeoutMs: 1500,
  registeredAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-managed-supersede-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('managedFunctionPackageOverride.service', () => {
  it('builds route keys from manifest path and http path', () => {
    const keys = buildPackageApiSupersedeRouteKeys([
      sampleApi({
        conflictKey: 'GET /api/test/test',
        path: '/api/test/test',
        httpPath: '/api/test/test',
      }),
      sampleApi({
        apiId: 'get-legacy',
        conflictKey: 'GET /packages/pkg-test/test',
        path: '/packages/pkg-test/test',
        httpPath: '/api/packages/pkg-test/test',
      }),
    ]);

    expect(keys).toEqual(new Set([
      'GET /api/test/test',
      'GET /packages/pkg-test/test',
      'GET /api/packages/pkg-test/test',
    ]));
  });

  it('finds managed functions superseded by installed package apis', () => {
    insertManagedFunctionToStore({
      id: 'test.test',
      name: 'test',
      folder: 'test',
      method: 'GET',
      path: '/api/test/test',
      code: 'res.json({ ok: true });',
      language: 'ts',
      testPayload: '{}',
      runtimeVersion: 'v20.x',
      memoryLimit: 128,
      timeoutMs: 1500,
      cacheEnabled: false,
      cacheTtlMs: 180000,
      cacheByParam: false,
      cacheByUser: false,
    });
    insertManagedFunctionToStore({
      id: 'other.fn',
      name: 'fn',
      folder: 'other',
      method: 'GET',
      path: '/api/other/fn',
      code: 'res.json({ ok: true });',
      language: 'ts',
      testPayload: '{}',
      runtimeVersion: 'v20.x',
      memoryLimit: 128,
      timeoutMs: 1500,
      cacheEnabled: false,
      cacheTtlMs: 180000,
      cacheByParam: false,
      cacheByUser: false,
    });

    expect(findManagedFunctionIdsSupersededByPackageApis([sampleApi()])).toEqual(['test.test']);
  });

  it('removes superseded managed functions during package install override', async () => {
    insertManagedFunctionToStore({
      id: 'test.test',
      name: 'test',
      folder: 'test',
      method: 'GET',
      path: '/api/test/test',
      code: 'res.json({ ok: true });',
      language: 'ts',
      testPayload: '{}',
      runtimeVersion: 'v20.x',
      memoryLimit: 128,
      timeoutMs: 1500,
      cacheEnabled: false,
      cacheTtlMs: 180000,
      cacheByParam: false,
      cacheByUser: false,
    });

    const result = await supersedeManagedFunctionsForPackageApis([sampleApi()]);

    expect(result.removedIds).toEqual(['test.test']);
    const customDir = path.join(tmpDir, 'workspace/server-functions/custom');
    expect(fs.readdirSync(customDir)).toHaveLength(0);
  });
});
