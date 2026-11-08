import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { resetEdgeDataSourcesCatalogForTests, saveDataSourcesToSettings, seedEdgeDataSourcesCatalogForTests, toApiDataSource } from '../../../../../db/dataSourcesStore';
import type { EdgeDbQueryFn } from '../../../../server-function.service';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  DESCRIBE_SCHEMA_TOOL_NAME,
  executeDescribeSchema,
  executeListDataSources,
  executeQueryReadonly,
  LIST_DATA_SOURCES_TOOL_NAME,
  QUERY_READONLY_TOOL_NAME,
  sanitizeDataSourceForAgent,
  validateReadOnlySql,
  type DataToolsDeps,
} from '../dataTools';

describe('appendo-data pack', () => {
  let tempDir: string;
  let settingsPath: string;
  let edgeDbQuery: EdgeDbQueryFn;
  let deps: DataToolsDeps;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-data-pack-'));
    settingsPath = path.join(tempDir, 'settings.json');
    fs.writeFileSync(settingsPath, '{}', 'utf8');

    saveDataSourcesToSettings(settingsPath, [{
      id: 'ds_test',
      name: 'Test PostgreSQL',
      type: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      database: 'AppEnd',
      username: 'postgres',
      password: 'secret-password',
      encrypt: false,
      trustServerCertificate: true,
      pooling: false,
      status: 'connected',
      isDefault: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }]);

    edgeDbQuery = vi.fn(async () => ({
      data: [{ id: 1, name: 'alpha' }],
      count: 1,
      source: { id: 'ds_test', name: 'Test PostgreSQL', type: 'PostgreSQL' },
    }));

    deps = {
      getSettingsPath: () => settingsPath,
      edgeDbQuery,
    };
  });

  afterEach(() => {
    resetEdgeDataSourcesCatalogForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers data pack tools when appendo-data is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['data']);
    registerBuiltinCapabilityPacks(registry, ['appendo-data']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-data').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('blocks data tools in plan mode', () => {
    const registry = createPhase1ToolRegistry('plan', ['data']);
    registerBuiltinCapabilityPacks(registry, ['appendo-data']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    expect(names).not.toContain(LIST_DATA_SOURCES_TOOL_NAME);
    expect(names).not.toContain(DESCRIBE_SCHEMA_TOOL_NAME);
    expect(names).not.toContain(QUERY_READONLY_TOOL_NAME);
  });

  it('list_data_sources redacts passwords', () => {
    const result = executeListDataSources(deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].password).toBeUndefined();
    expect(result.data.items[0].hasPassword).toBe(true);
    expect(result.data.items[0].name).toBe('Test PostgreSQL');
  });

  it('sanitizeDataSourceForAgent never exposes raw password', () => {
    const sanitized = sanitizeDataSourceForAgent(toApiDataSource({
      id: 'ds_x',
      name: 'X',
      type: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      database: 'db',
      username: 'user',
      password: 'raw-secret',
      encrypt: true,
      trustServerCertificate: true,
      pooling: false,
      status: 'connected',
      isDefault: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }));

    expect(sanitized.password).toBeUndefined();
    expect(sanitized.hasPassword).toBe(true);
  });

  it('validateReadOnlySql rejects mutating statements', () => {
    expect(validateReadOnlySql('INSERT INTO users VALUES (1)').ok).toBe(false);
    expect(validateReadOnlySql('DELETE FROM users').ok).toBe(false);
    expect(validateReadOnlySql('SELECT 1; DROP TABLE users').ok).toBe(false);
  });

  it('validateReadOnlySql allows SELECT and WITH', () => {
    expect(validateReadOnlySql('SELECT id FROM users WHERE id = ?').ok).toBe(true);
    expect(validateReadOnlySql('WITH cte AS (SELECT 1 AS n) SELECT n FROM cte').ok).toBe(true);
  });

  it('describe_schema returns catalog when objectName is omitted', async () => {
    edgeDbQuery = vi.fn(async () => ({
      data: [{ name: 'users' }, { name: 'orders' }],
      count: 2,
    }));
    deps.edgeDbQuery = edgeDbQuery;

    const result = await executeDescribeSchema({ dataSourceId: 'ds_test' }, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.catalog.TABLE).toEqual(['orders', 'users']);
    expect(edgeDbQuery).toHaveBeenCalled();
  });

  it('query_readonly executes validated SELECT via edgeDbQuery', async () => {
    const result = await executeQueryReadonly(
      {
        dataSourceId: 'ds_test',
        sql: 'SELECT id, name FROM users LIMIT 10',
        params: '[]',
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.rows).toEqual([{ id: 1, name: 'alpha' }]);
    expect(edgeDbQuery).toHaveBeenCalledWith(
      'SELECT id, name FROM users LIMIT 10',
      [],
      expect.objectContaining({ dataSourceId: 'ds_test' }),
    );
  });

  it('query_readonly rejects non-SQL data source types', async () => {
    seedEdgeDataSourcesCatalogForTests([{
      id: 'ds_unsupported',
      name: 'Unsupported Engine',
      type: 'UnsupportedEngine',
      host: 'localhost',
      port: 1,
      database: '',
      username: '',
      password: '',
      encrypt: true,
      trustServerCertificate: true,
      pooling: false,
      status: 'connected',
      isDefault: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }]);

    const result = await executeQueryReadonly(
      { dataSourceId: 'ds_unsupported', sql: 'SELECT 1' },
      deps,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('unsupported_data_source_type');
  });
});
