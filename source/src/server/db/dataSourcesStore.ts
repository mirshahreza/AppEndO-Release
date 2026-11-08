import fs from 'fs';
import {
  controlPlaneProviderFromDataSourceType,
  controlPlaneProviderToDataSourceType,
  type ControlPlaneProviderId,
} from '../../shared/api/contracts/install/controlPlaneProviders';
import {
  dataSourceHasStoredPassword,
  hydrateDataSourcePassword,
  parseDiskDataSourceSecretInput,
  resolveDataSourcePassword,
  toPersistedDefaultSecretFields,
} from '../config/dataSourceSecrets';
import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import type { CredentialEncryptedBlob } from '../domain/security/credentialVault/credentialCrypto';
import {
  listHydratedEdgeDataSources,
  upsertEdgeDataSource,
  deleteEdgeDataSource,
  type EdgeDataSourceWriteInput,
} from '../domain/data-sources/edgeDataSourceRepository';
import { readControlPlaneDatabaseSettings, type ControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { readInstallSettings } from './installSettingsStore';
import { persistControlPlaneDatabaseSettings } from './controlPlaneInstall';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';

export const SUPPORTED_DATA_SOURCE_TYPES = new Set([
  'PostgreSQL',
  'MySQL',
  'Oracle',
  'SQL Server',
  'OLAP Bridge',
  'MongoDB Analytics',
  'Elasticsearch Analytics',
]);

export type StoredDataSource = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  passwordEnvKey?: string;
  passwordCipher?: CredentialEncryptedBlob;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  pooling?: boolean;
  options?: Record<string, unknown>;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  isDefault: boolean;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
};

const DATA_SOURCES_SETTINGS_KEY = 'dataSources';
export const DEFAULT_DATA_SOURCE_ID = 'ds_default_local';
const PLACEHOLDER_DEFAULT_DATA_SOURCE_ID = DEFAULT_DATA_SOURCE_ID;
export const DEFAULT_INSTALL_DATA_SOURCE_NAME = 'default-db';
export const DEFAULT_DATA_SOURCE_CREATED_BY = 'admin';

const EMPTY_DEFAULT_DATA_SOURCE_UPDATE_AUDIT = {
  updated_at: '',
  updated_by: null,
} as const;

const normalizeStoredActorLabel = (
  actor: unknown,
  legacyUsername: unknown,
  fallback?: string | null,
): string | null => {
  const legacy = legacyUsername != null ? String(legacyUsername).trim() : '';
  if (legacy) {
    return legacy;
  }

  if (actor == null) {
    return fallback ?? null;
  }

  if (typeof actor === 'string') {
    const trimmed = actor.trim();
    if (trimmed) {
      return trimmed;
    }
    return fallback ?? null;
  }

  const numeric = Number(actor);
  if (Number.isFinite(numeric)) {
    return `#${numeric}`;
  }

  const text = String(actor).trim();
  return text || (fallback ?? null);
};

export const applyDefaultDataSourceSetupAudit = (
  source: StoredDataSource,
): StoredDataSource => ({
  ...source,
  isDefault: true,
  created_by: source.created_by?.trim() || DEFAULT_DATA_SOURCE_CREATED_BY,
  ...EMPTY_DEFAULT_DATA_SOURCE_UPDATE_AUDIT,
});

export const preserveDefaultDataSourceUpdateAudit = (
  source: StoredDataSource,
  patch: Partial<StoredDataSource>,
): StoredDataSource => {
  if (!source.isDefault) {
    return { ...source, ...patch };
  }

  const {
    updated_at: _updatedAt,
    updated_by: _updatedBy,
    ...rest
  } = patch;

  return {
    ...source,
    ...rest,
    ...EMPTY_DEFAULT_DATA_SOURCE_UPDATE_AUDIT,
  };
};

type DataSourcesSettingsCache = {
  settingsPath: string;
  mtimeMs: number;
  sources: StoredDataSource[];
};

let dataSourcesSettingsCache: DataSourcesSettingsCache | null = null;
let edgeDataSourcesCatalog: StoredDataSource[] = [];

