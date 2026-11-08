/**
 * One-shot credential-vault migration for Data Sources.
 *
 * Run before starting a build that no longer reads plaintext data-source
 * passwords from settings.json:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-data-sources.ts
 *
 * Not wired to setup, boot, or cron.
 */
import { SETTINGS_PATH, readSettingsObject, writeSettingsObject } from '../../../src/server/config/settingsFile';
import {
  isRealDataSourcePassword,
  parseDiskDataSourceSecretInput,
  resolveDataSourcePassword,
  toPersistedDefaultSecretFields,
} from '../../../src/server/config/dataSourceSecrets';
import { stripControlPlaneUrlPassword } from '../../../src/server/db/controlPlaneUrlPassword';
import { parseSqlServerConnectionUrl } from '../../../src/server/db/sqlServerControlPlaneUrl';
import { normalizeControlPlaneProvider } from '../../../src/server/db/controlPlaneDatabase';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { ensureEdgeDataSourcesTable } from '../../../src/server/domain/data-sources/edgeDataSourceSequelizeModel';
import { upsertEdgeDataSource } from '../../../src/server/domain/data-sources/edgeDataSourceRepository';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';

const DATA_SOURCES_KEY = 'dataSources';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const readUrlPassword = (provider: string, url: string): string => {
  if (!url.trim() || provider === 'sqlite') {
    return '';
  }
  try {
    if (provider === 'sqlserver') {
      return parseSqlServerConnectionUrl(url).password;
    }
    return decodeURIComponent(new URL(url).password || '');
  } catch {
    return '';
  }
};

const persistDefaultOnly = (
  settingsPath: string,
  defaultItem: Record<string, unknown>,
  extras: unknown[],
): void => {
  const settings = readSettingsObject(settingsPath);
  settings[DATA_SOURCES_KEY] = extras.length > 0 ? [defaultItem, ...extras] : [defaultItem];
  const database = asRecord(settings.database);
  const provider = normalizeControlPlaneProvider(database?.provider) ?? 'postgresql';
  if (database) {
    settings.database = {
      ...database,
      url: stripControlPlaneUrlPassword(provider, String(database.url ?? '')),
    };
  }
  writeSettingsObject(settingsPath, settings);
};

const buildPersistedDefault = (item: Record<string, unknown>, urlPassword: string): Record<string, unknown> => {
  const secret = parseDiskDataSourceSecretInput(item, { allowPlaintext: true });
  const resolved = resolveDataSourcePassword({
    ...secret,
    password: isRealDataSourcePassword(item.password) ? String(item.password) : secret.password,
  });
  const passwordUpdate = resolved || urlPassword;
  const secretFields = toPersistedDefaultSecretFields(
    {
      passwordEnvKey: secret.passwordEnvKey,
      passwordCipher: secret.passwordCipher,
    },
    passwordUpdate ? { passwordUpdate } : undefined,
  );

  const {
    password: _password,
    passwordCipher: _cipher,
    passwordEnvKey: _envKey,
    ...rest
  } = item;

  return {
    ...rest,
    isDefault: true,
    ...secretFields,
  };
};

const migrateEdgeSources = async (extras: Record<string, unknown>[]): Promise<void> => {
  await ensureCredentialVaultTable();
  await ensureEdgeDataSourcesTable();

  for (const item of extras) {
    const id = String(item.id ?? '').trim();
    const name = String(item.name ?? '').trim();
    const type = String(item.type ?? '').trim();
    if (!id || !name || !type) {
      console.warn(`[credential-vault] Skipping edge data source with missing id/name/type.`);
      continue;
    }

    const createdAt = String(item.created_at ?? new Date().toISOString());
    const updatedAt = String(item.updated_at ?? '');
    await upsertEdgeDataSource({
      id,
      name,
      type,
      host: String(item.host ?? 'localhost'),
      port: Number(item.port ?? 0) || 0,
      database: item.database ? String(item.database) : '',
      username: item.username ? String(item.username) : '',
      encrypt: item.encrypt !== false,
      trustServerCertificate: item.trustServerCertificate !== false,
      pooling: item.pooling !== false,
      status: String(item.status ?? 'disconnected'),
      created_at: createdAt,
      created_by: item.created_by != null ? String(item.created_by) : null,
      updated_at: updatedAt,
      updated_by: item.updated_by != null ? String(item.updated_by) : null,
    }, isRealDataSourcePassword(item.password) ? String(item.password) : undefined);

    console.log(`[credential-vault] Moved edge data source "${name}" (${id}) into base_data_sources.`);
  }
};

const main = async (): Promise<void> => {
  const settings = readSettingsObject(SETTINGS_PATH);
  const raw = settings[DATA_SOURCES_KEY];
  const array = Array.isArray(raw) ? raw : [];
  const items = array.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));

  if (items.length === 0) {
    console.log('[credential-vault] No dataSources[] entries — nothing to migrate.');
    return;
  }

  const defaultIndex = items.findIndex((item) => Boolean(item.isDefault));
  const defaultItem = items[defaultIndex >= 0 ? defaultIndex : 0];
  const extras = items.filter((_, index) => index !== (defaultIndex >= 0 ? defaultIndex : 0));

  const database = asRecord(settings.database);
  const provider = String(normalizeControlPlaneProvider(database?.provider) ?? 'postgresql');
  const urlPassword = readUrlPassword(provider, String(database?.url ?? ''));
  const persistedDefault = buildPersistedDefault(defaultItem, urlPassword);

  persistDefaultOnly(SETTINGS_PATH, persistedDefault, extras);
  console.log('[credential-vault] Encrypted the default data source password and stripped database.url.');

  if (extras.length === 0) {
    return;
  }

  try {
    await migrateEdgeSources(extras);
    persistDefaultOnly(SETTINGS_PATH, persistedDefault, []);
    console.log(`[credential-vault] Moved ${extras.length} non-default data source(s) out of settings.json.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[credential-vault] Default was encrypted, but edge sources were left in settings.json: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeControlPlaneSequelize();
  }
};

void main();
