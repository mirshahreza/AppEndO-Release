import path from 'path';
import type { InstallDatabasePayload } from '../../shared/api/contracts/install/types';
import {
  controlPlaneProviderLabel,
  defaultControlPlaneInstallFields,
  isControlPlaneProviderId,
  runtimeDatabaseProviderValue,
  type ControlPlaneProviderId,
} from '../../shared/api/contracts/install/controlPlaneProviders';
import {
  buildSqlServerHostToken,
} from '../../shared/lib/sqlServerAddress';
import { readSettingsObject, readRuntimeSettings, writeSettingsObject } from '../config/settingsFile';
import {
  dataSourceHasStoredPassword,
  readDefaultDataSourceSecretInputFromSettings,
} from '../config/dataSourceSecrets';
import {
  buildSqliteControlPlaneUrl,
  ensureSqliteControlPlaneDirectory,
  removeSqliteControlPlaneFiles,
  toInstallSqliteDatabasePath,
  type ControlPlaneDatabaseSettings,
} from './controlPlaneDatabase';
import { stripControlPlaneUrlPassword } from './controlPlaneUrlPassword';
import {
  forceResetControlPlaneSchemaWithPrisma,
  INSTALL_WIZARD_SCHEMA_RESET_CONSENT,
  pushControlPlaneSchema,
} from './controlPlaneSchemaPush';
import {
  closePrismaControlPlane,
  getPrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from './prismaControlPlane';
import { invalidateControlPlaneProviderCache } from '../domain/users/prismaHelpers';

export type ParsedInstallDatabasePayload = {
  provider: ControlPlaneProviderId;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  overrideExistingObjects: boolean;
  seedSampleData: boolean;
};

const escapeSqlServerValue = (value: string): string => {
  if (/[\\=;[\]{}]/.test(value)) {
    return `{${value.replace(/}/g, '}}')}`;
  }
  return value;
};

export { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';

const encodeCredential = (value: string): string => encodeURIComponent(value);

export const buildControlPlaneUrlFromInstallPayload = (
  payload: Pick<
    ParsedInstallDatabasePayload,
    'provider' | 'host' | 'port' | 'database' | 'username' | 'password' | 'encrypt' | 'trustServerCertificate'
  >,
): string => {
  switch (payload.provider) {
    case 'postgresql': {
      const user = encodeCredential(payload.username);
      const password = encodeCredential(payload.password);
      const database = encodeCredential(payload.database);
      return `postgresql://${user}:${password}@${payload.host}:${payload.port}/${database}`;
    }
    case 'mysql': {
      const user = encodeCredential(payload.username);
      const password = encodeCredential(payload.password);
      const database = encodeCredential(payload.database);
      return `mysql://${user}:${password}@${payload.host}:${payload.port}/${database}`;
    }
    case 'sqlite': {
      const filePath = path.isAbsolute(payload.database)
        ? payload.database
        : path.join(process.cwd(), payload.database);
      return buildSqliteControlPlaneUrl(filePath);
    }
    case 'sqlserver': {
      const hostToken = buildSqlServerHostToken(payload.host, payload.port);
      const database = escapeSqlServerValue(payload.database);
      const user = escapeSqlServerValue(payload.username);
      const password = escapeSqlServerValue(payload.password);
      const encrypt = payload.encrypt ? 'true' : 'false';
      const trust = payload.trustServerCertificate ? 'true' : 'false';
      return `sqlserver://${hostToken};database=${database};user=${user};password=${password};encrypt=${encrypt};trustServerCertificate=${trust}`;
    }
    default: {
      const exhaustive: never = payload.provider;
      throw new Error(`Unsupported control plane provider: ${exhaustive}`);
    }
  }
};

export const buildControlPlaneDatabaseSettingsFromInstallPayload = (
  payload: ParsedInstallDatabasePayload,
): ControlPlaneDatabaseSettings => ({
  provider: payload.provider,
  url: buildControlPlaneUrlFromInstallPayload(payload),
  engine: 'prisma',
});

export const persistControlPlaneDatabaseSettings = (
  settingsPath: string,
  payload: ParsedInstallDatabasePayload,
): ControlPlaneDatabaseSettings => {
  const database = buildControlPlaneDatabaseSettingsFromInstallPayload(payload);
  const settings = readSettingsObject(settingsPath);
  const runtime = readRuntimeSettings(settingsPath);

  settings.database = {
    provider: database.provider,
    url: stripControlPlaneUrlPassword(database.provider, database.url),
    engine: 'prisma',
  };
  settings.runtime = {
    ...runtime,
    databaseProvider: runtimeDatabaseProviderValue(database.provider),
  };
  writeSettingsObject(settingsPath, settings);
  invalidateControlPlaneProviderCache();
  return database;
};

export const readInstallDatabaseDraftFromSettings = (
  settingsPath: string,
): {
  provider: ControlPlaneProviderId;
  host: string;
  port: number;
  database: string;
  username: string;
  hasPassword: boolean;
  encrypt: boolean;
  trustServerCertificate: boolean;
} | undefined => {
  const settings = readSettingsObject(settingsPath);
  const block = settings.database;
  if (!block || typeof block !== 'object') {
    return undefined;
  }

  const providerRaw = (block as Record<string, unknown>).provider;
  if (!isControlPlaneProviderId(String(providerRaw ?? '').trim().toLowerCase())) {
    return undefined;
  }
  const provider = String(providerRaw).trim().toLowerCase() as ControlPlaneProviderId;
  const url = String((block as Record<string, unknown>).url ?? '').trim();
  if (!url) {
    return undefined;
  }

  if (provider === 'sqlite') {
    return {
      provider,
      host: 'localhost',
      port: 0,
      database: toInstallSqliteDatabasePath(url),
      username: '',
      hasPassword: false,
      encrypt: true,
      trustServerCertificate: true,
    };
  }

  try {
    if (provider === 'sqlserver') {
      const parsed = parseSqlServerConnectionUrl(url);
      return {
        provider,
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        hasPassword: dataSourceHasStoredPassword(readDefaultDataSourceSecretInputFromSettings(settingsPath)),
        encrypt: parsed.encrypt,
        trustServerCertificate: parsed.trustServerCertificate,
      };
    }

    const parsed = new URL(url);
    return {
      provider,
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number(parsed.port) : (provider === 'mysql' ? 3306 : 5432),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      username: decodeURIComponent(parsed.username),
      hasPassword: dataSourceHasStoredPassword(readDefaultDataSourceSecretInputFromSettings(settingsPath)),
      encrypt: true,
      trustServerCertificate: true,
    };
  } catch {
    return undefined;
  }
};

export const defaultInstallDatabasePayload = (): InstallDatabasePayload => ({
  ...defaultControlPlaneInstallFields(),
  overrideExistingObjects: false,
  seedSampleData: false,
});

export const prepareControlPlaneDatabase = async (
  settings: ControlPlaneDatabaseSettings,
): Promise<void> => {
  if (settings.provider === 'sqlite') {
    ensureSqliteControlPlaneDirectory(settings.url);
    return;
  }

  if (settings.provider === 'postgresql') {
    const { ensureDatabaseExistsForConfig, readPgPoolConfigFromPayload } = await import('../setup/installDatabase');
    const parsed = new URL(settings.url);
    await ensureDatabaseExistsForConfig(readPgPoolConfigFromPayload({
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    }));
  }
};

export const controlPlaneHasSchema = async (
  settings: ControlPlaneDatabaseSettings,
): Promise<boolean> => {
  let opened = false;
  try {
    if (!settings.url) return false;
    await initPrismaControlPlaneFromSettings(settings);
    opened = true;
    await getPrismaControlPlane().baseUser.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  } finally {
    if (opened) {
      await closePrismaControlPlane();
    }
  }
};

export const resetControlPlaneSchema = async (
  settings: ControlPlaneDatabaseSettings,
): Promise<void> => {
  if (settings.provider === 'sqlite') {
    removeSqliteControlPlaneFiles(settings.url);
    ensureSqliteControlPlaneDirectory(settings.url);
    return;
  }

  if (settings.provider === 'postgresql') {
    const parsed = new URL(settings.url);
    const { resetAppDatabaseSchema, readPgPoolConfigFromPayload } = await import('../setup/installDatabase');
    await resetAppDatabaseSchema(readPgPoolConfigFromPayload({
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    }));
    const restore = pushControlPlaneSchema(settings);
    restore();
    return;
  }

  forceResetControlPlaneSchemaWithPrisma(settings, {
    dangerousActionConsent: INSTALL_WIZARD_SCHEMA_RESET_CONSENT,
  });
};

export const connectedMessageForProvider = (provider: ControlPlaneProviderId): string =>
  `Connected to ${controlPlaneProviderLabel(provider)}.`;
