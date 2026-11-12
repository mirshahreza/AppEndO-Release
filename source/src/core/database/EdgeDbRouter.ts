import path from 'path';
import Database from 'better-sqlite3';
import * as mssql from 'mssql';
import { Connection as TediousConnection, Request as TediousRequest } from 'tedious';
import { sqlServerRowsLookLikeShowPlan, unwrapLeadingExplainSql } from '../../shared/lib/executeDataSourceQuery';
import { parseSqlServerHost } from '../../shared/lib/sqlServerAddress';
import {
  applyDirectTcpPortToSqlServerConfig,
  isLikelyLocalSqlHost,
  resolveLocalSqlInstancePortFromRegistry,
} from './sqlServerLocalInstancePort';
import { useWindowsIntegratedSqlForServer } from '../../server/db/localWindowsSqlIntegrated';

export type StoredDataSource = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  pooling?: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  isDefault: boolean;
  created_at: string;
  updated_at: string;
};

export type EdgeDbQueryContext = {
  dataSourceId?: string;
  dataSourceName?: string;
  database?: string;
};

export type EdgeDbQueryResult<T = unknown> = {
  data: T[];
  count: number;
  source: {
    id: string;
    name: string;
    type: string;
  };
};

type CreateEdgeDbQueryExecutorOptions = {
  getDataSources: () => StoredDataSource[];
};

const SQL_SERVER_DEFAULT_PORT = 1433;
const POSTGRES_DEFAULT_PORT = 5432;
const MYSQL_DEFAULT_PORT = 3306;
const ORACLE_DEFAULT_PORT = 1521;

const sqlServerClient = ((mssql as any)?.default ?? mssql) as typeof mssql;

const sqliteConnectionCache = new Map<string, Database.Database>();
const sqlServerPoolCache = new Map<string, mssql.ConnectionPool>();
const sqlServerPoolConnectInflight = new Map<string, Promise<mssql.ConnectionPool>>();
const sqlServerNamedInstancePortCache = new Map<string, number>();
const pgPoolCache = new Map<string, any>();
const mysqlPoolCache = new Map<string, any>();
const oracleConnectionCache = new Map<string, any>();

const toPort = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
};

const toSqlServerBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const resolveSqlitePath = (source: StoredDataSource, context?: EdgeDbQueryContext) => {
  const dbFile = String(context?.database || source.database || 'database.sqlite').trim();
  return path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);
};

const ensureSqliteConnection = (source: StoredDataSource, context?: EdgeDbQueryContext) => {
  const resolvedPath = resolveSqlitePath(source, context);
  const cached = sqliteConnectionCache.get(resolvedPath);
  if (cached) return cached;

  const connection = new Database(resolvedPath);
  connection.pragma('journal_mode = WAL');
  sqliteConnectionCache.set(resolvedPath, connection);
  return connection;
};

const runSqliteQuery = async <T>(
  source: StoredDataSource,
  sql: string,
  params: unknown[] = [],
  context?: EdgeDbQueryContext,
): Promise<EdgeDbQueryResult<T>> => {
  const connection = ensureSqliteConnection(source, context);
  const stmt = connection.prepare(sql);

  const isRead = /^\s*(select|pragma|with|explain)\b/i.test(sql);
  if (isRead) {
    const rows = stmt.all(...params as any[]) as T[];
    return {
      data: rows,
      count: rows.length,
      source: { id: source.id, name: source.name, type: source.type },
    };
  }

  const result = stmt.run(...params as any[]);
  const affected = Number(result.changes || 0);
  return {
    data: [{ affectedRows: affected, lastInsertRowid: Number(result.lastInsertRowid || 0) }] as T[],
    count: affected,
    source: { id: source.id, name: source.name, type: source.type },
  };
};

const convertQuestionMarkSql = (sql: string, params: unknown[], prefix: string) => {
  if (!Array.isArray(params) || params.length === 0) {
    return { sql, binds: [] as Array<{ name: string; value: unknown }> };
  }

  let index = 0;
  const nextSql = sql.replace(/\?/g, () => {
    index += 1;
    return `${prefix}${index}`;
  });

  const binds = params.map((value, i) => ({
    name: `${prefix.slice(1)}${i + 1}`,
    value,
  }));

  return { sql: nextSql, binds };
};

