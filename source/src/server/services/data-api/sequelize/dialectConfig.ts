import path from 'path';
import type { Options as SequelizeOptions } from 'sequelize';
import type { StoredDataSource } from '../../../db/dataSourcesStore';
import { appendoSequelizeProfilerOptions } from '../../../domain/perf/sequelizeQueryLogger';

const DEFAULT_POOL_MAX = 5;

const POSTGRES_DEFAULT_PORT = 5432;
const MYSQL_DEFAULT_PORT = 3306;
const SQL_SERVER_DEFAULT_PORT = 1433;
const ORACLE_DEFAULT_PORT = 1521;

const toPort = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const resolveSqliteStorage = (source: StoredDataSource): string => {
  const dbFile = String(source.database || 'database.sqlite').trim();
  return path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);
};

export type SupportedSequelizeDialect =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'mssql'
  | 'oracle';

export const mapDataSourceTypeToSequelizeDialect = (
  type: string,
): SupportedSequelizeDialect | null => {
  switch (type.trim()) {
    case 'PostgreSQL':
      return 'postgres';
    case 'MySQL':
      return 'mysql';
    case 'SQLite':
      return 'sqlite';
    case 'SQL Server':
      return 'mssql';
    case 'Oracle':
      return 'oracle';
    default:
      return null;
  }
};

export const buildSequelizeOptions = (source: StoredDataSource): SequelizeOptions => {
  const profiler = appendoSequelizeProfilerOptions(`edge:${source.id}`);
  const dialect = mapDataSourceTypeToSequelizeDialect(source.type);
  if (!dialect) {
    throw new Error(`Data source type "${source.type}" is not supported by Edge Sequelize Runtime.`);
  }

  const pool = {
    max: DEFAULT_POOL_MAX,
    min: 0,
    idle: 10_000,
    acquire: 30_000,
  };

  if (dialect === 'sqlite') {
    return {
      dialect: 'sqlite',
      storage: resolveSqliteStorage(source),
      ...profiler,
      pool,
      dialectOptions: {
        // Sequelize uses sqlite3 by default; better-sqlite3 is wired in the factory.
      },
    };
  }

  if (dialect === 'mssql') {
    // A named instance (`host\instance`, e.g. "localhost\SQL2025") must be split for
    // Sequelize/tedious: pass the bare hostname as `host` and the instance separately
    // as `dialectOptions.options.instanceName`, with no explicit `port` — SQL Server
    // Browser resolves the instance's dynamic port. Passing the combined "host\instance"
    // string as `host` alongside a port (as the raw `mssql`/tedious driver elsewhere in
    // this codebase tolerates) fails here with "Could not connect (sequence)".
    const rawHost = source.host || 'localhost';
    const backslashIndex = rawHost.indexOf('\\');
    const hasInstanceName = backslashIndex >= 0;
    const hostName = hasInstanceName ? rawHost.slice(0, backslashIndex) : rawHost;
    const instanceName = hasInstanceName ? rawHost.slice(backslashIndex + 1) : undefined;

    return {
      dialect: 'mssql',
      host: hostName,
      ...(hasInstanceName ? {} : { port: toPort(source.port, SQL_SERVER_DEFAULT_PORT) }),
      database: source.database || undefined,
      username: source.username || undefined,
      password: source.password || undefined,
      ...profiler,
      pool,
      dialectOptions: {
        options: {
          encrypt: source.encrypt !== false,
          trustServerCertificate: source.trustServerCertificate !== false,
          ...(instanceName ? { instanceName } : {}),
        },
      },
    };
  }

  if (dialect === 'oracle') {
    const connectString = source.database?.trim()
      ? source.database.trim()
      : `${source.host || 'localhost'}:${toPort(source.port, ORACLE_DEFAULT_PORT)}/${source.database || 'XE'}`;

    return {
      dialect: 'oracle',
      username: source.username || undefined,
      password: source.password || undefined,
      ...profiler,
      pool,
      dialectOptions: {
        connectString,
      },
    };
  }

  return {
    dialect,
    host: source.host || 'localhost',
    port: toPort(
      source.port,
      dialect === 'mysql' ? MYSQL_DEFAULT_PORT : POSTGRES_DEFAULT_PORT,
    ),
    database: source.database || undefined,
    username: source.username || undefined,
    password: source.password || undefined,
    ...profiler,
    pool,
  };
};
