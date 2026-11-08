import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { insertManagedFunction } from '../../domain/functions/functionRepository';
import { ManagedFunctionRouteRegistry } from '../managedFunctionRouteRegistry';

describe('Server Functions — file store → route registry', () => {
  let tmpDir = '';
  let origCwd = '';
  let registry: ManagedFunctionRouteRegistry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-fn-integration-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    registry = new ManagedFunctionRouteRegistry();
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('loads DATA_API functions from disk and pins them to the declared method', async () => {
    const metadataJson = JSON.stringify({
      origin: 'data-api',
      edgeApiDefinitionId: 'api_products',
      edgeApiOperationId: 'op_list',
    });

    await insertManagedFunction([
      'demo.products-list',
      'products-list',
      'demo',
      'GET',
      '/api/demo/products',
      '',
      'ts',
      '{}',
      'v20.x',
      128,
      1500,
      false,
      180000,
      false,
      false,
      'DATA_API',
      metadataJson,
    ]);

    await registry.reload();

    const match = registry.resolve('GET', '/api/demo/products');
    expect(match?.function.id).toBe('demo.products-list');
    expect(match?.function.engine_type).toBe('DATA_API');
    expect(match?.function.metadata_json).toContain('api_products');
    expect(registry.resolve('POST', '/api/demo/products')).toBeNull();
  });

  it('keeps SANDBOX_JS routes method-specific after file-store reload', async () => {
    await insertManagedFunction([
      'demo.hello',
      'hello',
      'demo',
      'GET',
      '/api/demo/hello',
      'res.json({ hello: true });',
      'js',
      '{}',
      'v20.x',
      128,
      1500,
      false,
      180000,
      false,
      false,
      'SANDBOX_JS',
      null,
    ]);

    await registry.reload();

    expect(registry.resolve('GET', '/api/demo/hello')?.function.id).toBe('demo.hello');
    expect(registry.resolve('POST', '/api/demo/hello')).toBeNull();
  });
});
