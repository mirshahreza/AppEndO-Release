import { randomUUID } from 'node:crypto';
import type { Sequelize } from 'sequelize';
import { LATIN_SLUG_RE } from '../../../../shared/lib/latinSlug';
import { getControlPlaneSequelize } from '../../../db/controlPlaneSequelize';
import {
  decryptCredential,
  encryptCredential,
  resolveCredentialKeyVersion,
  resolveCredentialPreviousKey,
} from './credentialCrypto';
import {
  getCredentialVaultModel,
  type CredentialVaultSecretRow,
} from './credentialVaultSequelizeModel';

let sequelizeForTests: Sequelize | null = null;

export const configureCredentialVaultSequelizeForTests = (sequelize: Sequelize | null): void => {
  sequelizeForTests = sequelize;
};

const resolveSequelize = (): Sequelize => sequelizeForTests ?? getControlPlaneSequelize();

const requireLatinSlug = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed || !LATIN_SLUG_RE.test(trimmed)) {
    throw new Error(`${label} must be a lowercase Latin slug (letters, digits, dot, dash, underscore).`);
  }
  return trimmed;
};

const requireOwnerId = (ownerId: string): string => {
  const trimmed = String(ownerId ?? '').trim();
  if (!trimmed) {
    throw new Error('ownerId is required.');
  }
  if (trimmed.length > 128) {
    throw new Error('ownerId must be at most 128 characters.');
  }
  return trimmed;
};

const requirePlaintext = (plaintext: string): string => {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Secret plaintext must be a non-empty string.');
  }
  return plaintext;
};

const asActorId = (actorUserId?: number | null): number | null => {
  if (actorUserId == null) {
    return null;
  }
  const parsed = Number(actorUserId);
  return Number.isFinite(parsed) ? parsed : null;
};

const ownerLookup = (ownerType: string, ownerId: string, purpose: string) => ({
  ownerType: requireLatinSlug(ownerType, 'ownerType'),
  ownerId: requireOwnerId(ownerId),
  purpose: requireLatinSlug(purpose, 'purpose'),
});

export async function setSecret(
  ownerType: string,
  ownerId: string,
  purpose: string,
  plaintext: string,
  actorUserId?: number | null,
): Promise<void> {
  const lookup = ownerLookup(ownerType, ownerId, purpose);
  const value = requirePlaintext(plaintext);
  const blob = encryptCredential(value);
  const now = new Date();
  const actor = asActorId(actorUserId);
  const model = getCredentialVaultModel(resolveSequelize());
  const existing = await model.findOne({ where: lookup });

  if (existing) {
    await existing.update({
      keyVersion: blob.keyVersion,
      iv: blob.iv,
      authTag: blob.authTag,
      ciphertext: blob.ciphertext,
      updatedAt: now,
      updatedBy: actor,
    });
    return;
  }

  await model.create({
    id: randomUUID(),
    ...lookup,
    keyVersion: blob.keyVersion,
    iv: blob.iv,
    authTag: blob.authTag,
    ciphertext: blob.ciphertext,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
    updatedBy: actor,
    rotatedAt: null,
  });
}

const toBlob = (row: CredentialVaultSecretRow) => ({
  alg: 'aes-256-gcm' as const,
  keyVersion: row.keyVersion,
  iv: row.iv,
  authTag: row.authTag,
  ciphertext: row.ciphertext,
});

export async function getSecret(
  ownerType: string,
  ownerId: string,
  purpose: string,
): Promise<string | null> {
  const lookup = ownerLookup(ownerType, ownerId, purpose);
  const model = getCredentialVaultModel(resolveSequelize());
  const row = await model.findOne({ where: lookup });
  if (!row) {
    return null;
  }
  return decryptCredential(toBlob(row));
}

export async function hasSecret(
  ownerType: string,
  ownerId: string,
  purpose: string,
): Promise<boolean> {
  const lookup = ownerLookup(ownerType, ownerId, purpose);
  const model = getCredentialVaultModel(resolveSequelize());
  const count = await model.count({ where: lookup });
  return count > 0;
}

export async function deleteSecret(
  ownerType: string,
  ownerId: string,
  purpose: string,
): Promise<void> {
  const lookup = ownerLookup(ownerType, ownerId, purpose);
  const model = getCredentialVaultModel(resolveSequelize());
  await model.destroy({ where: lookup });
}

export async function deleteSecretsForOwner(ownerType: string, ownerId: string): Promise<number> {
  const model = getCredentialVaultModel(resolveSequelize());
  return model.destroy({
    where: {
      ownerType: requireLatinSlug(ownerType, 'ownerType'),
      ownerId: requireOwnerId(ownerId),
    },
  });
}

export async function rotateDbVaultSecrets(): Promise<{ migrated: number; failed: string[] }> {
  const currentVersion = resolveCredentialKeyVersion();
  const model = getCredentialVaultModel(resolveSequelize());
  const rows = await model.findAll();
  const stale = rows.filter((row) => row.keyVersion !== currentVersion);

  if (stale.length > 0 && !resolveCredentialPreviousKey() && stale.some((row) => row.keyVersion === currentVersion - 1)) {
    throw new Error(
      'APPENDO_CREDENTIAL_MASTER_KEY_PREVIOUS is required before rotating secrets that still use the previous key version.',
    );
  }

  let migrated = 0;
  const failed: string[] = [];
  const now = new Date();

  for (const row of stale) {
    const label = `${row.ownerType}/${row.ownerId}/${row.purpose}`;
    try {
      const plaintext = decryptCredential(toBlob(row));
      const blob = encryptCredential(plaintext);
      await row.update({
        keyVersion: blob.keyVersion,
        iv: blob.iv,
        authTag: blob.authTag,
        ciphertext: blob.ciphertext,
        updatedAt: now,
        rotatedAt: now,
      });
      migrated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push(`${label}: ${message}`);
    }
  }

  return { migrated, failed };
}