/** Exported for unit tests — named instances must not force TCP 1433. */
export const buildSqlServerConfig = (source: StoredDataSource, poolMax: number): mssql.config => {
  const { server, instanceName, port: hostPort } = parseSqlServerHost(source.host || 'localhost');
  const storedPort = Number(source.port);
  const explicitPort = Number.isFinite(storedPort) && storedPort > 0 ? storedPort : null;
  const namedInstance = Boolean(instanceName);
  const port = namedInstance ? null : (explicitPort ?? hostPort ?? SQL_SERVER_DEFAULT_PORT);

  const windowsIntegrated = useWindowsIntegratedSqlForServer(server || 'localhost', source.password ?? '');

  return {
    ...(windowsIntegrated
      ? {}
      : {
          user: source.username || undefined,
          password: source.password || undefined,
        }),
    server: server || 'localhost',
    ...(port ? { port } : {}),
    database: source.database || undefined,
    connectionTimeout: 60_000,
    requestTimeout: 60_000,
    options: {
      encrypt: toSqlServerBoolean(source.encrypt, true),
      trustServerCertificate: toSqlServerBoolean(source.trustServerCertificate, true),
      connectTimeout: 60_000,
      requestTimeout: 60_000,
      ...(windowsIntegrated ? { trustedConnection: true } : {}),
      ...(namedInstance ? { instanceName } : {}),
    },
    pool: {
      min: 0,
      max: poolMax,
      idleTimeoutMillis: 30000,
    },
  };
};

const sqlServerPoolCacheKey = (source: StoredDataSource) => `mssql:${source.id}`;

const resolveSqlServerConnectConfig = async (
  source: StoredDataSource,
  poolMax: number,
): Promise<mssql.config> => {
  const config = buildSqlServerConfig(source, poolMax);
  const instanceName = String((config.options as { instanceName?: string } | undefined)?.instanceName || '').trim();
  const server = String(config.server || 'localhost');
  if (!instanceName || config.port || !isLikelyLocalSqlHost(server)) {
    return config;
  }

  const portCacheKey = `${server}\\${instanceName}`.toLowerCase();
  const cachedPort = sqlServerNamedInstancePortCache.get(portCacheKey);
  const discoveredPort = cachedPort ?? await resolveLocalSqlInstancePortFromRegistry(instanceName);
  if (!discoveredPort) {
    return config;
  }

  sqlServerNamedInstancePortCache.set(portCacheKey, discoveredPort);
  return applyDirectTcpPortToSqlServerConfig(config, discoveredPort);
};

const isSqlServerPoolUsable = (pool: mssql.ConnectionPool | undefined): pool is mssql.ConnectionPool => {
  if (!pool) return false;
  if ((pool as { closed?: boolean }).closed) return false;
  return Boolean(pool.connected || pool.connecting);
};

const closeSqlServerPoolQuietly = async (pool: mssql.ConnectionPool | undefined) => {
  if (!pool) return;
  try {
    await pool.close();
  } catch {
    // Stale or already-closed pool.
  }
};

const openSqlServerPool = async (source: StoredDataSource, poolMax: number): Promise<mssql.ConnectionPool> => {
  const pool = new sqlServerClient.ConnectionPool(await resolveSqlServerConnectConfig(source, poolMax));
  await pool.connect();
  return pool;
};

const ensureSqlServerPool = async (source: StoredDataSource): Promise<mssql.ConnectionPool> => {
  const cacheKey = sqlServerPoolCacheKey(source);
  const cached = sqlServerPoolCache.get(cacheKey);
  if (isSqlServerPoolUsable(cached)) {
    return cached;
  }

  const inflight = sqlServerPoolConnectInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const pending = (async () => {
    const existing = sqlServerPoolCache.get(cacheKey);
    if (isSqlServerPoolUsable(existing)) {
      return existing;
    }

    sqlServerPoolCache.delete(cacheKey);
    await closeSqlServerPoolQuietly(existing);

    const pool = await openSqlServerPool(source, source.pooling ? 10 : 1);
    sqlServerPoolCache.set(cacheKey, pool);
    return pool;
  })();

  sqlServerPoolConnectInflight.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    sqlServerPoolConnectInflight.delete(cacheKey);
  }
};

