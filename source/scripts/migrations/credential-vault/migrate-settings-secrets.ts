/**
 * One-shot credential-vault migration for leftover plaintext in settings
 * sections and platform blobs (SMTP, Redis, AI keys, Git OAuth, IdP).
 *
 * Copies non-empty secrets into the shared vault, then strips them from the
 * email settings section and platform blobs (DB and file fallback).
 *
 * Run before starting a build that no longer reads those plaintext fields:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-settings-secrets.ts
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 * Never copies GIT_GITHUB_OAUTH_CLIENT_SECRET or other env values onto disk.
 */
import { SETTINGS_PATH, readSettingsObject, writeSettingsObject } from '../../../src/server/config/settingsFile';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import {
  closePrismaControlPlane,
  initPrismaControlPlane,
} from '../../../src/server/db/prismaControlPlane';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { getSettingsSection, upsertSettingsSection } from '../../../src/server/domain/settings/settingsSectionRepository';
import {
  getPlatformBlobSection,
  upsertPlatformBlobSection,
} from '../../../src/server/domain/settings/platformBlobSectionRepository';
import { normalizeCacheSettings } from '../../../src/shared/api/contracts/cache/validators';
import { normalizeAiSettings } from '../../../src/shared/api/contracts/ai/validators';
import { normalizeGitSettings } from '../../../src/shared/api/contracts/git/validators';
import {
  CLIENT_SECRET_PURPOSE,
  IDENTITY_PROVIDER_OWNER_TYPE,
  isLegacyPlaintextSecret,
  isLegacySecretEnvRecord,
  setPlatformSecret,
} from '../../../src/server/domain/security/credentialVault/platformSettingsVault';
import {
  syncAiSettingsSecrets,
  syncCacheRedisPassword,
  syncGitOAuthSecret,
  syncSmtpPassword,
} from '../../../src/server/domain/security/credentialVault/platformSettingsSecrets';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const writeSettingsKey = (settingsPath: string, key: string, value: unknown): void => {
  const settings = readSettingsObject(settingsPath);
  settings[key] = value;
  writeSettingsObject(settingsPath, settings);
};

const migrateEmail = async (): Promise<number> => {
  let moved = 0;
  const row = await getSettingsSection('email');
  const section = row?.value;
  if (section && isLegacyPlaintextSecret(section.smtpPass)) {
    await syncSmtpPassword(section.smtpPass, false);
    await upsertSettingsSection('email', {
      ...section,
      smtpPass: '',
      smtpHasPassword: true,
    }, null);
    moved += 1;
  }

  const file = asRecord(readSettingsObject(SETTINGS_PATH).email);
  if (file && isLegacyPlaintextSecret(file.smtpPass)) {
    await syncSmtpPassword(file.smtpPass, Boolean(file.smtpHasPassword));
    writeSettingsKey(SETTINGS_PATH, 'email', {
      ...file,
      smtpPass: '',
      smtpHasPassword: true,
    });
    moved += 1;
  }
  return moved;
};

const migrateCache = async (): Promise<number> => {
  let moved = 0;
  const row = await getPlatformBlobSection('cache');
  if (row) {
    const normalized = normalizeCacheSettings(row.value);
    if (isLegacyPlaintextSecret(normalized.storeSettings.redis.password)) {
      const stripped = await syncCacheRedisPassword(normalized);
      await upsertPlatformBlobSection('cache', stripped as unknown as Record<string, unknown>, null);
      moved += 1;
    }
  }

  const fileRaw = readSettingsObject(SETTINGS_PATH).cache;
  if (fileRaw) {
    const normalized = normalizeCacheSettings(fileRaw);
    if (isLegacyPlaintextSecret(normalized.storeSettings.redis.password)) {
      const stripped = await syncCacheRedisPassword(normalized);
      writeSettingsKey(SETTINGS_PATH, 'cache', stripped);
      moved += 1;
    }
  }
  return moved;
};

const aiHasLeftover = (settings: ReturnType<typeof normalizeAiSettings>): boolean => (
  settings.providers.some((provider) => isLegacyPlaintextSecret(provider.apiKey))
  || isLegacyPlaintextSecret(settings.mcp.inboundHost?.apiKey)
  || isLegacyPlaintextSecret(settings.webSearch.apiKey)
  || settings.mcpServers.some((server) => isLegacySecretEnvRecord(server.env))
);