export const invalidateDataSourcesSettingsCache = (): void => {
  dataSourcesSettingsCache = null;
};

export const resetEdgeDataSourcesCatalogForTests = (): void => {
  edgeDataSourcesCatalog = [];
};

export const seedEdgeDataSourcesCatalogForTests = (sources: StoredDataSource[]): void => {
  edgeDataSourcesCatalog = sources.map((source) => ({ ...source, isDefault: false }));
};

const readSettingsMtimeMs = (settingsPath: string): number => {
  try {
    return fs.statSync(settingsPath).mtimeMs;
  } catch {
    return -1;
  }
};

export type InstallDataSourceConnection = {
  provider: ControlPlaneProviderId;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
};

const parseBooleanLike = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const parseStoredOptions = (value: unknown): Record<string, unknown> | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export const toDataSourceStatus = (value: unknown): StoredDataSource['status'] => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'connected') return 'connected';
  if (normalized === 'error') return 'error';
  if (normalized === 'testing') return 'testing';
  return 'disconnected';
};

const normalizeStoredDataSource = (
  input: unknown,
  fallback: Partial<StoredDataSource> = {},
): StoredDataSource | null => {
  if (!input || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;
  const type = String(item.type ?? fallback.type ?? '').trim();
  if (!SUPPORTED_DATA_SOURCE_TYPES.has(type)) return null;

  const id = String(item.id ?? fallback.id ?? '').trim();
  const name = String(item.name ?? fallback.name ?? '').trim();
  if (!id || !name) return null;

  const host = String(item.host ?? fallback.host ?? 'localhost').trim() || 'localhost';
  const rawPort = Number(item.port ?? fallback.port ?? 0);
  const port = Number.isFinite(rawPort) ? rawPort : 0;
  const nowIso = new Date().toISOString();
  const secret = parseDiskDataSourceSecretInput({
    ...item,
    type,
    password: item.password,
    passwordEnvKey: item.passwordEnvKey !== undefined
      ? item.passwordEnvKey
      : fallback.passwordEnvKey,
    passwordCipher: item.passwordCipher !== undefined
      ? item.passwordCipher
      : fallback.passwordCipher,
  });
  const password = resolveDataSourcePassword(secret);

  return {
    id,
    name,
    type,
    host,
    port,
    database: String(item.database ?? fallback.database ?? ''),
    username: String(item.username ?? fallback.username ?? ''),
    password,
    passwordEnvKey: secret.passwordEnvKey,
    passwordCipher: secret.passwordCipher,
    encrypt: parseBooleanLike(item.encrypt ?? fallback.encrypt, true),
    trustServerCertificate: parseBooleanLike(
      item.trustServerCertificate ?? fallback.trustServerCertificate,
      true,
    ),
    pooling: parseBooleanLike(item.pooling ?? fallback.pooling, true),
    options: parseStoredOptions(item.options ?? fallback.options),
    status: toDataSourceStatus(item.status ?? fallback.status ?? 'disconnected'),
    isDefault: parseBooleanLike(item.isDefault ?? fallback.isDefault, false),
    created_at: String(item.created_at ?? fallback.created_at ?? nowIso),
    created_by: normalizeStoredActorLabel(
      item.created_by,
      item.created_by_username,
      fallback.created_by ?? null,
    ),
    updated_at: String(item.updated_at ?? fallback.updated_at ?? nowIso),
    updated_by: normalizeStoredActorLabel(
      item.updated_by,
      item.updated_by_username,
      fallback.updated_by ?? null,
    ),
  };
};

const buildStoredDataSourceFromInstallConnection = (
  connection: InstallDataSourceConnection,
  existing?: Partial<StoredDataSource>,
): StoredDataSource | null => {
  const type = controlPlaneProviderToDataSourceType(connection.provider);
  if (!type) {
    return null;
  }

  const now = new Date().toISOString();

  return hydrateDataSourcePassword({
    id: existing?.id ?? PLACEHOLDER_DEFAULT_DATA_SOURCE_ID,
    name: existing?.name ?? DEFAULT_INSTALL_DATA_SOURCE_NAME,
    type,
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.username,
    password: connection.password || existing?.password || '',
    passwordEnvKey: existing?.passwordEnvKey,
    passwordCipher: existing?.passwordCipher,
    encrypt: connection.encrypt,
    trustServerCertificate: connection.trustServerCertificate,
    pooling: true,
    status: 'connected',
    isDefault: true,
    created_at: existing?.created_at ?? now,
    created_by: existing?.created_by?.trim() || DEFAULT_DATA_SOURCE_CREATED_BY,
    ...EMPTY_DEFAULT_DATA_SOURCE_UPDATE_AUDIT,
  });
};

const parseControlPlaneConnection = (
  settings: ControlPlaneDatabaseSettings,
): InstallDataSourceConnection | null => {
  try {
    if (settings.provider === 'sqlserver') {
      const parsed = parseSqlServerConnectionUrl(settings.url);
      return {
        provider: 'sqlserver',
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
        encrypt: parsed.encrypt,
        trustServerCertificate: parsed.trustServerCertificate,
      };
    }

    if (settings.provider === 'postgresql' || settings.provider === 'mysql') {
      const parsed = new URL(settings.url);
      return {
        provider: settings.provider,
        host: parsed.hostname || 'localhost',
        port: Number(parsed.port) || (settings.provider === 'mysql' ? 3306 : 5432),
        database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        encrypt: true,
        trustServerCertificate: true,
      };
    }

    return null;
  } catch {
    return null;
  }
};

const shouldRepairDefaultDataSource = (
  items: StoredDataSource[],
  settingsPath: string,
): boolean => {
  if (items.length === 0) {
    return true;
  }

  const install = readInstallSettings(settingsPath);
  if (!install.databaseInitialized && !install.completedAt) {
    return false;
  }

  const db = readControlPlaneDatabaseSettings(settingsPath);
  const expectedType = controlPlaneProviderToDataSourceType(db.provider);
  if (!expectedType) {
    return false;
  }

  const defaultSource = items.find((item) => item.isDefault) ?? items[0];
  if (defaultSource.type === expectedType) {
    return false;
  }

  // Only rewrite the leftover PostgreSQL placeholder after a non-Postgres install.
  // Never force a user-saved SQL Server / MySQL default back to PostgreSQL on restart.
  if (defaultSource.type !== 'PostgreSQL') {
    return false;
  }

  return (
    defaultSource.id === PLACEHOLDER_DEFAULT_DATA_SOURCE_ID
    || items.length === 1
  );
};

const repairDefaultDataSourceIfNeeded = (
  items: StoredDataSource[],
  settingsPath: string,
): StoredDataSource[] => {
  if (!shouldRepairDefaultDataSource(items, settingsPath)) {
    return items;
  }

  const connection = parseControlPlaneConnection(readControlPlaneDatabaseSettings(settingsPath));
  if (!connection) {
    return items;
  }

  const defaultIndex = items.findIndex((item) => item.isDefault);
  const existing = defaultIndex >= 0 ? items[defaultIndex] : undefined;
  const existingForMerge = existing?.id === PLACEHOLDER_DEFAULT_DATA_SOURCE_ID
    ? {
      id: existing.id,
      password: existing.password,
      passwordEnvKey: existing.passwordEnvKey,
      passwordCipher: existing.passwordCipher,
      created_at: existing.created_at,
      created_by: existing.created_by,
    }
    : existing;
  const next = buildStoredDataSourceFromInstallConnection(connection, existingForMerge);
  if (!next) {
    return items;
  }

  if (defaultIndex >= 0) {
    return [next];
  }

  return [next];
};

const resolveInitialDataSources = (
  items: StoredDataSource[],
  settingsPath: string,
): StoredDataSource[] => {
  const repaired = repairDefaultDataSourceIfNeeded(items, settingsPath);
  if (repaired.length > 0) {
    return repaired.map((item) => ({ ...item, isDefault: true }));
  }

  const connection = parseControlPlaneConnection(readControlPlaneDatabaseSettings(settingsPath));
  if (connection) {
    const built = buildStoredDataSourceFromInstallConnection(connection);
    if (built) {
      return [built];
    }
  }

  return items;
};

const readDefaultRawFromSettings = (settingsPath: string): unknown => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[DATA_SOURCES_SETTINGS_KEY];
  const array = Array.isArray(raw) ? raw : [];
  return array.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean((item as Record<string, unknown>).isDefault);
  }) ?? array[0];
};

