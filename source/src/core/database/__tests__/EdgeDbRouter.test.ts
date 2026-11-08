import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSqlServerConfig, createEdgeDbQueryExecutor, resetEdgeDbRouterCaches, type StoredDataSource } from '../EdgeDbRouter';
import { getRequestDbContextFromInput } from '../requestDbContext';

type TempDbHandle = {
  filePath: string;
  connection: Database.Database;
};

const tempDirs: string[] = [];
const tempConnections: Database.Database[] = [];

const createTempSqliteDb = (label: string, userEmail: string): TempDbHandle => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `appendo-server-functions-router-${label}-`));
  tempDirs.push(dir);

  const filePath = path.join(dir, `${label}.sqlite`);
  const connection = new Database(filePath);
  tempConnections.push(connection);

  connection.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL
    );
  `);
  connection.prepare('INSERT INTO users (email) VALUES (?)').run(userEmail);

  return { filePath, connection };
};

afterEach(async () => {
  await resetEdgeDbRouterCaches();

  while (tempConnections.length > 0) {
    const connection = tempConnections.pop();
    connection?.close();
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('EdgeDbRouter', () => {
  it('uses the default datasource when no context is provided', async () => {
    const primaryDb = createTempSqliteDb('primary', 'primary@appendo.test');
    const secondaryDb = createTempSqliteDb('secondary', 'secondary@appendo.test');

    const sources: StoredDataSource[] = [
      {
        id: 'ds_primary',
        name: 'Primary SQLite',
        type: 'SQLite',
        host: 'localhost',
        port: 0,
        database: primaryDb.filePath,
        username: '',
        password: '',
        status: 'connected',
        isDefault: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ds_secondary',
        name: 'Secondary SQLite',
        type: 'SQLite',
        host: 'localhost',
        port: 0,
        database: secondaryDb.filePath,
        username: '',
        password: '',
        status: 'connected',
        isDefault: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const query = createEdgeDbQueryExecutor({ getDataSources: () => sources });
    const result = await query<{ email: string }>('SELECT email FROM users ORDER BY id ASC');

    expect(result.count).toBe(1);
    expect(result.source.id).toBe('ds_primary');
    expect(result.data[0]?.email).toBe('primary@appendo.test');
  });

  it('switches to the requested datasource when dataSourceId is provided', async () => {
    const primaryDb = createTempSqliteDb('primary-context', 'primary-context@appendo.test');
    const secondaryDb = createTempSqliteDb('secondary-context', 'secondary-context@appendo.test');

    const sources: StoredDataSource[] = [
      {
        id: 'ds_primary_context',
        name: 'Primary Context SQLite',
        type: 'SQLite',
        host: 'localhost',
        port: 0,
        database: primaryDb.filePath,
        username: '',
        password: '',
        status: 'connected',
        isDefault: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ds_secondary_context',
        name: 'Secondary Context SQLite',
        type: 'SQLite',
        host: 'localhost',
        port: 0,
        database: secondaryDb.filePath,
        username: '',
        password: '',
        status: 'connected',
        isDefault: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const query = createEdgeDbQueryExecutor({ getDataSources: () => sources });
    const result = await query<{ email: string }>(
      'SELECT email FROM users ORDER BY id ASC',
      [],
      { dataSourceId: 'ds_secondary_context' },
    );

    expect(result.count).toBe(1);
    expect(result.source.id).toBe('ds_secondary_context');
    expect(result.data[0]?.email).toBe('secondary-context@appendo.test');
  });

  it('applies request header datasource context for runtime-style queries', async () => {
    const primaryDb = createTempSqliteDb('primary-header', 'primary-header@appendo.test');
    const secondaryDb = createTempSqliteDb('secondary-header', 'secondary-header@appendo.test');

    const sources: StoredDataSource[] = [
      {
        id: 'ds_primary_header',
        name: 'Primary Header SQLite',
        type: 'SQLite',
        host: 'localhost',
        port: 0,
        database: primaryDb.filePath,
        username: '',
        password: '',
        status: 'connected',
        isDefault: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ds_secondary_header',
        name: 'Secondary Header SQLite',
        type: 'SQLite',
        host: 'localhost',
        port: 0,
        database: secondaryDb.filePath,
        username: '',
        password: '',
        status: 'connected',
        isDefault: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const runtimeContext = getRequestDbContextFromInput({
      headers: {
        'x-append-datasource-id': 'ds_secondary_header',
      },
      query: {},
      body: undefined,
    });

    const query = createEdgeDbQueryExecutor({ getDataSources: () => sources });
    const result = await query<{ email: string }>('SELECT email FROM users ORDER BY id ASC', [], runtimeContext);

    expect(runtimeContext.dataSourceId).toBe('ds_secondary_header');
    expect(result.source.id).toBe('ds_secondary_header');
    expect(result.data[0]?.email).toBe('secondary-header@appendo.test');
  });

  it('builds SQL Server config with instanceName and no port for named instances', () => {
    const config = buildSqlServerConfig({
      id: 'ds_default_local',
      name: 'default-db',
      type: 'SQL Server',
      host: 'localhost\\SQL2025',
      port: 0,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
      encrypt: true,
      trustServerCertificate: true,
      pooling: true,
      status: 'connected',
      isDefault: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }, 10);

    expect(config.server).toBe('localhost');
    expect(config.port).toBeUndefined();
    expect(config.options?.instanceName).toBe('SQL2025');
    expect(config.database).toBe('AppEnd');
  });

  it('builds SQL Server config with TCP port for a default instance', () => {
    const config = buildSqlServerConfig({
      id: 'ds_mssql_default',
      name: 'default-instance',
      type: 'SQL Server',
      host: 'localhost',
      port: 1433,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
      status: 'connected',
      isDefault: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }, 10);

    expect(config.server).toBe('localhost');
    expect(config.port).toBe(1433);
    expect(config.options?.instanceName).toBeUndefined();
  });

  it('returns EXPLAIN bytecode rows for SQLite instead of treating it as a write', async () => {
    const db = createTempSqliteDb('explain', 'explain@appendo.test');
    const sources: StoredDataSource[] = [
      {
        id: 'ds_explain',
        name: 'Explain SQLite',
        type: 'SQLite',
        host: 'localhost',
        port: 0,
        database: db.filePath,
        username: '',
        password: '',
        status: 'connected',
        isDefault: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const query = createEdgeDbQueryExecutor({ getDataSources: () => sources });
    const result = await query<Record<string, unknown>>('EXPLAIN SELECT email FROM users', []);

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]).not.toHaveProperty('affectedRows');
  });
});
