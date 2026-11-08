import fs from 'fs';
import path from 'path';

import {
  DEFAULT_CONTROL_PLANE_PROVIDER,
  controlPlaneProviderFromDataSourceType,
} from '../../shared/api/contracts/install/controlPlaneProviders';
import { buildSqlServerHostToken } from '../../shared/lib/sqlServerAddress';
import {
  readDefaultDataSourceSecretInputFromSettings,
  resolveDataSourcePassword,
} from '../config/dataSourceSecrets';
import { readSettingsObject } from '../config/settingsFile';
import { readPgPoolConfigFromSettings } from '../setup/installDatabase';
import { stripControlPlaneUrlPassword, withControlPlaneUrlPassword } from './controlPlaneUrlPassword';

/** Control-plane relational providers supported by Prisma v1 (p-45). */
export type ControlPlaneDbProvider = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

/** Persistence engine for control plane — `pg-pool` legacy or `prisma` (p-45). */
export type ControlPlaneEngine = 'pg-pool' | 'prisma';

export type ControlPlaneDatabaseSettings = {
  provider: ControlPlaneDbProvider;
  url: string;
  engine: ControlPlaneEngine;
};

const PROVIDER_ALIASES: Record<string, ControlPlaneDbProvider> = {
  postgres: 'postgresql',
  postgresql: 'postgresql',
  pg: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  sqlserver: 'sqlserver',
  mssql: 'sqlserver',
};

export const normalizeControlPlaneProvider = (value: unknown): ControlPlaneDbProvider | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return PROVIDER_ALIASES[normalized];
};

const escapeSqlServerValue = (value: string): string => {
  if (/[\\=;[\]{}]/.test(value)) {
    return `{${value.replace(/}/g, '}}')}`;
  }
  return value;
};

const encodeCredential = (value: string): string => encodeURIComponent(value);

const readDefaultDataSourceRecord = (
  settingsPath: string,
): Record<string, unknown> | undefined => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings.dataSources;
  const sources = Array.isArray(raw) ? raw : [];
  const defaultSource = sources.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean((item as Record<string, unknown>).isDefault);
  }) ?? sources[0];
  if (!defaultSource || typeof defaultSource !== 'object') {
    return undefined;
  }
  return defaultSource as Record<string, unknown>;
};

const providerFromDefaultDataSource = (settingsPath: string): ControlPlaneDbProvider | undefined => {
  const item = readDefaultDataSourceRecord(settingsPath);
  if (!item) return undefined;
  return controlPlaneProviderFromDataSourceType(String(item.type ?? ''));
};

const buildPostgresUrlFromLegacySettings = (settingsPath: string): string => {
  const config = readPgPoolConfigFromSettings(settingsPath);
  const user = encodeURIComponent(config.user);
  const password = encodeURIComponent(config.password);
  const host = config.host;
  const port = config.port;
  const database = encodeURIComponent(config.database);
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
};

const buildUrlFromDefaultDataSource = (
  provider: ControlPlaneDbProvider,
  settingsPath: string,
): string => {
  const item = readDefaultDataSourceRecord(settingsPath);
  if (!item) {
    return provider === 'postgresql' ? buildPostgresUrlFromLegacySettings(settingsPath) : '';
  }

  const password = resolveDataSourcePassword(readDefaultDataSourceSecretInputFromSettings(settingsPath));
  const host = String(item.host ?? 'localhost').trim() || 'localhost';
  const port = Number(item.port ?? 0);
  const database = String(item.database ?? 'AppEnd').trim() || 'AppEnd';
  const username = String(item.username ?? '').trim();

  if (provider === 'sqlserver') {
    const hostToken = buildSqlServerHostToken(host, Number.isFinite(port) ? port : 0);
    const encrypt = item.encrypt === false ? 'false' : 'true';
    const trust = item.trustServerCertificate === false ? 'false' : 'true';
    return `sqlserver://${hostToken};database=${escapeSqlServerValue(database)};user=${escapeSqlServerValue(username)};password=${escapeSqlServerValue(password)};encrypt=${encrypt};trustServerCertificate=${trust}`;
  }

  if (provider === 'mysql') {
    const user = encodeCredential(username);
    const encodedPassword = encodeCredential(password);
    const db = encodeCredential(database);
    const mysqlPort = Number.isFinite(port) && port > 0 ? port : 3306;
    return `mysql://${user}:${encodedPassword}@${host}:${mysqlPort}/${db}`;
  }

  if (provider === 'postgresql') {
    return buildPostgresUrlFromLegacySettings(settingsPath);
  }

  return '';
};

const readDatabaseBlock = (settingsPath: string): Record<string, unknown> | undefined => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings.database;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as Record<string, unknown>;
};