const getDefaultDataSourcesFromSettings = (settingsPath: string): StoredDataSource[] => {
  const mtimeMs = readSettingsMtimeMs(settingsPath);
  if (
    dataSourcesSettingsCache
    && dataSourcesSettingsCache.settingsPath === settingsPath
    && dataSourcesSettingsCache.mtimeMs === mtimeMs
  ) {
    return dataSourcesSettingsCache.sources;
  }

  const normalized = [normalizeStoredDataSource(readDefaultRawFromSettings(settingsPath))]
    .filter((item): item is StoredDataSource => Boolean(item))
    .map((item) => hydrateDataSourcePassword(item));

  const sources = resolveInitialDataSources(normalized, settingsPath)
    .map((item) => applyDefaultDataSourceSetupAudit(item));
  dataSourcesSettingsCache = { settingsPath, mtimeMs, sources };
  return sources;
};

export const getDataSourcesFromSettings = (settingsPath: string): StoredDataSource[] => {
  const defaults = getDefaultDataSourcesFromSettings(settingsPath);
  const defaultIds = new Set(defaults.map((item) => item.id));
  return [
    ...defaults,
    ...edgeDataSourcesCatalog.filter((item) => !defaultIds.has(item.id)),
  ];
};

const toPersistedDefaultDataSource = (
  source: StoredDataSource,
  options?: { passwordUpdate?: string },
): Record<string, unknown> => {
  const secretFields = toPersistedDefaultSecretFields(source, options);
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    host: source.host,
    port: source.port,
    database: source.database || '',
    username: source.username || '',
    encrypt: parseBooleanLike(source.encrypt, true),
    trustServerCertificate: parseBooleanLike(source.trustServerCertificate, true),
    pooling: parseBooleanLike(source.pooling, true),
    status: source.status,
    isDefault: true,
    created_at: source.created_at,
    created_by: source.created_by ?? null,
    updated_at: source.updated_at,
    updated_by: source.updated_by ?? null,
    ...secretFields,
  };
};

