import { ensureDataSourcesSettings } from '../db/dataSourcesStore';
import { isInstallComplete } from '../db/installSettingsStore';
import {
  readDefaultDataSourceSecretInputFromSettings,
  resolveDataSourcePassword,
} from './dataSourceSecrets';
import {
  ensureRuntimeSettings,
  readSettingsObject,
  resolveListenPort,
  SETTINGS_PATH,
  validateRuntimeSettings,
  type RuntimeSettings,
} from './settingsFile';
import {
  resolveActiveNodeCapabilities,
  resolveActiveNodeName,
  type NodeCapability,
} from '../../shared/nodeCapabilities';

type AppEnv = {
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  port: number;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  pg: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  databaseProvider: string;
  appUrl: string | undefined;
  disableHmr: boolean;
  hmrPort: number;
  packageBuilderEnabledRaw: boolean | undefined;
  aiChatRateLimitPerMinute: number;
  logLevel: string;
  packageScriptPolicyTimeoutMs: number;
  packageScriptAllowedPathPrefixes: string;
  packageEventRetentionMonths: number;
  packageEventRetentionMaxTotalBytes: number;
  capabilities: NodeCapability[];
  nodeName: string;
};

const DEFAULT_PG = {
  host: 'localhost',
  port: 5432,
  database: 'AppEnd',
  user: 'postgres',
  password: '1',
};

const resolveDefaultPgFromSettings = () => {
  const settings = readSettingsObject(SETTINGS_PATH);
  const raw = settings.dataSources;
  const sources = Array.isArray(raw) ? raw : [];
  const defaultSource = sources.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean((item as Record<string, unknown>).isDefault);
  }) ?? sources[0];

  if (!defaultSource || typeof defaultSource !== 'object') {
    return { ...DEFAULT_PG };
  }

  const item = defaultSource as Record<string, unknown>;
  const password = resolveDataSourcePassword(readDefaultDataSourceSecretInputFromSettings(SETTINGS_PATH));

  return {
    host: String(item.host ?? DEFAULT_PG.host).trim() || DEFAULT_PG.host,
    port: Number(item.port ?? DEFAULT_PG.port) || DEFAULT_PG.port,
    database: String(item.database ?? DEFAULT_PG.database).trim() || DEFAULT_PG.database,
    user: String(item.username ?? DEFAULT_PG.user).trim() || DEFAULT_PG.user,
    password: password || DEFAULT_PG.password,
  };
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const buildAppEnv = (runtime: RuntimeSettings): AppEnv => ({
  nodeEnv: runtime.nodeEnv,
  isProduction: runtime.nodeEnv === 'production',
  port: resolveListenPort(runtime),
  accessTokenSecret: runtime.accessTokenSecret,
  refreshTokenSecret: runtime.refreshTokenSecret,
  pg: resolveDefaultPgFromSettings(),
  databaseProvider: runtime.databaseProvider,
  appUrl: runtime.appUrl,
  disableHmr: runtime.disableHmr,
  hmrPort: runtime.hmrPort,
  packageBuilderEnabledRaw: runtime.packageBuilderEnabled,
  aiChatRateLimitPerMinute: runtime.aiChatRateLimitPerMinute,
  logLevel: runtime.logLevel,
  packageScriptPolicyTimeoutMs: runtime.packageScriptPolicyTimeoutMs,
  packageScriptAllowedPathPrefixes: runtime.packageScriptAllowedPathPrefixes,
  packageEventRetentionMonths: runtime.packageEventRetentionMonths,
  packageEventRetentionMaxTotalBytes: runtime.packageEventRetentionMaxTotalBytes,
  capabilities: resolveActiveNodeCapabilities({ capabilities: runtime.capabilities }),
  nodeName: resolveActiveNodeName(runtime.nodeName),
});

if (isInstallComplete(SETTINGS_PATH)) {
  ensureDataSourcesSettings(SETTINGS_PATH);
}
const runtime = ensureRuntimeSettings(SETTINGS_PATH);
validateRuntimeSettings(runtime);

export const env: AppEnv = buildAppEnv(runtime);

/** PostgreSQL `pg` Pool connection fields (user, not username). */
export const toPgPoolConfig = () => ({
  host: env.pg.host,
  port: env.pg.port,
  database: env.pg.database,
  user: env.pg.user,
  password: env.pg.password,
});
