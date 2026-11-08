import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { resetEdgeDbRouterCaches, type StoredDataSource } from '../../../../../../core/database/EdgeDbRouter';
import { resetEdgeSequelizeFactoryCache } from '../../../../../services/data-api/sequelize/edgeSequelizeFactory';

const TEST_DB_PATH = path.join(os.tmpdir(), `appendoo-db-action-test-${Date.now()}.sqlite`);
const TEST_DATA_SOURCE: StoredDataSource = {
  id: 'ds-test-sqlite',
  name: 'test-sqlite',
  type: 'SQLite',
  host: '',
  port: 0,
  database: TEST_DB_PATH,
  status: 'connected',
  isDefault: true,
  created_at: '',
  updated_at: '',
};

vi.mock('../../../../../db/dataSourcesStore', () => ({
  getDataSourcesFromSettings: () => [TEST_DATA_SOURCE],
}));

// Imported AFTER the mock so the module's own `edgeDbQuery` singleton picks it up.
const { dataDbQueryExecutor, dataCrudGenQueryExecutor, assertReadOnlySelect } = await import('../dbActions');

const syntheticContext = {
  workflowInstanceId: 'test', nodeInstanceId: 'test', logicalInvocationId: 'test', idempotencyKey: 'test',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => { throw new Error('not used'); },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('assertReadOnlySelect (pure guard)', () => {
  it('accepts a plain SELECT', () => {
    expect(assertReadOnlySelect('SELECT * FROM widgets WHERE id = ?')).toEqual({ ok: true });
  });

  it('accepts a WITH ... SELECT common table expression', () => {
    expect(assertReadOnlySelect('WITH recent AS (SELECT id FROM widgets) SELECT * FROM recent')).toEqual({ ok: true });
  });

  it('tolerates one trailing semicolon', () => {
    expect(assertReadOnlySelect('SELECT 1;')).toEqual({ ok: true });
  });

  it('rejects a second stacked statement', () => {
    const result = assertReadOnlySelect('SELECT 1; DROP TABLE widgets;');
    expect(result.ok).toBe(false);
  });

  it('rejects anything not starting with SELECT/WITH', () => {
    expect(assertReadOnlySelect('DELETE FROM widgets').ok).toBe(false);
    expect(assertReadOnlySelect('UPDATE widgets SET name = ?').ok).toBe(false);
    expect(assertReadOnlySelect('INSERT INTO widgets VALUES (1)').ok).toBe(false);
    expect(assertReadOnlySelect('DROP TABLE widgets').ok).toBe(false);
  });

  it('rejects a forbidden keyword even mid-query (e.g. SELECT ... INTO)', () => {
    expect(assertReadOnlySelect('SELECT * INTO backup FROM widgets').ok).toBe(false);
  });

  it('a keyword hidden inside a comment is inert (comments never execute) and does not trip the guard', () => {
    expect(assertReadOnlySelect('SELECT * FROM widgets /* DROP TABLE widgets */').ok).toBe(true);
    expect(assertReadOnlySelect('SELECT 1; -- DROP TABLE widgets').ok).toBe(true); // comment stripped -> just "SELECT 1" with one trailing ";", perfectly legal
  });

  it('still rejects a genuinely stacked second statement even with a comment present', () => {
    expect(assertReadOnlySelect('SELECT 1; DROP TABLE widgets -- oops').ok).toBe(false);
  });
});

describe('data.db-query executor (real SQLite, no mocked driver)', () => {
  beforeAll(() => {
    const seedDb = new Database(TEST_DB_PATH);
    seedDb.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT)');
    seedDb.prepare('INSERT INTO widgets (id, name) VALUES (?, ?)').run(1, 'alpha');
    seedDb.prepare('INSERT INTO widgets (id, name) VALUES (?, ?)').run(2, "o'brien"); // a literal quote/apostrophe value
    seedDb.close();
  });

  afterAll(async () => {
    await resetEdgeDbRouterCaches(); // closes the pooled connection EdgeDbRouter opened — required before the file can be deleted on Windows
    fs.rmSync(TEST_DB_PATH, { force: true });
    fs.rmSync(`${TEST_DB_PATH}-wal`, { force: true });
    fs.rmSync(`${TEST_DB_PATH}-shm`, { force: true });
  });

  it('runs a real parameterized SELECT and returns real rows', async () => {
    const result = await dataDbQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id },
      { sql: 'SELECT id, name FROM widgets WHERE id = ?', params: [1] },
    );
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toEqual({ rows: [{ id: 1, name: 'alpha' }], count: 1, truncated: false });
  });

  it('parameters are bound, never interpolated — a literal quote in a param value is not SQL-injectable', async () => {
    const result = await dataDbQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id },
      { sql: 'SELECT id, name FROM widgets WHERE name = ?', params: ["o'brien"] },
    );
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toEqual({ rows: [{ id: 2, name: "o'brien" }], count: 1, truncated: false });
  });

  it('a write attempt is rejected before ever reaching the database', async () => {
    const result = await dataDbQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id },
      { sql: "UPDATE widgets SET name = 'hacked' WHERE id = 1", params: [] },
    );
    expect(result.status).toBe('FAILED');
    if (result.status !== 'FAILED') throw new Error('unreachable');
    expect(result.errorCode).toBe('DB_QUERY_NOT_READ_ONLY');

    // Prove it really never ran: the row is untouched.
    const check = await dataDbQueryExecutor.execute(syntheticContext, { dataSourceId: TEST_DATA_SOURCE.id }, { sql: 'SELECT name FROM widgets WHERE id = 1', params: [] });
    expect(check.status).toBe('SUCCEEDED');
    if (check.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect((check.output as { rows: Array<{ name: string }> }).rows[0].name).toBe('alpha');
  });

  it('missing dataSourceId or sql fails validation before querying', async () => {
    const noSource = await dataDbQueryExecutor.execute(syntheticContext, {}, { sql: 'SELECT 1' });
    expect(noSource.status).toBe('FAILED');
    if (noSource.status === 'FAILED') expect(noSource.errorCode).toBe('DB_QUERY_DATASOURCE_REQUIRED');

    const noSql = await dataDbQueryExecutor.execute(syntheticContext, { dataSourceId: TEST_DATA_SOURCE.id }, {});
    expect(noSql.status).toBe('FAILED');
    if (noSql.status === 'FAILED') expect(noSql.errorCode).toBe('DB_QUERY_SQL_REQUIRED');
  });

  it('an unknown dataSourceId fails cleanly with EXTERNAL_ERROR', async () => {
    const result = await dataDbQueryExecutor.execute(syntheticContext, { dataSourceId: 'does-not-exist' }, { sql: 'SELECT 1' });
    expect(result.status).toBe('FAILED');
    if (result.status !== 'FAILED') throw new Error('unreachable');
    expect(result.errorCode).toBe('DB_QUERY_FAILED');
  });
});