export const saveDefaultDataSourceToSettings = (
  settingsPath: string,
  source: StoredDataSource,
  options?: { passwordUpdate?: string },
): void => {
  const settings = readSettingsObject(settingsPath);
  settings[DATA_SOURCES_SETTINGS_KEY] = [
    toPersistedDefaultDataSource(applyDefaultDataSourceSetupAudit(source), options),
  ];
  writeSettingsObject(settingsPath, settings);
  invalidateDataSourcesSettingsCache();
};

export const saveDataSourcesToSettings = (settingsPath: string, items: StoredDataSource[]) => {
  const defaultSource = items.find((item) => item.isDefault) ?? items[0];
  if (!defaultSource) {
    return;
  }
  saveDefaultDataSourceToSettings(settingsPath, { ...defaultSource, isDefault: true });
};

export const upsertDefaultDataSourceFromInstall = (
  settingsPath: string,
  connection: InstallDataSourceConnection,
): StoredDataSource | null => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[DATA_SOURCES_SETTINGS_KEY];
  const array = Array.isArray(raw) ? raw : [];
  const defaultRaw = array.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean((item as Record<string, unknown>).isDefault);
  }) ?? array[0];
  const existing = defaultRaw ? normalizeStoredDataSource(defaultRaw) : null;
  const existingForMerge = existing?.id === PLACEHOLDER_DEFAULT_DATA_SOURCE_ID
    ? {
      id: existing.id,
      password: existing.password,
      passwordEnvKey: existing.passwordEnvKey,
      passwordCipher: existing.passwordCipher,
      created_at: existing.created_at,
      created_by: existing.created_by,
    }
    : existing ?? undefined;
  const resolved = buildStoredDataSourceFromInstallConnection(connection, existingForMerge ?? undefined);
  if (!resolved) {
    return null;
  }

  saveDefaultDataSourceToSettings(settingsPath, resolved, {
    passwordUpdate: connection.password,
  });
  return resolved;
};

