import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildFunctionMetadataFileName,
  buildFunctionSourceFileName,
} from '../../../../core/functions/functionNaming';
import {
  deleteManagedFunctionFromStore,
  DuplicateFunctionIdentityError,
  DuplicateFunctionPathError,
  findManagedFunctionByIdFromStore,
  insertManagedFunctionToStore,
  listManagedFunctionsFromStore,
  countManagedFunctionCatalogFromStore,
  updateManagedFunctionInStore,
} from '../../../../core/functions/FunctionFileStore';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'function-file-store-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

const baseInput = {
  id: 'custom.hello-world',
  name: 'hello-world',
  folder: 'custom',
  method: 'GET',
  path: '/api/custom/hello',
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
};

describe('FunctionFileStore', () => {
  it('creates split source and metadata files with clean names', () => {
    insertManagedFunctionToStore(baseInput);

    const sourceFile = buildFunctionSourceFileName(baseInput.folder, baseInput.name, baseInput.language);
    const metadataFile = buildFunctionMetadataFileName(baseInput.folder, baseInput.name);
    const customDir = path.join(process.cwd(), 'workspace/server-functions/custom');

    expect(fs.existsSync(path.join(customDir, sourceFile))).toBe(true);
    expect(fs.readFileSync(path.join(customDir, sourceFile), 'utf8')).toBe(baseInput.code);
    expect(fs.existsSync(path.join(customDir, metadataFile))).toBe(true);

    const metadata = JSON.parse(fs.readFileSync(path.join(customDir, metadataFile), 'utf8')) as {
      id: string;
      sourceFile: string;
      code?: string;
    };
    expect(metadata.id).toBe('custom.hello-world');
    expect(metadata.sourceFile).toBe(sourceFile);
    expect(metadata.code).toBeUndefined();
  });

  it('counts catalog rows from the index', () => {
    expect(countManagedFunctionCatalogFromStore()).toBe(0);
    insertManagedFunctionToStore(baseInput);
    expect(countManagedFunctionCatalogFromStore()).toBe(1);
  });

  it('persists audit metadata on create and preserves created fields on update', () => {
    insertManagedFunctionToStore({
      ...baseInput,
      createdBy: 'creator@example.com',
      updatedBy: 'creator@example.com',
    });

    const created = listManagedFunctionsFromStore()[0];
    expect(created.created_by).toBe('creator@example.com');
    expect(created.updated_by).toBe('creator@example.com');
    expect(created.created_at).toBeTruthy();
    expect(created.updated_at).toBeTruthy();

    updateManagedFunctionInStore('custom.hello-world', {
      ...baseInput,
      code: 'res.json({ updated: true });',
      updatedBy: 'editor@example.com',
    });

    const updated = listManagedFunctionsFromStore()[0];
    expect(updated.created_by).toBe('creator@example.com');
    expect(updated.updated_by).toBe('editor@example.com');
    expect(updated.created_at).toBe(created.created_at);
    expect(updated.updated_at).toBeTruthy();
  });

  it('creates, reads, updates, and deletes functions with snake_case API rows', () => {
    insertManagedFunctionToStore(baseInput);

    const listed = listManagedFunctionsFromStore();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe('custom.hello-world');
    expect(listed[0].test_payload).toBe('{}');
    expect(listed[0].runtime_version).toBe('v20.x');

    const found = findManagedFunctionByIdFromStore('custom.hello-world');
    expect(found?.name).toBe('hello-world');

    updateManagedFunctionInStore('custom.hello-world', {
      ...baseInput,
      name: 'hello-updated',
      code: 'res.json({ updated: true });',
    });

    const updated = findManagedFunctionByIdFromStore('custom.hello-updated');
    expect(updated?.name).toBe('hello-updated');
    expect(updated?.code).toBe('res.json({ updated: true });');

    deleteManagedFunctionFromStore('custom.hello-updated');
    expect(listManagedFunctionsFromStore()).toHaveLength(0);
  });

  it('rejects duplicate method+path combinations', () => {
    insertManagedFunctionToStore(baseInput);

    expect(() => insertManagedFunctionToStore({
      ...baseInput,
      id: 'custom.duplicate-path',
      name: 'duplicate-path',
    })).toThrow(DuplicateFunctionPathError);
  });

  it('rejects duplicate folder+name combinations', () => {
    insertManagedFunctionToStore(baseInput);

    expect(() => insertManagedFunctionToStore({
      ...baseInput,
      path: '/api/custom/other-path',
    })).toThrow(DuplicateFunctionIdentityError);
  });

  it('ignores legacy monolithic function files instead of migrating on read', () => {
    const customDir = path.join(process.cwd(), 'workspace/server-functions/custom');
    fs.mkdirSync(customDir, { recursive: true });
    const legacyPath = path.join(customDir, 'fn_legacy001.function.json');
    fs.writeFileSync(legacyPath, JSON.stringify({
      schema: 'append-server-function',
      schemaVersion: '1.0.0',
      id: 'fn_legacy001',
      name: 'legacy-fn',
      folder: 'legacy',
      method: 'GET',
      path: '/api/legacy/fn',
      code: 'res.json({ legacy: true });',
      language: 'ts',
      testPayload: '{}',
      runtimeVersion: 'v20.x',
      memoryLimit: 128,
      timeoutMs: 1500,
      cacheEnabled: false,
      cacheTtlMs: 180000,
      cacheByParam: false,
      cacheByUser: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdBy: null,
      updatedBy: null,
    }, null, 2), 'utf8');

    const listed = listManagedFunctionsFromStore();
    expect(listed).toHaveLength(0);
    expect(fs.existsSync(legacyPath)).toBe(true);
    expect(fs.existsSync(path.join(customDir, 'legacy.legacy-fn.ts'))).toBe(false);
    expect(fs.existsSync(path.join(customDir, 'legacy.legacy-fn.metadata.json'))).toBe(false);
  });

  it('persists DATA_API engine type and metadata json', () => {
    const metadataJson = JSON.stringify({
      origin: 'data-api',
      edgeApiDefinitionId: 'api_count',
      edgeApiOperationId: 'op_get',
    });

    insertManagedFunctionToStore({
      ...baseInput,
      id: 'demo.count-active',
      name: 'count-active',
      folder: 'demo',
      path: '/api/demo/count-active',
      code: '',
      engineType: 'DATA_API',
      metadataJson,
    });

    const listed = listManagedFunctionsFromStore();
    expect(listed).toHaveLength(1);
    expect(listed[0].engine_type).toBe('DATA_API');
    expect(listed[0].metadata_json).toBe(metadataJson);

    const metadataFile = path.join(
      process.cwd(),
      'workspace/server-functions/custom',
      buildFunctionMetadataFileName('demo', 'count-active'),
    );
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')) as {
      engineType: string;
      metadataJson: string;
    };
    expect(metadata.engineType).toBe('DATA_API');
    expect(metadata.metadataJson).toBe(metadataJson);
  });

  it('reconciles index from custom files when index is corrupt', () => {
    insertManagedFunctionToStore(baseInput);

    const indexPath = path.join(process.cwd(), 'workspace/server-functions/index.json');
    fs.writeFileSync(indexPath, '{bad json', 'utf8');

    const listed = listManagedFunctionsFromStore();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe('custom.hello-world');

    const recovered = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
      schema: string;
      functions: Array<{ id: string; sourceFile: string; metadataFile: string }>;
    };
    expect(recovered.schema).toBe('append-server-functions-index');
    expect(recovered.functions.some((item) => item.id === 'custom.hello-world')).toBe(true);
    expect(recovered.functions[0].sourceFile).toBe('custom.hello-world.ts');
    expect(recovered.functions[0].metadataFile).toBe('custom.hello-world.metadata.json');
  });
});
