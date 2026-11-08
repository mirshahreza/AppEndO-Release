import { Pool } from 'pg';
import {
  readDefaultDataSourceSecretInputFromSettings,
  resolveDataSourcePassword,
} from '../config/dataSourceSecrets';
import { readSettingsObject } from '../config/settingsFile';

const DEFAULT_PG = {
  host: 'localhost',
  port: 5432,
  database: 'AppEnd',
  user: 'postgres',
  password: '1',
};

export type PgPoolConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export const readPgPoolConfigFromSettings = (settingsPath: string): PgPoolConfig => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings.dataSources;
  const sources = Array.isArray(raw) ? raw : [];
  const defaultSource = sources.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean((item as Record<string, unknown>).isDefault);
  }) ?? sources[0];

  if (!defaultSource || typeof defaultSource !== 'object') {
    return {
      host: DEFAULT_PG.host,
      port: DEFAULT_PG.port,
      database: DEFAULT_PG.database,
      user: DEFAULT_PG.user,
      password: DEFAULT_PG.password,
    };
  }

  const item = defaultSource as Record<string, unknown>;
  const password = resolveDataSourcePassword(readDefaultDataSourceSecretInputFromSettings(settingsPath));

  return {
    host: String(item.host ?? DEFAULT_PG.host).trim() || DEFAULT_PG.host,
    port: Number(item.port ?? DEFAULT_PG.port) || DEFAULT_PG.port,
    database: String(item.database ?? DEFAULT_PG.database).trim() || DEFAULT_PG.database,
    user: String(item.username ?? DEFAULT_PG.user).trim() || DEFAULT_PG.user,
    password: password || DEFAULT_PG.password,
  };
};

export const readPgPoolConfigFromPayload = (payload: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): PgPoolConfig => ({
  host: payload.host,
  port: payload.port,
  database: payload.database,
  user: payload.username,
  password: payload.password,
});

export async function ensureDatabaseExistsForConfig(config: PgPoolConfig): Promise<void> {
  const adminPool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });

  try {
    await adminPool.query('SELECT 1');
    const existing = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database],
    );

    if ((existing.rowCount ?? 0) === 0) {
      await adminPool.query(`CREATE DATABASE "${config.database.replace(/"/g, '""')}"`);
    }
  } finally {
    await adminPool.end();
  }
}

export async function testPostgresServerLogin(config: PgPoolConfig): Promise<void> {
  const adminPool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });

  try {
    await adminPool.query('SELECT 1');
  } finally {
    await adminPool.end();
  }
}

export async function testTargetDatabaseConnection(config: PgPoolConfig): Promise<void> {
  const pool = new Pool(config);
  try {
    await pool.query('SELECT 1');
  } finally {
    await pool.end();
  }
}

export async function databaseHasAppSchema(config: PgPoolConfig): Promise<boolean> {
  const pool = new Pool(config);
  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'base_users'
       LIMIT 1`,
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

/** Drops all objects in public schema so initDB can recreate a clean AppEndO database. */
export async function resetAppDatabaseSchema(config: PgPoolConfig): Promise<void> {
  const pool = new Pool(config);
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO PUBLIC');
    await pool.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
  } finally {
    await pool.end();
  }
}
