import fs from 'fs';
import path from 'path';

import { atomicWriteText } from '../../core/runtime/RuntimeFileStore';
import {
  DEFAULT_CONTROL_PLANE_PROVIDER,
  controlPlaneProviderFromDataSourceType,
  runtimeDatabaseProviderValue,
} from '../../shared/api/contracts/install/controlPlaneProviders';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import { normalizeNodeCapabilities } from '../../shared/nodeCapabilities';

export const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');

const SETTINGS_OBJECT_CACHE_TTL_MS = 30_000;

let cachedSettingsObject: {
  settingsPath: string;
  mtimeMs: number;
  value: Record<string, unknown>;
  expiresAt: number;
} | null = null;

export const invalidateSettingsObjectCache = (): void => {
  cachedSettingsObject = null;
};

const readSettingsFileMtimeMs = (settingsPath: string): number => {
  try {
    return fs.statSync(settingsPath).mtimeMs;
  } catch {
    return 0;
  }
};

export type RuntimeSettings = {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  appUrl: string | undefined;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  databaseProvider: string;
  disableHmr: boolean;
  hmrPort: number;
  aiChatRateLimitPerMinute: number;
  packageBuilderEnabled: boolean | undefined;
  logLevel: string;
  packageScriptPolicyTimeoutMs: number;
  packageScriptAllowedPathPrefixes: string;
  packageEventRetentionMonths: number;
  packageEventRetentionMaxTotalBytes: number;
  capabilities: NodeCapability[];
  nodeName: string;
};

const DEV_ACCESS_TOKEN_SECRET = 'dev_access_token_secret_change_me';
const DEV_REFRESH_TOKEN_SECRET = 'dev_refresh_token_secret_change_me';

const parsePort = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
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

const normalizeNodeEnv = (value: unknown): RuntimeSettings['nodeEnv'] => {
  const normalized = String(value ?? 'development').trim().toLowerCase();
  if (normalized === 'production' || normalized === 'test') return normalized;
  return 'development';
};

export const buildDefaultRuntimeSettings = (): RuntimeSettings => ({
  nodeEnv: 'development',
  port: 3000,
  appUrl: 'http://localhost:3000',
  accessTokenSecret: DEV_ACCESS_TOKEN_SECRET,
  refreshTokenSecret: DEV_REFRESH_TOKEN_SECRET,
  databaseProvider: runtimeDatabaseProviderValue(DEFAULT_CONTROL_PLANE_PROVIDER),
  disableHmr: false,
  hmrPort: 0,
  aiChatRateLimitPerMinute: 20,
  packageBuilderEnabled: undefined,
  logLevel: 'debug',
  packageScriptPolicyTimeoutMs: 3000,
  packageScriptAllowedPathPrefixes: 'db/install/,db/uninstall/,db/seed/,sql/',
  packageEventRetentionMonths: 6,
  packageEventRetentionMaxTotalBytes: 100 * 1024 * 1024,
  capabilities: ['service', 'platform', 'worker'],
  nodeName: 'node-1',
});

const normalizeRuntimeSettings = (raw: unknown): RuntimeSettings => {
  const defaults = buildDefaultRuntimeSettings();
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};

  return {
    nodeEnv: normalizeNodeEnv(input.nodeEnv ?? defaults.nodeEnv),
    port: parsePort(input.port, defaults.port),
    appUrl: String(input.appUrl ?? defaults.appUrl ?? '').trim() || undefined,
    accessTokenSecret: String(input.accessTokenSecret ?? defaults.accessTokenSecret).trim()
      || defaults.accessTokenSecret,
    refreshTokenSecret: String(input.refreshTokenSecret ?? defaults.refreshTokenSecret).trim()
      || defaults.refreshTokenSecret,
    databaseProvider: String(input.databaseProvider ?? defaults.databaseProvider).trim().toLowerCase()
      || defaults.databaseProvider,
    disableHmr: parseBooleanLike(input.disableHmr, defaults.disableHmr),
    hmrPort: parsePort(input.hmrPort, defaults.hmrPort),
    aiChatRateLimitPerMinute: parsePositiveInt(
      input.aiChatRateLimitPerMinute,
      defaults.aiChatRateLimitPerMinute,
    ),
    packageBuilderEnabled: input.packageBuilderEnabled === undefined
      ? undefined
      : parseBooleanLike(input.packageBuilderEnabled, false),
    logLevel: String(input.logLevel ?? defaults.logLevel).trim() || defaults.logLevel,
    packageScriptPolicyTimeoutMs: parsePositiveInt(
      input.packageScriptPolicyTimeoutMs,
      defaults.packageScriptPolicyTimeoutMs,
    ),
    packageScriptAllowedPathPrefixes: String(
      input.packageScriptAllowedPathPrefixes ?? defaults.packageScriptAllowedPathPrefixes,
    ).trim() || defaults.packageScriptAllowedPathPrefixes,
    packageEventRetentionMonths: parsePositiveInt(
      input.packageEventRetentionMonths,
      defaults.packageEventRetentionMonths,
    ),
    packageEventRetentionMaxTotalBytes: parsePositiveInt(
      input.packageEventRetentionMaxTotalBytes,
      defaults.packageEventRetentionMaxTotalBytes,
    ),
    capabilities: normalizeNodeCapabilities({
      capabilities: input.capabilities,
      nodeRole: input.nodeRole,
    }),
    nodeName: String(input.nodeName ?? defaults.nodeName).trim() || defaults.nodeName,
  };
};

