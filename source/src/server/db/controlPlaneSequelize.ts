import { Sequelize, type Dialect, type Options } from 'sequelize';
import { SETTINGS_PATH } from '../config/settingsFile';
import {
  parseSqliteControlPlaneFilePath,
  readControlPlaneDatabaseSettings,
  type ControlPlaneDbProvider,
} from './controlPlaneDatabase';
import { buildMssqlConfigFromControlPlaneUrl } from './mssqlControlPlaneConfig';
import { appendoSequelizeProfilerOptions } from '../domain/perf/sequelizeQueryLogger';

const GLOBAL_KEY = '__appendControlPlaneSequelize' as const;

type GlobalSequelizeHost = typeof globalThis & {
  [GLOBAL_KEY]?: Sequelize;
};

export const dialectForProvider = (provider: ControlPlaneDbProvider): Dialect => {
  switch (provider) {
    case 'postgresql':
      return 'postgres';
    case 'mysql':
      return 'mysql';
    case 'sqlite':
      return 'sqlite';
    case 'sqlserver':
      return 'mssql';
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported control plane provider: ${exhaustive}`);
    }
  }
};

const sqliteStorageFromUrl = (url: string): string => parseSqliteControlPlaneFilePath(url);

const postgresUrl = (url: string): string => url.replace(/^postgresql:/i, 'postgres:');

const DEFAULT_IN_DEFINITION = /\s+DEFAULT\s+([\s\S]+)$/i;

const physicalTableName = (tableName: unknown): string => {
  if (typeof tableName === 'string') {
    return tableName.replace(/^\[|\]$/g, '');
  }
  if (tableName && typeof tableName === 'object' && 'tableName' in tableName) {
    return String((tableName as { tableName: string }).tableName).replace(/^\[|\]$/g, '');
  }
  return String(tableName);
};

/**
 * Sequelize emits `ALTER COLUMN ... DEFAULT`, which SQL Server rejects.
 * Keep the type change, then apply the default as a named constraint.
 */
export const rewriteMssqlChangeColumnQuery = (
  tableName: unknown,
  attributes: Record<string, string>,
  changeColumnQuery: (tableName: unknown, attributes: Record<string, string>) => string,
): string => {
  const stripped: Record<string, string> = {};
  const defaults: Array<{ column: string; defaultSql: string }> = [];
  for (const [column, definition] of Object.entries(attributes)) {
    const match = definition.match(DEFAULT_IN_DEFINITION);
    if (match && match.index != null) {
      stripped[column] = definition.slice(0, match.index).trim();
      defaults.push({ column, defaultSql: match[1].trim() });
    } else {
      stripped[column] = definition;
    }
  }

  const alterSql = changeColumnQuery(tableName, stripped);
  if (defaults.length === 0) {
    return alterSql;
  }

  const table = physicalTableName(tableName);
  const quotedTable = `[${table}]`;
  const extra = defaults.map(({ column, defaultSql }, index) => {
    const varName = `@df_${index}`;
    const constraint = `DF_${table}_${column}`.replace(/[^\w]/g, '_').slice(0, 128);
    const safeColumn = column.replace(/'/g, "''");
    return [
      `DECLARE ${varName} sysname;`,
      `SELECT ${varName} = dc.name`,
      'FROM sys.default_constraints dc',
      'INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id',
      `WHERE dc.parent_object_id = OBJECT_ID(N'${quotedTable}', N'U')`,
      `  AND c.name = N'${safeColumn}';`,
      `IF ${varName} IS NOT NULL EXEC(N'ALTER TABLE ${quotedTable} DROP CONSTRAINT [' + ${varName} + N']');`,
      `ALTER TABLE ${quotedTable} ADD CONSTRAINT [${constraint}] DEFAULT ${defaultSql} FOR [${column}];`,
    ].join('\n');
  }).join('\n');

  return `${alterSql}\n${extra}`;
};

type MssqlQueryGenerator = {
  changeColumnQuery: (tableName: unknown, attributes: Record<string, string>) => string;
};

export const patchMssqlAlterColumnDefaults = (sequelize: Sequelize): void => {
  if (sequelize.getDialect() !== 'mssql') {
    return;
  }
  const generator = sequelize.dialect.queryGenerator as MssqlQueryGenerator;
  if ((generator as { __appendoDefaultPatch?: boolean }).__appendoDefaultPatch) {
    return;
  }
  const original = generator.changeColumnQuery.bind(generator);
  generator.changeColumnQuery = (tableName, attributes) =>
    rewriteMssqlChangeColumnQuery(tableName, attributes, original);
  (generator as { __appendoDefaultPatch?: boolean }).__appendoDefaultPatch = true;
};

/** Prisma stores `sqlserver://`; Sequelize only accepts dialect `mssql` and rejects that URL protocol. */
export const buildMssqlControlPlaneSequelizeOptions = (url: string): Options => {
  const config = buildMssqlConfigFromControlPlaneUrl(url);
  return {
    dialect: 'mssql',
    host: config.server,
    ...(typeof config.port === 'number' ? { port: config.port } : {}),
    database: config.database,
    username: config.user,
    password: config.password,
    dialectOptions: {
      options: {
        encrypt: config.options?.encrypt,
        trustServerCertificate: config.options?.trustServerCertificate,
        connectTimeout: config.options?.connectTimeout,
        requestTimeout: config.options?.requestTimeout,
        ...(config.options?.instanceName ? { instanceName: config.options.instanceName } : {}),
      },
    },
  };
};

const createSequelize = (): Sequelize => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  const dialect = dialectForProvider(settings.provider);
  const profiler = appendoSequelizeProfilerOptions('control-plane');
  if (dialect === 'sqlite') {
    return new Sequelize({
      dialect,
      storage: sqliteStorageFromUrl(settings.url),
      ...profiler,
    });
  }
  if (dialect === 'mssql') {
    const sequelize = new Sequelize({
      ...buildMssqlControlPlaneSequelizeOptions(settings.url),
      ...profiler,
    });
    patchMssqlAlterColumnDefaults(sequelize);
    return sequelize;
  }
  return new Sequelize(postgresUrl(settings.url), { dialect, ...profiler });
};

export const getControlPlaneSequelize = (): Sequelize => {
  const host = globalThis as GlobalSequelizeHost;
  if (!host[GLOBAL_KEY]) {
    host[GLOBAL_KEY] = createSequelize();
  }
  return host[GLOBAL_KEY];
};

export const closeControlPlaneSequelize = async (): Promise<void> => {
  const host = globalThis as GlobalSequelizeHost;
  const instance = host[GLOBAL_KEY];
  if (!instance) {
    return;
  }
  host[GLOBAL_KEY] = undefined;
  await instance.close();
};

/** SQLite `alter: true` recreates tables and breaks composite unique indexes. */
export const controlPlaneSequelizeSyncOptions = (sequelize: Sequelize): { alter?: true } => (
  sequelize.getDialect() === 'sqlite' ? {} : { alter: true }
);
