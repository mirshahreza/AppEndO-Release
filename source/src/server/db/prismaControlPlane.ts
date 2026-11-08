import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaMssql } from '@prisma/adapter-mssql';
import type { PrismaClient } from '../../generated/prisma/client';
import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils';
import type { Pool } from 'pg';
import { Pool as PgPool } from 'pg';
import { pathToFileURL } from 'node:url';

import {
  type ControlPlaneDatabaseSettings,
  type ControlPlaneDbProvider,
  ensureSqliteControlPlaneDirectory,
  parseSqliteControlPlaneFilePath,
  readControlPlaneDatabaseSettings,
} from './controlPlaneDatabase';
import { buildMssqlConfigFromControlPlaneUrl } from './mssqlControlPlaneConfig';
import { compileGeneratedPrismaClientForNode } from './generatedPrismaClientRuntime';
import {
  generatePrismaClientForRuntimeProvider,
  pushControlPlaneSchema,
  reconcilePrismaClientAfterSchemaOperation,
} from './controlPlaneSchemaPush';

const GLOBAL_PRISMA_KEY = '__appendPrismaControlPlane' as const;

type GlobalPrismaHost = typeof globalThis & {
  [GLOBAL_PRISMA_KEY]?: PrismaClient;
};

let prismaClient: PrismaClient | undefined;
let companionPgPool: Pool | undefined;
/** When true, companion pool is owned externally — do not call pool.end() on Prisma shutdown. */
let companionPgPoolExternal = false;

const readGlobalPrisma = (): PrismaClient | undefined =>
  (globalThis as GlobalPrismaHost)[GLOBAL_PRISMA_KEY];

const writeGlobalPrisma = (client: PrismaClient | undefined): void => {
  (globalThis as GlobalPrismaHost)[GLOBAL_PRISMA_KEY] = client;
};

const resolveActivePrisma = (): PrismaClient | undefined => prismaClient ?? readGlobalPrisma();

const applySqlitePragmas = async (client: PrismaClient): Promise<void> => {
  await client.$executeRawUnsafe('PRAGMA journal_mode = WAL');
  await client.$executeRawUnsafe('PRAGMA busy_timeout = 5000');
  await client.$executeRawUnsafe('PRAGMA foreign_keys = ON');
};

const parsePostgresUrl = (url: string): { connectionString: string } => ({ connectionString: url });

type PrismaClientConstructor = typeof import('../../generated/prisma/client').PrismaClient;

let prismaClientLoadGeneration = 0;

const loadPrismaClientClass = async (): Promise<PrismaClientConstructor> => {
  prismaClientLoadGeneration += 1;
  const runtimePath = compileGeneratedPrismaClientForNode();
  const moduleUrl = `${pathToFileURL(runtimePath).href}?g=${prismaClientLoadGeneration}`;
  const mod = await import(moduleUrl);
  return mod.PrismaClient;
};

const createPrismaClient = async (
  settings: ControlPlaneDatabaseSettings,
  adapter: SqlDriverAdapterFactory,
): Promise<PrismaClient> => {
  generatePrismaClientForRuntimeProvider(settings);
  const PrismaClientCtor = await loadPrismaClientClass();
  return new PrismaClientCtor({ adapter });
};

const parseMysqlUrl = (url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
};

type PrismaControlPlaneInitResult = {
  client: PrismaClient;
  /** Present when provider is postgresql — reused by logging batchers and readiness. */
  pgPool?: Pool;
  provider: ControlPlaneDbProvider;
};

const createAdapter = (
  settings: ControlPlaneDatabaseSettings,
): { adapter: SqlDriverAdapterFactory; pgPool?: Pool } => {
  const { provider, url } = settings;

  switch (provider) {
    case 'postgresql': {
      const pgPool = new PgPool({
        connectionString: url,
        max: 10,
        idleTimeoutMillis: 30_000,
      });
      return { adapter: new PrismaPg(pgPool), pgPool };
    }
    case 'mysql': {
      const mysql = parseMysqlUrl(url);
      return {
        adapter: new PrismaMariaDb({
          host: mysql.host,
          port: mysql.port,
          user: mysql.user,
          password: mysql.password,
          database: mysql.database,
          connectionLimit: 10,
        }),
      };
    }
    case 'sqlite': {
      const filePath = parseSqliteControlPlaneFilePath(url).replace(/\\/g, '/');
      ensureSqliteControlPlaneDirectory(filePath);
      return { adapter: new PrismaBetterSqlite3({ url: `file:${filePath}` }) };
    }
    case 'sqlserver': {
      return { adapter: new PrismaMssql(buildMssqlConfigFromControlPlaneUrl(url)) };
    }
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported control plane provider: ${exhaustive}`);
    }
  }
};

export const isPrismaControlPlaneReady = (): boolean => resolveActivePrisma() !== undefined;

export const getPrismaControlPlane = (): PrismaClient => {
  const client = resolveActivePrisma();
  if (!client) {
    throw new Error('Prisma control plane client is not initialized.');
  }
  prismaClient = client;
  return client;
};

/** Bind Prisma to an existing pg pool (pg-pool engine / tests) without owning the pool lifecycle. */
export const bindPrismaToPgPool = async (pool: Pool): Promise<PrismaClient> => {
  const client = await createPrismaClient(
    {
      provider: 'postgresql',
      url: process.env.DATABASE_URL?.trim()
        || 'postgresql://postgres:postgres@localhost:5432/appendo_prisma_generate',
      engine: 'prisma',
    },
    new PrismaPg(pool),
  );
  prismaClient = client;
  companionPgPool = pool;
  companionPgPoolExternal = true;
  writeGlobalPrisma(client);
  await client.$queryRaw`SELECT 1`;
  return client;
};

export const initPrismaControlPlane = async (
  settingsPath: string,
): Promise<PrismaControlPlaneInitResult> => {
  const settings = readControlPlaneDatabaseSettings(settingsPath);
  const { adapter, pgPool } = createAdapter(settings);
  const client = await createPrismaClient(settings, adapter);

  prismaClient = client;
  companionPgPool = pgPool;
  companionPgPoolExternal = false;
  writeGlobalPrisma(client);

  await client.$queryRaw`SELECT 1`;
  if (settings.provider === 'sqlite') {
    await applySqlitePragmas(client);
  }

  return { client, pgPool, provider: settings.provider };
};

export const initPrismaControlPlaneFromSettings = async (
  settings: ControlPlaneDatabaseSettings,
): Promise<PrismaControlPlaneInitResult> => {
  const { adapter, pgPool } = createAdapter(settings);
  const client = await createPrismaClient(settings, adapter);

  prismaClient = client;
  companionPgPool = pgPool;
  companionPgPoolExternal = false;
  writeGlobalPrisma(client);

  await client.$queryRaw`SELECT 1`;
  if (settings.provider === 'sqlite') {
    await applySqlitePragmas(client);
  }

  return { client, pgPool, provider: settings.provider };
};

/** When `expectedClient` is passed, only close if it is still the active client (install races). */
export const closePrismaControlPlane = async (expectedClient?: PrismaClient): Promise<void> => {
  const active = resolveActivePrisma();
  if (!active) {
    return;
  }
  if (expectedClient && active !== expectedClient) {
    return;
  }

  prismaClient = undefined;
  writeGlobalPrisma(undefined);

  await active.$disconnect();

  if (companionPgPool && !companionPgPoolExternal) {
    await companionPgPool.end();
  }
  companionPgPool = undefined;
  companionPgPoolExternal = false;
};
