/**
 * One-shot credential-vault migration for SSH Hub connections.
 *
 * Decrypts leftover `{ iv, authTag, ciphertext }` blobs with SSH_HUB_MASTER_KEY
 * (or the JWT-derived development key) and stores plaintext in the shared vault.
 * JSON files keep metadata + hasPassword / hasPrivateKey / hasPassphrase only.
 *
 * Run before starting a build that no longer reads those blobs:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-ssh-hub.ts
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { getAuthSecrets } from '../../../src/server/config/authSecrets';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import { SSH_HUB_INDEX_PATH } from '../../../src/core/runtime/runtimePaths';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { setSecret } from '../../../src/server/domain/security/credentialVault/credentialVault';
import {
  SSH_HUB_PASSPHRASE_PURPOSE,
  SSH_HUB_PASSWORD_PURPOSE,
  SSH_HUB_PRIVATE_KEY_PURPOSE,
  SSH_HUB_VAULT_OWNER_TYPE,
  isLegacySshHubSecretBlob,
} from '../../../src/server/services/ssh-hub/sshHubVault';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const DEV_SALT = 'appendo-ssh-hub-v1';

type LegacyBlob = { iv: string; authTag: string; ciphertext: string };

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const parseLegacyMasterKey = (raw: string): Buffer => {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === KEY_BYTES) {
    return base64;
  }
  throw new Error('SSH_HUB_MASTER_KEY must be 32 bytes as 64 hex characters or base64.');
};

const resolveLegacyMasterKey = (): Buffer => {
  const envKey = process.env.SSH_HUB_MASTER_KEY?.trim() ?? '';
  if (envKey) {
    return parseLegacyMasterKey(envKey);
  }
  return crypto.scryptSync(getAuthSecrets().accessTokenSecret, DEV_SALT, KEY_BYTES);
};

const decryptLegacySshHubSecret = (blob: LegacyBlob, masterKey: Buffer): string => {
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
  if (!isLegacySshHubSecretBlob(raw)) {
    if (field in entry) {
      delete entry[field];
    }
    entry[flag] = Boolean(entry[flag]);
    return false;
  }
  const plaintext = decryptLegacySshHubSecret(raw as LegacyBlob, masterKey);
  await setSecret(SSH_HUB_VAULT_OWNER_TYPE, ownerId, purpose, plaintext);
  delete entry[field];
  entry[flag] = true;
  return true;
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // Defaults in getAuthSecrets() match a fresh install's JWT-derived SSH Hub key.
  }

  if (!fs.existsSync(SSH_HUB_INDEX_PATH)) {
    console.log('[credential-vault] No SSH Hub index — nothing to migrate.');
    return;
  }

  const parsed = asRecord(JSON.parse(fs.readFileSync(SSH_HUB_INDEX_PATH, 'utf8')) as unknown);
  if (!parsed || parsed.schema !== 'appendo-ssh-hub-index' || !Array.isArray(parsed.connections)) {
    console.log('[credential-vault] SSH Hub index has no connections — nothing to migrate.');
    return;
  }

  const leftover = parsed.connections.some((item) => {
    const entry = asRecord(item);
    return Boolean(
      entry
      && (
        isLegacySshHubSecretBlob(entry.passwordCipher)
        || isLegacySshHubSecretBlob(entry.privateKeyCipher)
        || isLegacySshHubSecretBlob(entry.passphraseCipher)
      ),
    );
  });
  if (!leftover) {
    console.log('[credential-vault] SSH Hub secrets already use the vault — nothing to migrate.');
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
      if (await migrateCipherField(entry, 'passwordCipher', 'hasPassword', SSH_HUB_PASSWORD_PURPOSE, id, masterKey)) {
        moved += 1;
        console.log(`[credential-vault] Moved SSH Hub password for "${name}" (${id}).`);
      }
      if (await migrateCipherField(entry, 'privateKeyCipher', 'hasPrivateKey', SSH_HUB_PRIVATE_KEY_PURPOSE, id, masterKey)) {
        moved += 1;
        console.log(`[credential-vault] Moved SSH Hub private key for "${name}" (${id}).`);
      }
      if (await migrateCipherField(entry, 'passphraseCipher', 'hasPassphrase', SSH_HUB_PASSPHRASE_PURPOSE, id, masterKey)) {
        moved += 1;
        console.log(`[credential-vault] Moved SSH Hub passphrase for "${name}" (${id}).`);
      }
    }
    fs.writeFileSync(SSH_HUB_INDEX_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    console.log(`[credential-vault] Moved ${moved} SSH Hub secret(s) into the vault.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[credential-vault] SSH Hub migration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeControlPlaneSequelize();
  }
};

void main();
