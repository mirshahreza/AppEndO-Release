/**
 * One-shot credential-vault migration for Git PAT credentials.
 *
 * Decrypts leftover `{ v: 1, iv, authTag, ciphertext }` blobs (JWT-derived
 * scrypt key, salt `appendo-git-credentials-v1`) or leftover plaintext tokens
 * and stores them in the shared vault. The credential file keeps metadata +
 * `hasToken` only.
 *
 * Run before starting a build that no longer reads those blobs:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-git-credentials.ts
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { getAuthSecrets } from '../../../src/server/config/authSecrets';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { setSecret } from '../../../src/server/domain/security/credentialVault/credentialVault';
import {
  GIT_CREDENTIAL_TOKEN_PURPOSE,
  GIT_CREDENTIAL_VAULT_OWNER_ID,
  GIT_CREDENTIAL_VAULT_OWNER_TYPE,
  isLegacyGitSecretBlob,
} from '../../../src/server/services/git/gitCredentialVault';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const DEV_SALT = 'appendo-git-credentials-v1';
const CREDENTIAL_FILE_NAME = '.appendo-git-credentials.json';

type LegacyBlob = { v: 1; iv: string; authTag: string; ciphertext: string };

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const resolveCredentialPath = (): string => path.join(process.cwd(), CREDENTIAL_FILE_NAME);

const resolveLegacyMasterKey = (): Buffer => (
  crypto.scryptSync(getAuthSecrets().accessTokenSecret, DEV_SALT, KEY_BYTES)
);

const decryptLegacyGitSecret = (blob: LegacyBlob, masterKey: Buffer): string => {
  const decipher = crypto.createDecipheriv(ALGO, masterKey, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const readCredentialFile = (): Record<string, unknown> | null => {
  const filePath = resolveCredentialPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  return asRecord(parsed);
};

const extractLegacyToken = (raw: Record<string, unknown>, masterKey: Buffer): string | null => {
  const token = raw.token;
  if (typeof token === 'string' && token.trim()) {
    return token.trim();
  }
  if (isLegacyGitSecretBlob(token)) {
    return decryptLegacyGitSecret(token as LegacyBlob, masterKey);
  }
  return null;
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // Defaults in getAuthSecrets() match a fresh install's JWT-derived Git key.
  }

  const raw = readCredentialFile();
  if (!raw) {
    console.log('[credential-vault] No .appendo-git-credentials.json — nothing to migrate.');
    return;
  }

  const leftover = (typeof raw.token === 'string' && raw.token.trim()) || isLegacyGitSecretBlob(raw.token);
  if (!leftover) {
    console.log('[credential-vault] Git credentials already use the vault — nothing to migrate.');
    return;
  }

  const masterKey = resolveLegacyMasterKey();
  try {
    await ensureCredentialVaultTable();
    const plaintext = extractLegacyToken(raw, masterKey);
    if (!plaintext) {
      console.log('[credential-vault] Git credential token field was present but empty — stripped.');
    } else {
      await setSecret(
        GIT_CREDENTIAL_VAULT_OWNER_TYPE,
        GIT_CREDENTIAL_VAULT_OWNER_ID,
        GIT_CREDENTIAL_TOKEN_PURPOSE,
        plaintext,
      );
      console.log('[credential-vault] Moved Git PAT into the vault.');
    }
    delete raw.token;
    raw.hasToken = Boolean(plaintext);
    fs.writeFileSync(resolveCredentialPath(), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[credential-vault] Git credential migration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeControlPlaneSequelize();
  }
};

void main();
