/**
 * One-shot credential-vault migration for Workflow secret references.
 *
 * Decrypts leftover `{ iv, authTag, ciphertext }` blobs in Prisma
 * `encryptedValueJson` with WORKFLOW_SECRET_MASTER_KEY (or the JWT-derived
 * development key) and rewrites the same column with the shared
 * credential-vault blob (`alg` + `keyVersion`). The Prisma model is unchanged.
 *
 * Run before starting a build that no longer reads those blobs:
 *
 *   npx tsx scripts/migrations/credential-vault/migrate-workflow-secrets.ts
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 */
import crypto from 'node:crypto';
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { getAuthSecrets } from '../../../src/server/config/authSecrets';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import {
  closePrismaControlPlane,
  initPrismaControlPlane,
} from '../../../src/server/db/prismaControlPlane';
import { prisma } from '../../../src/server/domain/workflow/prismaHelpers';
import { encryptCredential, isCredentialEncryptedBlob } from '../../../src/server/domain/security/credentialVault/credentialCrypto';
import { isLegacyWorkflowCredentialBlob } from '../../../src/server/domain/workflow/workflowCredentialCrypto';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const DEV_SALT = 'appendo-workflow-credentials-v1';

type LegacyBlob = { iv: string; authTag: string; ciphertext: string };

const parseLegacyMasterKey = (raw: string): Buffer => {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === KEY_BYTES) {
    return base64;
  }
  throw new Error('WORKFLOW_SECRET_MASTER_KEY must be 32 bytes as 64 hex characters or base64.');
};

const resolveLegacyMasterKey = (): Buffer => {
  const envKey = process.env.WORKFLOW_SECRET_MASTER_KEY?.trim() ?? '';
  if (envKey) {
    return parseLegacyMasterKey(envKey);
  }
  return crypto.scryptSync(getAuthSecrets().accessTokenSecret, DEV_SALT, KEY_BYTES);
};

const decryptLegacyWorkflowSecret = (blob: LegacyBlob, masterKey: Buffer): string => {
  const decipher = crypto.createDecipheriv(ALGO, masterKey, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const parseStoredBlob = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // Defaults in getAuthSecrets() match a fresh install's JWT-derived workflow key.
  }

  try {
    await initPrismaControlPlane(SETTINGS_PATH);
    const rows = await prisma().workflowSecretReference.findMany({
      select: { id: true, name: true, encryptedValueJson: true },
    });
    const leftover = rows.filter((row) => (
      Boolean(row.encryptedValueJson) && isLegacyWorkflowCredentialBlob(parseStoredBlob(row.encryptedValueJson ?? ''))
    ));
    if (leftover.length === 0) {
      console.log('[credential-vault] Workflow secret blobs already use the shared crypto — nothing to migrate.');
      return;
    }

    const masterKey = resolveLegacyMasterKey();
    let moved = 0;
    for (const row of leftover) {
      const blob = parseStoredBlob(row.encryptedValueJson ?? '');
      if (!isLegacyWorkflowCredentialBlob(blob) || isCredentialEncryptedBlob(blob)) {
        continue;
      }
      const plaintext = decryptLegacyWorkflowSecret(blob as LegacyBlob, masterKey);
      const next = encryptCredential(plaintext);
      await prisma().workflowSecretReference.update({
        where: { id: row.id },
        data: { encryptedValueJson: JSON.stringify(next) },
      });
      moved += 1;
      console.log(`[credential-vault] Rewrote workflow secret blob for "${row.name}" (${row.id.toString()}).`);
    }
    console.log(`[credential-vault] Rewrote ${moved} workflow secret blob(s) onto the shared crypto.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[credential-vault] Workflow secret migration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closePrismaControlPlane();
  }
};

void main();