const resolveStoredControlPlaneProvider = (settingsPath: string): ControlPlaneDbProvider => {
  const block = readDatabaseBlock(settingsPath);
  const runtime = readSettingsObject(settingsPath).runtime;
  const fromBlock = normalizeControlPlaneProvider(block?.provider);
  if (fromBlock) return fromBlock;

  const fromDataSource = providerFromDefaultDataSource(settingsPath);
  if (fromDataSource) return fromDataSource;

  const fromRuntime = normalizeControlPlaneProvider(
    (runtime as Record<string, unknown> | undefined)?.databaseProvider,
  );
  if (fromRuntime) return fromRuntime;

  return DEFAULT_CONTROL_PLANE_PROVIDER;
};

/** Resolve control-plane DB config from settings.json (`database` block with stored fallbacks). */
export const readControlPlaneDatabaseSettings = (settingsPath: string): ControlPlaneDatabaseSettings => {
  const block = readDatabaseBlock(settingsPath);
  const provider = resolveStoredControlPlaneProvider(settingsPath);
  const storedUrl = String(block?.url ?? '').trim()
    || buildUrlFromDefaultDataSource(provider, settingsPath);
  const password = resolveDataSourcePassword(readDefaultDataSourceSecretInputFromSettings(settingsPath));
  const url = withControlPlaneUrlPassword(
    provider,
    stripControlPlaneUrlPassword(provider, storedUrl),
    password,
  );
  const explicitEngine = String(block?.engine ?? '').trim().toLowerCase();
  const engine: ControlPlaneEngine = provider !== 'postgresql'
    ? 'prisma'
    : (explicitEngine === 'pg-pool' ? 'pg-pool' : 'prisma');

  return { provider, url, engine };
};

/** Default SQLite file path for local / smoke installs. */
const defaultSqliteControlPlanePath = (): string =>
  path.join(process.cwd(), 'data', 'appendo-control.db');

const SQLITE_SIDECAR_SUFFIXES = ['', '-wal', '-shm', '-journal'] as const;

const toPosixPath = (filePath: string): string => filePath.replace(/\\/g, '/');

/** Resolve a `file:` Prisma URL or raw path to an absolute filesystem path. */
export const parseSqliteControlPlaneFilePath = (urlOrPath: string): string => {
  let raw = urlOrPath.trim();
  if (raw.toLowerCase().startsWith('file:')) {
    raw = raw.slice('file:'.length);
  }
  if (raw.startsWith('///')) {
    raw = raw.slice(3);
  } else if (/^\/\/localhost\//i.test(raw)) {
    raw = raw.replace(/^\/\/localhost\//i, '');
  }
  return path.resolve(raw);
};

export const ensureSqliteControlPlaneDirectory = (urlOrPath: string): void => {
  const dir = path.dirname(parseSqliteControlPlaneFilePath(urlOrPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/** Prisma SQLite URLs use forward slashes, including on Windows (`file:C:/path/db`). */
export const buildSqliteControlPlaneUrl = (filePath = defaultSqliteControlPlanePath()): string =>
  `file:${toPosixPath(path.resolve(filePath))}`;

/** Relative path for the install wizard when the file lives inside the project. */
export const toInstallSqliteDatabasePath = (filePath: string): string => {
  const resolved = parseSqliteControlPlaneFilePath(filePath);
  const relative = path.relative(process.cwd(), resolved);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return toPosixPath(relative);
  }
  return toPosixPath(resolved);
};

/** Unlink the SQLite file plus WAL / SHM / journal sidecars (best-effort). */
export const removeSqliteControlPlaneFiles = (urlOrPath: string): void => {
  const resolved = parseSqliteControlPlaneFilePath(urlOrPath);
  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const candidate = `${resolved}${suffix}`;
    if (!fs.existsSync(candidate)) {
      continue;
    }
    try {
      fs.unlinkSync(candidate);
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
      if (code === 'EBUSY' || code === 'EPERM') {
        throw new Error(
          `Could not replace SQLite file (it is still open): ${candidate}`,
        );
      }
      throw error;
    }
  }
};

export const validateControlPlaneDatabaseSettings = (
  settings: ControlPlaneDatabaseSettings,
): void => {
  if (!settings.url.trim()) {
    throw new Error('database.url is required.');
  }
  if (!['postgresql', 'mysql', 'sqlite', 'sqlserver'].includes(settings.provider)) {
    throw new Error(`Unsupported control plane provider: ${settings.provider}`);
  }
  if (!['pg-pool', 'prisma'].includes(settings.engine)) {
    throw new Error(`Unsupported control plane engine: ${settings.engine}`);
  }
  if (settings.engine === 'pg-pool' && settings.provider !== 'postgresql') {
    throw new Error(`pg-pool engine is only valid for PostgreSQL, not ${settings.provider}.`);
  }
};
