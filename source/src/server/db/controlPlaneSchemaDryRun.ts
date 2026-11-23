import fs from 'fs';

import { buildSqlServerHostToken } from '../../shared/lib/sqlServerAddress';
import {
  normalizeControlPlaneProvider,
  readControlPlaneDatabaseSettings,
  type ControlPlaneDatabaseSettings,
  type ControlPlaneDbProvider,
} from './controlPlaneDatabase';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';

export type SchemaDryRunConnection = {
  provider?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
};

const escapeSqlServerValue = (value: string): string => {
  if (/[\\=;{}[\]]/.test(value)) {
    return '{' + value.replaceAll('}', '}}') + '}';
  }
  return value;
};

/**
 * A settings.json has database.url (or data sources). A deploy secrets file has
 * database.host / database.password, or KEY=VALUE lines.
 */
export const classifyControlPlaneInputFile = (text: string): 'settings' | 'secrets' => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return 'secrets';
  try {
    const parsed = JSON.parse(trimmed) as { database?: { url?: unknown; host?: unknown }; dataSources?: unknown };
    const database = parsed.database;
    if (database && typeof database.url === 'string' && database.url.trim()) return 'settings';
    if (Array.isArray(parsed.dataSources) && parsed.dataSources.length > 0 && !database?.host) {
      return 'settings';
    }
  } catch {
    return 'secrets';
  }
  return 'secrets';
};

const buildSqlServerSettings = (input: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}): ControlPlaneDatabaseSettings => {
  const hostToken = buildSqlServerHostToken(input.host, input.port);
  const url = [
    `sqlserver://${hostToken}`,
    `database=${escapeSqlServerValue(input.database)}`,
    `user=${escapeSqlServerValue(input.username)}`,
    `password=${escapeSqlServerValue(input.password)}`,
    `encrypt=${input.encrypt ? 'true' : 'false'}`,
    `trustServerCertificate=${input.trustServerCertificate ? 'true' : 'false'}`,
  ].join(';');
  return { provider: 'sqlserver', url, engine: 'prisma' };
};

const overlaySqlServer = (
  base: ControlPlaneDatabaseSettings | undefined,
  secrets: SchemaDryRunConnection,
): ControlPlaneDatabaseSettings => {
  const parsed = base?.provider === 'sqlserver' && base.url
    ? parseSqlServerConnectionUrl(base.url)
    : undefined;
  const host = secrets.host?.trim() || parsed?.host || 'localhost';
  const port = secrets.port && secrets.port > 0
    ? secrets.port
    : (parsed?.port ?? 0);
  return buildSqlServerSettings({
    host,
    port,
    database: secrets.database?.trim() || parsed?.database || '',
    username: secrets.username?.trim() || parsed?.username || '',
    password: secrets.password ?? parsed?.password ?? '',
    encrypt: secrets.encrypt ?? parsed?.encrypt ?? true,
    trustServerCertificate: secrets.trustServerCertificate ?? parsed?.trustServerCertificate ?? true,
  });
};

const connectionFromSecrets = (
  provider: ControlPlaneDbProvider,
  secrets: SchemaDryRunConnection,
  base: ControlPlaneDatabaseSettings | undefined,
): ControlPlaneDatabaseSettings => {
  if (provider === 'sqlserver') return overlaySqlServer(base, secrets);
  if (provider === 'sqlite') {
    const url = secrets.database?.trim() || base?.url || '';
    if (!url) throw new Error('SQLite dry-run needs a database file path.');
    return { provider, url: url.startsWith('file:') ? url : `file:${url}`, engine: 'prisma' };
  }
  const host = secrets.host?.trim() || 'localhost';
  const port = secrets.port && secrets.port > 0 ? secrets.port : (provider === 'mysql' ? 3306 : 5432);
  const user = encodeURIComponent(secrets.username?.trim() || '');
  const password = encodeURIComponent(secrets.password ?? '');
  const database = encodeURIComponent(secrets.database?.trim() || '');
  const scheme = provider === 'mysql' ? 'mysql' : 'postgresql';
  return {
    provider,
    url: `${scheme}://${user}:${password}@${host}:${port}/${database}`,
    engine: 'prisma',
  };
};

/** Resolve the control-plane URL for a dry-run without applying SQL. */
export const resolveSchemaDryRunDatabase = (input: {
  settingsPath?: string;
  secrets?: SchemaDryRunConnection;
}): ControlPlaneDatabaseSettings => {
  const settingsPath = input.settingsPath?.trim();
  if (settingsPath && !fs.existsSync(settingsPath)) {
    throw new Error(`Settings file not found: ${settingsPath}`);
  }
  const base = settingsPath ? readControlPlaneDatabaseSettings(settingsPath) : undefined;
  const secrets = input.secrets;
  const hasSecretConnection = Boolean(
    secrets
    && (
      secrets.host?.trim()
      || secrets.database?.trim()
      || secrets.username?.trim()
      || secrets.password
      || secrets.provider?.trim()
    ),
  );
  if (!hasSecretConnection) {
    if (!base) throw new Error('Pass --settings or --secrets.');
    if (!base.url.trim()) throw new Error(`No control-plane URL in ${settingsPath}.`);
    return base;
  }
  const provider = normalizeControlPlaneProvider(secrets?.provider) ?? base?.provider ?? 'sqlserver';
  const resolved = connectionFromSecrets(provider, secrets ?? {}, base);
  if (!resolved.url.trim()) throw new Error('Could not build a control-plane URL from the secrets file.');
  return resolved;
};
