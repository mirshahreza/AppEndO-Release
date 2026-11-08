/**
 * One-shot credential-vault migration for HTTP Connections and API Talk collections.
 *
 * Decrypts leftover `{ iv, authTag, ciphertext }` blobs with the old
 * HTTP_CONNECTOR_MASTER_KEY (or the JWT-derived development key) and stores
 * plaintext in the shared vault. JSON files keep metadata + `hasSecret` only.
 *
 * Run before starting a build that no longer reads those blobs:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-http-connections.ts
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { getAuthSecrets } from '../../../src/server/config/authSecrets';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import { HTTP_CONNECTIONS_INDEX_PATH, HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH } from '../../../src/core/runtime/runtimePaths';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { setSecret } from '../../../src/server/domain/security/credentialVault/credentialVault';
import {
  HTTP_CONNECTION_VAULT_OWNER_TYPE,
  HTTP_SECRET_PURPOSE,
  HTTP_WORKSHOP_VAULT_OWNER_TYPE,
  isLegacyHttpSecretBlob,
} from '../../../src/server/services/http-connections/httpConnectionVault';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const DEV_SALT = 'appendo-http-connections-v1';

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
  throw new Error('HTTP_CONNECTOR_MASTER_KEY must be 32 bytes as 64 hex characters or base64.');
};

const resolveLegacyMasterKey = (): Buffer => {
  const envKey = process.env.HTTP_CONNECTOR_MASTER_KEY?.trim() ?? '';
  if (envKey) {
    return parseLegacyMasterKey(envKey);
  }
  return crypto.scryptSync(getAuthSecrets().accessTokenSecret, DEV_SALT, KEY_BYTES);
};

const decryptLegacyHttpSecret = (blob: LegacyBlob, masterKey: Buffer): string => {
  const decipher = crypto.createDecipheriv(ALGO, masterKey, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const readJsonFile = (filePath: string): Record<string, unknown> | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return asRecord(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${filePath}: ${message}`);
  }
};

const writeJsonFile = (filePath: string, value: Record<string, unknown>): void => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const migrateAuth = async (
  authValue: unknown,
  ownerId: string,
  masterKey: Buffer,
): Promise<boolean> => {
  const auth = asRecord(authValue);
  if (!auth) {
    return false;
  }
  if (!isLegacyHttpSecretBlob(auth.secret)) {
    if ('secret' in auth) {
      delete auth.secret;
    }
    auth.hasSecret = Boolean(auth.hasSecret);
    return false;
  }
  const plaintext = decryptLegacyHttpSecret(auth.secret as LegacyBlob, masterKey);
  await setSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, ownerId, HTTP_SECRET_PURPOSE, plaintext);
  delete auth.secret;
  auth.hasSecret = true;
  return true;
};

const migrateConnectionIndex = async (masterKey: Buffer): Promise<number> => {
  const parsed = readJsonFile(HTTP_CONNECTIONS_INDEX_PATH);
  if (!parsed || parsed.schema !== 'appendo-http-connections-index' || !Array.isArray(parsed.entries)) {
    return 0;
  }
  let moved = 0;
  for (const item of parsed.entries) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }
    const id = String(entry.id ?? '').trim();
    if (!id) {
      continue;
    }
    if (!isLegacyHttpSecretBlob(entry.secret)) {
      if ('secret' in entry) {
        delete entry.secret;
      }
      entry.hasSecret = Boolean(entry.hasSecret);
      continue;
    }
    const plaintext = decryptLegacyHttpSecret(entry.secret as LegacyBlob, masterKey);
    await setSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, id, HTTP_SECRET_PURPOSE, plaintext);
    delete entry.secret;
    entry.hasSecret = true;
    moved += 1;
    console.log(`[credential-vault] Moved HTTP connection secret for "${String(entry.name ?? id)}" (${id}).`);
  }
  writeJsonFile(HTTP_CONNECTIONS_INDEX_PATH, parsed);
  return moved;
};

const migrateWorkshopIndex = async (masterKey: Buffer): Promise<number> => {
  const parsed = readJsonFile(HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH);
  if (!parsed || parsed.schema !== 'appendo-http-workshop-collections-index') {
    return 0;
  }
  let moved = 0;
  const walk = async (items: unknown, label: string): Promise<void> => {
    if (!Array.isArray(items)) {
      return;
    }
    for (const item of items) {
      const entry = asRecord(item);
      if (!entry) {
        continue;
      }
      const id = String(entry.id ?? '').trim();
      if (!id) {
        continue;
      }
      const changed = await migrateAuth(entry.auth, id, masterKey);
      if (changed) {
        moved += 1;
        console.log(`[credential-vault] Moved API Talk ${label} secret for "${String(entry.name ?? id)}" (${id}).`);
      }
    }
  };
  await walk(parsed.collections, 'collection');
  await walk(parsed.folders, 'folder');
  await walk(parsed.requests, 'request');
  writeJsonFile(HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH, parsed);
  return moved;
};

const countLegacyBlobs = (): number => {
  let count = 0;
  const connections = readJsonFile(HTTP_CONNECTIONS_INDEX_PATH);
  if (connections && Array.isArray(connections.entries)) {
    for (const item of connections.entries) {
      const entry = asRecord(item);
      if (entry && isLegacyHttpSecretBlob(entry.secret)) {
        count += 1;
      }
    }
  }
  const workshop = readJsonFile(HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH);
  if (workshop) {
    for (const key of ['collections', 'folders', 'requests'] as const) {
      const items = workshop[key];
      if (!Array.isArray(items)) {
        continue;
      }
      for (const item of items) {
        const entry = asRecord(item);
        const auth = asRecord(entry?.auth);
        if (auth && isLegacyHttpSecretBlob(auth.secret)) {
          count += 1;
        }
      }
    }
  }
  return count;
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // Defaults in getAuthSecrets() match a fresh install's JWT-derived HTTP key.
  }

  const leftover = countLegacyBlobs();
  if (leftover === 0) {
    console.log('[credential-vault] No leftover HTTP/API Talk secret blobs — nothing to migrate.');
    return;
  }

  const masterKey = resolveLegacyMasterKey();
  try {
    await ensureCredentialVaultTable();
    const connectionsMoved = await migrateConnectionIndex(masterKey);
    const workshopMoved = await migrateWorkshopIndex(masterKey);
    console.log(`[credential-vault] Moved ${connectionsMoved + workshopMoved} HTTP/API Talk secret(s) into the vault.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[credential-vault] HTTP/API Talk migration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeControlPlaneSequelize();
  }
};

void main();
