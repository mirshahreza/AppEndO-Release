/**
 * One-shot credential-vault migration for RDP Hub connections.
 *
 * Decrypts leftover `{ iv, authTag, ciphertext }` blobs with RDP_HUB_MASTER_KEY
 * (or the JWT-derived development key) and stores plaintext in the shared vault.
 * JSON files keep metadata + hasPassword only.
 *
 * Run before starting a build that no longer reads those blobs:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-rdp-hub.ts
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { getAuthSecrets } from '../../../src/server/config/authSecrets';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import { RDP_HUB_INDEX_PATH } from '../../../src/core/runtime/runtimePaths';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { setSecret } from '../../../src/server/domain/security/credentialVault/credentialVault';
import {
  RDP_HUB_PASSWORD_PURPOSE,
  RDP_HUB_VAULT_OWNER_TYPE,
  isLegacyRdpHubSecretBlob,
} from '../../../src/server/services/rdp-hub/rdpHubVault';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const DEV_SALT = 'appendo-rdp-hub-v1';

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
  throw new Error('RDP_HUB_MASTER_KEY must be 32 bytes as 64 hex characters or base64.');
};

const resolveLegacyMasterKey = (): Buffer => {
  const envKey = process.env.RDP_HUB_MASTER_KEY?.trim() ?? '';
  if (envKey) {
    return parseLegacyMasterKey(envKey);
  }
  return crypto.scryptSync(getAuthSecrets().accessTokenSecret, DEV_SALT, KEY_BYTES);
};

const decryptLegacyRdpHubSecret = (blob: LegacyBlob, masterKey: Buffer): string => {
  const decipher = crypto.createDecipheriv(ALGO, masterKey, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // Defaults in getAuthSecrets() match a fresh install's JWT-derived RDP Hub key.
  }

  if (!fs.existsSync(RDP_HUB_INDEX_PATH)) {
    console.log('[credential-vault] No RDP Hub index — nothing to migrate.');
    return;
  }

  const parsed = asRecord(JSON.parse(fs.readFileSync(RDP_HUB_INDEX_PATH, 'utf8')) as unknown);
  if (!parsed || parsed.schema !== 'appendo-rdp-hub-index' || !Array.isArray(parsed.connections)) {
    console.log('[credential-vault] RDP Hub index has no connections — nothing to migrate.');
    return;
  }

  const leftover = parsed.connections.some((item) => {
    const entry = asRecord(item);
    return Boolean(entry && isLegacyRdpHubSecretBlob(entry.passwordCipher));
  });
  if (!leftover) {
    console.log('[credential-vault] RDP Hub secrets already use the vault — nothing to migrate.');
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
      const raw = entry.passwordCipher;
      if (!isLegacyRdpHubSecretBlob(raw)) {
        if ('passwordCipher' in entry) {
          delete entry.passwordCipher;
        }
        entry.hasPassword = Boolean(entry.hasPassword);
        continue;
      }
      const plaintext = decryptLegacyRdpHubSecret(raw as LegacyBlob, masterKey);
      await setSecret(RDP_HUB_VAULT_OWNER_TYPE, id, RDP_HUB_PASSWORD_PURPOSE, plaintext);
      delete entry.passwordCipher;
      entry.hasPassword = true;
      moved += 1;
      console.log(`[credential-vault] Moved RDP Hub password for "${name}" (${id}).`);
    }
    fs.writeFileSync(RDP_HUB_INDEX_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    console.log(`[credential-vault] Moved ${moved} RDP Hub secret(s) into the vault.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[credential-vault] RDP Hub migration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeControlPlaneSequelize();
  }
};

void main();