const dropCachedSqlServerPool = async (source: StoredDataSource) => {
  const cacheKey = sqlServerPoolCacheKey(source);
  const cached = sqlServerPoolCache.get(cacheKey);
  sqlServerPoolCache.delete(cacheKey);
  await closeSqlServerPoolQuietly(cached);
};

const isSqlServerConnectionClosedError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /connection is closed/i.test(message);
};

const toSqlServerQueryResult = <T>(
  source: StoredDataSource,
  result: { recordset?: T[]; rowsAffected?: number[] },
): EdgeDbQueryResult<T> => {
  const rows = (result.recordset || []) as T[];
  const count = Array.isArray(rows) ? rows.length : Number(result.rowsAffected?.[0] || 0);
  return {
    data: rows,
    count,
    source: { id: source.id, name: source.name, type: source.type },
  };
};

const querySqlServerPool = async <T>(
  source: StoredDataSource,
  pool: mssql.ConnectionPool,
  sql: string,
  params: unknown[] = [],
): Promise<EdgeDbQueryResult<T>> => {
  const converted = convertQuestionMarkSql(sql, params, '@p');
  const request = pool.request();
  for (const bind of converted.binds) {
    request.input(bind.name, bind.value as any);
  }
  const result = await request.query(converted.sql);
  return toSqlServerQueryResult<T>(source, result);
};

const openTediousConnection = async (source: StoredDataSource): Promise<TediousConnection> => {
  const config = await resolveSqlServerConnectConfig(source, 1);
  const instanceName = String((config.options as { instanceName?: string } | undefined)?.instanceName || '').trim();
  const connection = new TediousConnection({
    server: String(config.server || 'localhost'),
    authentication: {
      type: 'default',
      options: {
        userName: config.user || '',
        password: config.password || '',
      },
    },
    options: {
      ...(typeof config.port === 'number' ? { port: config.port } : {}),
      ...(instanceName ? { instanceName } : {}),
      database: config.database,
      encrypt: Boolean(config.options?.encrypt),
      trustServerCertificate: Boolean(config.options?.trustServerCertificate),
      connectTimeout: Number(config.connectionTimeout || 60_000),
      requestTimeout: Number(config.requestTimeout || 60_000),
      rowCollectionOnRequestCompletion: true,
    },
  });

  return new Promise((resolve, reject) => {
    connection.on('error', () => {
      // Request callbacks surface failures; this avoids an unhandled 'error' crash.
    });
    connection.connect((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(connection);
    });
  });
};

const runTediousBatch = (
  connection: TediousConnection,
  sqlText: string,
): Promise<{ recordset: Record<string, unknown>[] }> => (
  new Promise((resolve, reject) => {
    const recordset: Record<string, unknown>[] = [];
    const request = new TediousRequest(sqlText, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ recordset });
    });
    request.on('row', (columns) => {
      const row: Record<string, unknown> = {};
      for (const column of columns as Array<{ metadata?: { colName?: string }; value?: unknown }>) {
        const name = String(column.metadata?.colName || '').trim() || `column_${Object.keys(row).length}`;
        row[name] = column.value ?? null;
      }
      recordset.push(row);
    });
    connection.execSqlBatch(request);
  })
);

/**
 * SHOWPLAN is session-scoped, parse-time, and must be a batch (not sp_executesql).
 * node-mssql `.query()` uses sp_executesql and resets the connection between requests,
 * so SHOWPLAN never sticks and the inner SELECT actually runs.
 */
const runSqlServerShowPlan = async <T>(
  source: StoredDataSource,
  innerSql: string,
): Promise<EdgeDbQueryResult<T>> => {
  const connection = await openTediousConnection(source);
  try {
    await runTediousBatch(connection, 'SET SHOWPLAN_ALL ON');
    const converted = convertQuestionMarkSql(innerSql, [], '@p');
    const result = await runTediousBatch(connection, converted.sql);
    if (!sqlServerRowsLookLikeShowPlan(result.recordset)) {
      throw new Error('SQL Server executed the statement instead of returning a query plan.');
    }
    return toSqlServerQueryResult<T>(source, result);
  } finally {
    try {
      await runTediousBatch(connection, 'SET SHOWPLAN_ALL OFF');
    } catch {
      // Connection is closed next.
    }
    connection.close();
  }
};