const migrateAi = async (): Promise<number> => {
  let moved = 0;
  const row = await getPlatformBlobSection('ai');
  if (row) {
    const normalized = normalizeAiSettings(row.value);
    if (aiHasLeftover(normalized)) {
      const stripped = await syncAiSettingsSecrets(normalized);
      await upsertPlatformBlobSection('ai', stripped as unknown as Record<string, unknown>, null);
      moved += 1;
    }
  }

  const fileRaw = readSettingsObject(SETTINGS_PATH).ai;
  if (fileRaw) {
    const normalized = normalizeAiSettings(fileRaw);
    if (aiHasLeftover(normalized)) {
      const stripped = await syncAiSettingsSecrets(normalized);
      writeSettingsKey(SETTINGS_PATH, 'ai', stripped);
      moved += 1;
    }
  }
  return moved;
};

const migrateGit = async (): Promise<number> => {
  let moved = 0;
  const row = await getPlatformBlobSection('git');
  if (row) {
    const normalized = normalizeGitSettings(row.value);
    if (isLegacyPlaintextSecret(normalized.githubOAuth?.clientSecret)) {
      const stripped = await syncGitOAuthSecret(normalized);
      await upsertPlatformBlobSection('git', stripped as unknown as Record<string, unknown>, null);
      moved += 1;
    }
  }

  const fileRaw = readSettingsObject(SETTINGS_PATH).git;
  if (fileRaw) {
    const normalized = normalizeGitSettings(fileRaw);
    if (isLegacyPlaintextSecret(normalized.githubOAuth?.clientSecret)) {
      const stripped = await syncGitOAuthSecret(normalized);
      writeSettingsKey(SETTINGS_PATH, 'git', stripped);
      moved += 1;
    }
  }
  return moved;
};

const listIdentityProviders = (raw: unknown): Record<string, unknown>[] => {
  const record = asRecord(raw);
  const list = record?.identityProviders;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((item): item is Record<string, unknown> => (
    Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  ));
};

const stripIdentityProviderSecrets = async (
  providers: Record<string, unknown>[],
): Promise<{ next: Record<string, unknown>[]; moved: boolean }> => {
  let moved = false;
  const next: Record<string, unknown>[] = [];
  for (const provider of providers) {
    const id = String(provider.id ?? '').trim();
    const incoming = provider.clientSecret;
    let hasClientSecret = Boolean(provider.hasClientSecret);
    if (isLegacyPlaintextSecret(incoming) && id) {
      await setPlatformSecret(IDENTITY_PROVIDER_OWNER_TYPE, id, CLIENT_SECRET_PURPOSE, String(incoming));
      hasClientSecret = true;
      moved = true;
    }
    next.push({
      ...provider,
      clientSecret: undefined,
      hasClientSecret,
    });
  }
  return { next, moved };
};

const migrateIdentity = async (): Promise<number> => {
  let moved = 0;
  const row = await getPlatformBlobSection('identity-providers');
  if (row) {
    const providers = listIdentityProviders(row.value);
    if (providers.some((item) => isLegacyPlaintextSecret(item.clientSecret))) {
      const stripped = await stripIdentityProviderSecrets(providers);
      await upsertPlatformBlobSection(
        'identity-providers',
        { identityProviders: stripped.next },
        null,
      );
      if (stripped.moved) {
        moved += 1;
      }
    }
  }

  const fileAuth = asRecord(readSettingsObject(SETTINGS_PATH).auth);
  if (fileAuth) {
    const providers = listIdentityProviders(fileAuth);
    if (providers.some((item) => isLegacyPlaintextSecret(item.clientSecret))) {
      const stripped = await stripIdentityProviderSecrets(providers);
      const settings = readSettingsObject(SETTINGS_PATH);
      settings.auth = {
        ...fileAuth,
        identityProviders: stripped.next,
      };
      writeSettingsObject(SETTINGS_PATH, settings);
      if (stripped.moved) {
        moved += 1;
      }
    }
  }
  return moved;
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // JWT-derived vault key still works from getAuthSecrets() defaults.
  }

  await initPrismaControlPlane(SETTINGS_PATH);
  await ensureCredentialVaultTable();

  const email = await migrateEmail();
  const cache = await migrateCache();
  const ai = await migrateAi();
  const git = await migrateGit();
  const identity = await migrateIdentity();

  await closePrismaControlPlane();
  await closeControlPlaneSequelize();

  console.log(
    `[credential-vault] migrate-settings-secrets: email=${email} cache=${cache} ai=${ai} git=${git} identity=${identity}`,
  );
};

void main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[credential-vault] migrate-settings-secrets failed: ${message}`);
  try {
    await closePrismaControlPlane();
    await closeControlPlaneSequelize();
  } catch {
    // ignore shutdown errors
  }
  process.exitCode = 1;
});