export const persistControlPlaneFromDefaultDataSource = (
  settingsPath: string,
  source: StoredDataSource,
): void => {
  if (!source.isDefault) {
    return;
  }

  const provider = controlPlaneProviderFromDataSourceType(source.type);
  if (!provider || provider === 'sqlite') {
    return;
  }

  persistControlPlaneDatabaseSettings(settingsPath, {
    provider,
    host: source.host,
    port: source.port,
    database: source.database?.trim() || 'AppEnd',
    username: source.username ?? '',
    password: source.password ?? '',
    encrypt: source.encrypt !== false,
    trustServerCertificate: source.trustServerCertificate !== false,
    overrideExistingObjects: false,
    seedSampleData: false,
  });
};

export const ensureDataSourcesSettings = (settingsPath: string) => {
  const defaults = getDefaultDataSourcesFromSettings(settingsPath);
  const defaultSource = defaults[0];
  if (!defaultSource) {
    return;
  }
  saveDefaultDataSourceToSettings(settingsPath, defaultSource);
};

const toEdgeWriteInput = (source: StoredDataSource): EdgeDataSourceWriteInput => ({
  id: source.id,
  name: source.name,
  type: source.type,
  host: source.host,
  port: source.port,
  database: source.database,
  username: source.username,
  encrypt: source.encrypt,
  trustServerCertificate: source.trustServerCertificate,
  pooling: source.pooling,
  options: source.options,
  status: source.status,
  created_at: source.created_at,
  created_by: source.created_by ?? null,
  updated_at: source.updated_at,
  updated_by: source.updated_by ?? null,
});

const toStoredEdgeDataSource = (
  row: Awaited<ReturnType<typeof listHydratedEdgeDataSources>>[number],
): StoredDataSource => ({
  id: row.id,
  name: row.name,
  type: row.type,
  host: row.host,
  port: row.port,
  database: row.database ?? '',
  username: row.username ?? '',
  password: row.password,
  encrypt: row.encrypt,
  trustServerCertificate: row.trustServerCertificate,
  pooling: row.pooling,
  options: parseStoredOptions(row.optionsJson),
  status: toDataSourceStatus(row.status),
  isDefault: false,
  created_at: row.created_at,
  created_by: row.created_by,
  updated_at: row.updated_at,
  updated_by: row.updated_by,
});

export const refreshEdgeDataSourcesCatalog = async (): Promise<void> => {
  try {
    const rows = await listHydratedEdgeDataSources();
    edgeDataSourcesCatalog = rows.map(toStoredEdgeDataSource);
  } catch {
    edgeDataSourcesCatalog = [];
  }
};

export const persistStoredDataSource = async (
  settingsPath: string,
  source: StoredDataSource,
  options?: { passwordUpdate?: string },
): Promise<void> => {
  if (source.isDefault) {
    saveDefaultDataSourceToSettings(settingsPath, source, options);
    persistControlPlaneFromDefaultDataSource(settingsPath, source);
    return;
  }

  await upsertEdgeDataSource(toEdgeWriteInput(source), options?.passwordUpdate);
  await refreshEdgeDataSourcesCatalog();
};

export const removeStoredEdgeDataSource = async (id: string): Promise<void> => {
  await deleteEdgeDataSource(id);
  await refreshEdgeDataSourcesCatalog();
};

export const toApiDataSource = (source: StoredDataSource) => ({
  id: source.id,
  name: source.name,
  type: source.type,
  host: source.host,
  port: source.port,
  database: source.database || '',
  username: source.username || '',
  hasPassword: dataSourceHasStoredPassword(source),
  encrypt: parseBooleanLike(source.encrypt, true),
  trustServerCertificate: parseBooleanLike(source.trustServerCertificate, true),
  pooling: parseBooleanLike(source.pooling, false),
  options: source.options,
  status: source.status,
  is_default: source.isDefault ? 1 : 0,
  isDefault: source.isDefault,
  created_at: source.created_at,
  created_by: source.created_by ?? null,
  updated_at: source.updated_at,
  updated_by: source.updated_by ?? null,
});