const runSqlServerQuery = async <T>(
  source: StoredDataSource,
  sql: string,
  params: unknown[] = [],
): Promise<EdgeDbQueryResult<T>> => {
  const explainInner = unwrapLeadingExplainSql(sql);
  if (explainInner) {
    return runSqlServerShowPlan<T>(source, explainInner);
  }

  const pool = await ensureSqlServerPool(source);
  try {
    return await querySqlServerPool<T>(source, pool, sql, params);
  } catch (error) {
    if (!isSqlServerConnectionClosedError(error)) {
      throw error;
    }
    await dropCachedSqlServerPool(source);
    const retryPool = await ensureSqlServerPool(source);
    return querySqlServerPool<T>(source, retryPool, sql, params);
  }
};

const runPostgresQuery = async <T>(
  source: StoredDataSource,
  sql: string,
  params: unknown[] = [],
): Promise<EdgeDbQueryResult<T>> => {
  let pool = pgPoolCache.get(`pg:${source.id}`);
  if (!pool) {
    const moduleName = 'pg';
    const pgModule = await import(moduleName);
    const PoolCtor = (pgModule as any).Pool;
    pool = new PoolCtor({
      host: source.host || 'localhost',
      port: toPort(source.port, POSTGRES_DEFAULT_PORT),
      user: source.username || undefined,
      password: source.password || undefined,
      database: source.database || undefined,
      max: source.pooling ? 10 : 1,
    });
    pgPoolCache.set(`pg:${source.id}`, pool);
  }

  // Convert ? placeholders to PostgreSQL $1, $2, … positional params.
  // String binds get ::text so information_schema domains / format() cannot leave $n untyped.
  let pIndex = 0;
  const pgSql = sql.replace(/\?/g, () => {
    const value = params[pIndex];
    const placeholder = `$${++pIndex}`;
    return typeof value === 'string' ? `${placeholder}::text` : placeholder;
  });
  const result = await pool.query(pgSql, params as any[]);
  const rows = (result.rows || []) as T[];
  return {
    data: rows,
    count: Number(result.rowCount || rows.length),
    source: { id: source.id, name: source.name, type: source.type },
  };
};

const runMySqlQuery = async <T>(
  source: StoredDataSource,
  sql: string,
  params: unknown[] = [],
): Promise<EdgeDbQueryResult<T>> => {
  let pool = mysqlPoolCache.get(source.id);
  if (!pool) {
    const moduleName = 'mysql2/promise';
    const mysqlModule = await import(moduleName);
    const createPool = (mysqlModule as any).createPool;
    pool = createPool({
      host: source.host || 'localhost',
      port: toPort(source.port, MYSQL_DEFAULT_PORT),
      user: source.username || undefined,
      password: source.password || undefined,
      database: source.database || undefined,
      waitForConnections: true,
      connectionLimit: source.pooling ? 10 : 1,
      queueLimit: 0,
    });
    mysqlPoolCache.set(source.id, pool);
  }

  const [rows] = await pool.execute(sql, params as any[]);
  if (Array.isArray(rows)) {
    return {
      data: rows as T[],
      count: rows.length,
      source: { id: source.id, name: source.name, type: source.type },
    };
  }

  const affectedRows = Number((rows as any)?.affectedRows || 0);
  return {
    data: [{ affectedRows }] as T[],
    count: affectedRows,
    source: { id: source.id, name: source.name, type: source.type },
  };
};

