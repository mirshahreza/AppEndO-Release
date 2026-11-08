/**
 * One-shot credential-vault migration for File Hub connections.
 *
 * Decrypts leftover `{ iv, authTag, ciphertext }` blobs with FILE_HUB_MASTER_KEY
 * (or SSH_HUB_MASTER_KEY, or the JWT-derived development key) and stores
 * plaintext in the shared vault. JSON files keep metadata + hasPassword /
 * hasPrivateKey / hasPassphrase only.
 *
 * Run before starting a build that no longer reads those blobs:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-file-hub.ts
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { getAuthSecrets } from '../../../src/server/config/authSecrets';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import { FILE_HUB_INDEX_PATH } from '../../../src/core/runtime/runtimePaths';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { setSecret } from '../../../src/server/domain/security/credentialVault/credentialVault';
import {
  FILE_HUB_PASSPHRASE_PURPOSE,
  FILE_HUB_PASSWORD_PURPOSE,
  FILE_HUB_PRIVATE_KEY_PURPOSE,
  FILE_HUB_VAULT_OWNER_TYPE,
  isLegacyFileHubSecretBlob,
} from '../../../src/server/services/file-hub/fileHubVault';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const DEV_SALT = 'appendo-file-hub-v1';

type LegacyBlob = { iv: string; authTag: string; ciphertext: string };

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const parseLegacyMasterKey = (raw: string, envName: string): Buffer => {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === KEY_BYTES) {
    return base64;
  }
  throw new Error(`${envName} must be 32 bytes as 64 hex characters or base64.`);
};

const resolveLegacyMasterKey = (): Buffer => {
  const fileHubKey = process.env.FILE_HUB_MASTER_KEY?.trim() ?? '';
  if (fileHubKey) {
    return parseLegacyMasterKey(fileHubKey, 'FILE_HUB_MASTER_KEY');
  }
  const sshHubKey = process.env.SSH_HUB_MASTER_KEY?.trim() ?? '';
  if (sshHubKey) {
    return parseLegacyMasterKey(sshHubKey, 'SSH_HUB_MASTER_KEY');
  }
  return crypto.scryptSync(getAuthSecrets().accessTokenSecret, DEV_SALT, KEY_BYTES);
};

const decryptLegacyFileHubSecret = (blob: LegacyBlob, masterKey: Buffer): string => {
  const decipher = crypto.createDecipheriv(ALGO, masterKey, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const migrateCipherField = async (
  entry: Record<string, unknown>,
  field: 'passwordCipher' | 'privateKeyCipher' | 'passphraseCipher',
  flag: 'hasPassword' | 'hasPrivateKey' | 'hasPassphrase',
  purpose: string,
  ownerId: string,
  masterKey: Buffer,
): Promise<boolean> => {
  const raw = entry[field];
  if (!isLegacyFileHubSecretBlob(raw)) {
    if (field in entry) {
      delete entry[field];
    }
    entry[flag] = Boolean(entry[flag]);
    return false;
  }
  const plaintext = decryptLegacyFileHubSecret(raw as LegacyBlob, masterKey);
  await setSecret(FILE_HUB_VAULT_OWNER_TYPE, ownerId, purpose, plaintext);
  delete entry[field];
  entry[flag] = true;
  return true;
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // Defaults in getAuthSecrets() match a fresh install's JWT-derived File Hub key.
  }

  if (!fs.existsSync(FILE_HUB_INDEX_PATH)) {
    console.log('[credential-vault] No File Hub index — nothing to migrate.');
    return;
  }

  const parsed = asRecord(JSON.parse(fs.readFileSync(FILE_HUB_INDEX_PATH, 'utf8')) as unknown);
  if (!parsed || parsed.schema !== 'appendo-file-hub-index' || !Array.isArray(parsed.connections)) {
    console.log('[credential-vault] File Hub index has no connections — nothing to migrate.');
    return;
  }

  const leftover = parsed.connections.some((item) => {
    const entry = asRecord(item);
    return Boolean(
      entry
      && (
        isLegacyFileHubSecretBlob(entry.passwordCipher)
        || isLegacyFileHubSecretBlob(entry.privateKeyCipher)
        || isLegacyFileHubSecretBlob(entry.passphraseCipher)
      ),
    );
  });
  if (!leftover) {
    console.log('[credential-vault] File Hub secrets already use the vault — nothing to migrate.');
    return;
  }

  const masterKey = resolveLegacyMasterKey();
  try {
    await ensureCredentialVaultTable();
    let moved = 0;
    for (const item of parsed.connections) {
      const entry = asRecord(item);
      if (!entry) {
        continue;
      }
      const id = String(entry.id ?? '').trim();
      if (!id) {
        continue;
      }
      const name = String(entry.name ?? id);
      if (await migrateCipherField(entry, 'passwordCipher', 'hasPassword', FILE_HUB_PASSWORD_PURPOSE, id, masterKey)) {
        moved += 1;
        console.log(`[credential-vault] Moved File Hub password for "${name}" (${id}).`);
      }
      if (await migrateCipherField(entry, 'privateKeyCipher', 'hasPrivateKey', FILE_HUB_PRIVATE_KEY_PURPOSE, id, masterKey)) {
        moved += 1;
        console.log(`[credential-vault] Moved File Hub private key for "${name}" (${id}).`);
      }
      if (await migrateCipherField(entry, 'passphraseCipher', 'hasPassphrase', FILE_HUB_PASSPHRASE_PURPOSE, id, masterKey)) {
        moved += 1;
        console.log(`[credential-vault] Moved File Hub passphrase for "${name}" (${id}).`);
      }
    }
    fs.writeFileSync(FILE_HUB_INDEX_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    console.log(`[credential-vault] Moved ${moved} File Hub secret(s) into the vault.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[credential-vault] File Hub migration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeControlPlaneSequelize();
  }
};

void main();