describe('data.crud-gen-query executor (real SQLite, no mocked driver)', () => {
  beforeAll(() => {
    const seedDb = new Database(TEST_DB_PATH);
    seedDb.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER, category TEXT)');
    const insert = seedDb.prepare('INSERT INTO products (id, name, price, category) VALUES (?, ?, ?, ?)');
    insert.run(1, 'widget', 10, 'tools');
    insert.run(2, 'gadget', 25, 'tools');
    insert.run(3, 'gizmo', 40, 'toys');
    seedDb.close();
  });

  afterAll(async () => {
    await resetEdgeSequelizeFactoryCache(); // closes the pooled Sequelize connection before the file is removed
    await resetEdgeDbRouterCaches();
    fs.rmSync(TEST_DB_PATH, { force: true });
    fs.rmSync(`${TEST_DB_PATH}-wal`, { force: true });
    fs.rmSync(`${TEST_DB_PATH}-shm`, { force: true });
  });

  it('discovers columns automatically and returns matching rows for a simple filter', async () => {
    const result = await dataCrudGenQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id, table: 'products' },
      { where: [{ field: 'category', operator: 'eq', value: 'tools' }], orderBy: { field: 'id', direction: 'asc' } },
    );
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toEqual({
      rows: [
        { id: 1, name: 'widget', price: 10, category: 'tools' },
        { id: 2, name: 'gadget', price: 25, category: 'tools' },
      ],
      count: 2,
      truncated: false,
    });
  });

  it('supports range filters (gte/lte) combined with AND and a column allowlist', async () => {
    const result = await dataCrudGenQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id, table: 'products' },
      {
        columns: ['name', 'price'],
        where: [
          { field: 'price', operator: 'gte', value: 20 },
          { field: 'price', operator: 'lte', value: 40 },
        ],
        orderBy: { field: 'price', direction: 'asc' },
      },
    );
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toEqual({
      rows: [
        { name: 'gadget', price: 25 },
        { name: 'gizmo', price: 40 },
      ],
      count: 2,
      truncated: false,
    });
  });

  it('the "in" operator matches against a value list', async () => {
    const result = await dataCrudGenQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id, table: 'products' },
      { columns: ['id'], where: [{ field: 'id', operator: 'in', value: [1, 3] }], orderBy: { field: 'id', direction: 'asc' } },
    );
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toEqual({ rows: [{ id: 1 }, { id: 3 }], count: 2, truncated: false });
  });

  it('a row-limit lower than the match count reports truncated: true', async () => {
    const result = await dataCrudGenQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id, table: 'products' },
      { columns: ['id'], orderBy: { field: 'id', direction: 'asc' }, limit: 2 },
    );
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toEqual({ rows: [{ id: 1 }, { id: 2 }], count: 2, truncated: true });
  });

  it('an unknown table fails cleanly instead of touching Sequelize', async () => {
    const result = await dataCrudGenQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id, table: 'does_not_exist' },
      {},
    );
    expect(result.status).toBe('FAILED');
    if (result.status !== 'FAILED') throw new Error('unreachable');
    expect(result.errorCode).toBe('CRUD_GEN_QUERY_TABLE_NOT_FOUND');
  });

  it('an unknown column in a filter is rejected before querying', async () => {
    const result = await dataCrudGenQueryExecutor.execute(
      syntheticContext,
      { dataSourceId: TEST_DATA_SOURCE.id, table: 'products' },
      { where: [{ field: 'not_a_real_column', operator: 'eq', value: 1 }] },
    );
    expect(result.status).toBe('FAILED');
    if (result.status !== 'FAILED') throw new Error('unreachable');
    expect(result.errorCode).toBe('CRUD_GEN_QUERY_FAILED');
  });

  it('missing config.dataSourceId or config.table fails validation before querying', async () => {
    const noSource = await dataCrudGenQueryExecutor.execute(syntheticContext, { table: 'products' }, {});
    expect(noSource.status).toBe('FAILED');
    if (noSource.status === 'FAILED') expect(noSource.errorCode).toBe('CRUD_GEN_QUERY_DATASOURCE_REQUIRED');

    const noTable = await dataCrudGenQueryExecutor.execute(syntheticContext, { dataSourceId: TEST_DATA_SOURCE.id }, {});
    expect(noTable.status).toBe('FAILED');
    if (noTable.status === 'FAILED') expect(noTable.errorCode).toBe('CRUD_GEN_QUERY_TABLE_REQUIRED');
  });
});