const runOracleQuery = async <T>(
  source: StoredDataSource,
  sql: string,
  params: unknown[] = [],
): Promise<EdgeDbQueryResult<T>> => {
  let connection = oracleConnectionCache.get(source.id);
  if (!connection) {
    const moduleName = 'oracledb';
    const oracleModule = await import(moduleName);
    const oracledb = (oracleModule as any).default ?? oracleModule;

    const connectString = source.database
      ? `${source.host || 'localhost'}:${toPort(source.port, ORACLE_DEFAULT_PORT)}/${source.database}`
      : `${source.host || 'localhost'}:${toPort(source.port, ORACLE_DEFAULT_PORT)}`;

    connection = await oracledb.getConnection({
      user: source.username || undefined,
      password: source.password || undefined,
      connectString,
    });

    oracleConnectionCache.set(source.id, connection);
  }

  const converted = convertQuestionMarkSql(sql, params, ':p');
  const binds: Record<string, unknown> = {};
  for (const bind of converted.binds) {
    binds[bind.name] = bind.value;
  }

  const result = await connection.execute(converted.sql, binds, {
    outFormat: 4002,
    autoCommit: true,
  });

  const rows = ((result.rows || []) as T[]);
  const count = Array.isArray(rows)
    ? rows.length
    : Number((result as any)?.rowsAffected || 0);

  return {
    data: rows,
    count,
    source: { id: source.id, name: source.name, type: source.type },
  };
};

const resolveDataSource = (sources: StoredDataSource[], context?: EdgeDbQueryContext): StoredDataSource => {
  if (sources.length === 0) {
    throw new Error('No data source is configured. Add at least one data source first.');
  }

  const byId = String(context?.dataSourceId || '').trim();
  if (byId) {
    const source = sources.find((item) => item.id === byId);
    if (!source) {
      throw new Error(`Data source not found: ${byId}`);
    }
    return source;
  }

  const byName = String(context?.dataSourceName || '').trim().toLowerCase();
  if (byName) {
    const source = sources.find((item) => item.name.toLowerCase() === byName);
    if (!source) {
      throw new Error(`Data source not found: ${context?.dataSourceName}`);
    }
    return source;
  }

  const defaultSource = sources.find((item) => item.isDefault);
  return defaultSource || sources[0];
};

export const resetEdgeDbRouterCaches = async () => {
  for (const connection of sqliteConnectionCache.values()) {
    try {
      connection.close();
    } catch {
      // Ignore close failures during cleanup.
    }
  }
  sqliteConnectionCache.clear();

  for (const pool of sqlServerPoolCache.values()) {
    await closeSqlServerPoolQuietly(pool);
  }
  sqlServerPoolCache.clear();
  sqlServerPoolConnectInflight.clear();
  sqlServerNamedInstancePortCache.clear();

  for (const pool of pgPoolCache.values()) {
    try {
      if (typeof pool?.close === 'function') {
        await pool.close();
      } else if (typeof pool?.end === 'function') {
        await pool.end();
      }
    } catch {
      // Ignore cleanup failures during tests/process shutdown.
    }
  }
  pgPoolCache.clear();

  for (const pool of mysqlPoolCache.values()) {
    try {
      if (typeof pool?.end === 'function') {
        await pool.end();
      }
    } catch {
      // Ignore cleanup failures during tests/process shutdown.
    }
  }
  mysqlPoolCache.clear();

  for (const connection of oracleConnectionCache.values()) {
    try {
      if (typeof connection?.close === 'function') {
        await connection.close();
      }
    } catch {
      // Ignore cleanup failures during tests/process shutdown.
    }
  }
  oracleConnectionCache.clear();
};

export const createEdgeDbQueryExecutor = ({
  getDataSources,
}: CreateEdgeDbQueryExecutorOptions) => {
  return async <T = unknown>(
    operation: string,
    params: unknown[] = [],
    context?: EdgeDbQueryContext,
  ): Promise<EdgeDbQueryResult<T>> => {
    const sources = getDataSources();
    const source = resolveDataSource(sources, context);

    if (source.type === 'SQLite') {
      return runSqliteQuery<T>(source, operation, params, context);
    }

    if (source.type === 'SQL Server') {
      return runSqlServerQuery<T>(source, operation, params);
    }

    if (source.type === 'PostgreSQL') {
      return runPostgresQuery<T>(source, operation, params);
    }

    if (source.type === 'MySQL') {
      return runMySqlQuery<T>(source, operation, params);
    }

    if (source.type === 'Oracle') {
      return runOracleQuery<T>(source, operation, params);
    }

    throw new Error(`Data source type is not supported for query execution: ${source.type}`);
  };
};