const RUNTIME_PROVIDER_ALIASES: Record<string, string> = {
  postgres: 'postgresql',
  postgresql: 'postgresql',
  pg: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  sqlserver: 'sqlserver',
  mssql: 'sqlserver',
};

const canonicalRuntimeDatabaseProvider = (value: string): string | undefined => {
  const normalized = value.trim().toLowerCase();
  const canonical = RUNTIME_PROVIDER_ALIASES[normalized];
  if (!canonical) return undefined;
  return runtimeDatabaseProviderValue(canonical as 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver');
};

const inferRuntimeDatabaseProvider = (settings: Record<string, unknown>): string => {
  const database = settings.database;
  if (database && typeof database === 'object' && !Array.isArray(database)) {
    const fromBlock = canonicalRuntimeDatabaseProvider(String((database as Record<string, unknown>).provider ?? ''));
    if (fromBlock) return fromBlock;
  }

  const raw = settings.dataSources;
  const sources = Array.isArray(raw) ? raw : [];
  const defaultSource = sources.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean((item as Record<string, unknown>).isDefault);
  }) ?? sources[0];
  if (defaultSource && typeof defaultSource === 'object') {
    const fromType = controlPlaneProviderFromDataSourceType(
      String((defaultSource as Record<string, unknown>).type ?? ''),
    );
    if (fromType) return runtimeDatabaseProviderValue(fromType);
  }

  const runtime = settings.runtime;
  if (runtime && typeof runtime === 'object' && !Array.isArray(runtime)) {
    const fromRuntime = canonicalRuntimeDatabaseProvider(String((runtime as Record<string, unknown>).databaseProvider ?? ''));
    if (fromRuntime) return fromRuntime;
  }

  return runtimeDatabaseProviderValue(DEFAULT_CONTROL_PLANE_PROVIDER);
};

export const readSettingsObject = (settingsPath: string = SETTINGS_PATH): Record<string, unknown> => {
  if (!fs.existsSync(settingsPath)) return {};

  const mtimeMs = readSettingsFileMtimeMs(settingsPath);
  if (
    cachedSettingsObject
    && cachedSettingsObject.settingsPath === settingsPath
    && cachedSettingsObject.mtimeMs === mtimeMs
    && Date.now() < cachedSettingsObject.expiresAt
  ) {
    return cachedSettingsObject.value;
  }

  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('settings.json root must be a JSON object.');
    }
    const value = parsed as Record<string, unknown>;
    cachedSettingsObject = {
      settingsPath,
      mtimeMs,
      value,
      expiresAt: Date.now() + SETTINGS_OBJECT_CACHE_TTL_MS,
    };
    return value;
  } catch (error) {
    if (cachedSettingsObject && cachedSettingsObject.settingsPath === settingsPath) {
      return cachedSettingsObject.value;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${settingsPath}: ${message}`);
  }
};

export const writeSettingsObject = (
  settingsPath: string,
  value: Record<string, unknown>,
) => {
  const tmpDir = path.dirname(path.resolve(settingsPath));
  atomicWriteText(settingsPath, JSON.stringify(value, null, 2), tmpDir);
  invalidateSettingsObjectCache();
  if (settingsPath === SETTINGS_PATH) {
    void import('../domain/users/prismaHelpers').then(({ invalidateControlPlaneProviderCache }) => {
      invalidateControlPlaneProviderCache();
    });
  }
};

export const readRuntimeSettings = (settingsPath: string = SETTINGS_PATH): RuntimeSettings => {
  const settings = readSettingsObject(settingsPath);
  const runtimeRaw = settings.runtime && typeof settings.runtime === 'object' && !Array.isArray(settings.runtime)
    ? { ...(settings.runtime as Record<string, unknown>) }
    : {};
  runtimeRaw.databaseProvider = inferRuntimeDatabaseProvider(settings);
  return normalizeRuntimeSettings(runtimeRaw);
};

/**
 * Listen port for this process. `PORT` / `ELECTRON_PORT` override settings.json
 * without writing back, so `npm start` is unchanged when those env vars are unset.
 */
export const resolveListenPort = (runtime: Pick<RuntimeSettings, 'port'>): number => (
  parsePort(process.env.PORT ?? process.env.ELECTRON_PORT, runtime.port)
);

export const ensureRuntimeSettings = (settingsPath: string = SETTINGS_PATH): RuntimeSettings => {
  const settings = readSettingsObject(settingsPath);
  const runtime = readRuntimeSettings(settingsPath);
  settings.runtime = runtime;
  writeSettingsObject(settingsPath, settings);
  return runtime;
};

const failSettings = (message: string): never => {
  console.error(`[settings] ${message}`);
  process.exit(1);
};

export const validateRuntimeSettings = (runtime: RuntimeSettings): void => {
  if (!runtime.accessTokenSecret || !runtime.refreshTokenSecret) {
    failSettings('runtime.accessTokenSecret and runtime.refreshTokenSecret are required.');
  }

  if (runtime.nodeEnv === 'production') {
    const localProdPublish = process.env.APPENDO_LOCAL_PROD_PUBLISH === '1';
    if (
      !localProdPublish
      && (
        runtime.accessTokenSecret === DEV_ACCESS_TOKEN_SECRET
        || runtime.refreshTokenSecret === DEV_REFRESH_TOKEN_SECRET
      )
    ) {
      failSettings('JWT secrets must not use development defaults when runtime.nodeEnv=production.');
    }
  }
};

export const readViteDevSettings = () => {
  const runtime = readRuntimeSettings();
  return {
    enableHmr: !runtime.disableHmr,
    serverPort: runtime.port,
    hmrPort: runtime.hmrPort,
  };
};
