import {
  resolveCredentialKeyVersion,
  resolveCredentialPreviousKey,
} from '../security/credentialVault/credentialCrypto';
import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import { createWorkflowSecretReferenceInputSchema, updateWorkflowSecretReferenceInputSchema } from './schemas';
import {
  encryptWorkflowCredentialValue,
  decryptWorkflowCredentialValue,
  isLegacyWorkflowCredentialBlob,
  isWorkflowCredentialEncryptedBlob,
  LEGACY_WORKFLOW_SECRET_BLOB_ERROR,
} from './workflowCredentialCrypto';
import type { WorkflowSecretReferenceRecord } from './types';
import type { z } from 'zod';

export type CreateWorkflowSecretReferenceInput = z.infer<typeof createWorkflowSecretReferenceInputSchema>;
export type UpdateWorkflowSecretReferenceInput = z.infer<typeof updateWorkflowSecretReferenceInputSchema>;

const mapRecord = (row: {
  id: bigint;
  name: string;
  label: string;
  description: string | null;
  encryptedValueJson: string | null;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
}): WorkflowSecretReferenceRecord => ({
  id: fromId(row.id),
  name: row.name,
  label: row.label,
  description: row.description,
  // Live `process.env` presence check on this process only — informational, see the type's doc comment.
  configuredOnThisNode: String(process.env[row.name] ?? '').trim().length > 0,
  hasStoredValue: Boolean(row.encryptedValueJson),
  createdAt: toIsoString(row.createdAt),
  createdBy: toNullableId(row.createdBy),
  updatedAt: toIsoString(row.updatedAt),
  updatedBy: toNullableId(row.updatedBy),
});

export async function listWorkflowSecretReferences(): Promise<WorkflowSecretReferenceRecord[]> {
  const rows = await prisma().workflowSecretReference.findMany({ orderBy: { name: 'asc' } });
  return rows.map(mapRecord);
}

/** A friendly pre-check for the common case (no Prisma-error-code translation precedent exists
 * anywhere else in this codebase, per Repository Reality Audit — matching the established
 * `workflowTransportBadRequest` plain-Error convention from `workflowTransportSupport.ts` instead
 * of introducing a new one). The `@@unique([name])` DB constraint remains the real guarantee under
 * a race; this only makes the common, non-concurrent case return a readable message. */
export async function createWorkflowSecretReference(input: CreateWorkflowSecretReferenceInput): Promise<WorkflowSecretReferenceRecord> {
  const parsed = createWorkflowSecretReferenceInputSchema.parse(input);
  const existing = await prisma().workflowSecretReference.findFirst({ where: { name: parsed.name } });
  if (existing) {
    throw Object.assign(new Error(`A secret reference named "${parsed.name}" already exists.`), { workflowTransportBadRequest: true });
  }
  const row = await prisma().workflowSecretReference.create({
    data: {
      name: parsed.name,
      label: parsed.label,
      description: parsed.description ?? null,
      encryptedValueJson: parsed.value ? JSON.stringify(encryptWorkflowCredentialValue(parsed.value)) : null,
      createdBy: parsed.createdBy != null ? toId(parsed.createdBy) : null,
    },
  });
  return mapRecord(row);
}

export async function updateWorkflowSecretReference(id: number, input: UpdateWorkflowSecretReferenceInput): Promise<WorkflowSecretReferenceRecord> {
  const parsed = updateWorkflowSecretReferenceInputSchema.parse(input);
  // `value` has three states the plain z.infer optional/nullable shape can't distinguish from
  // "omitted" alone — check the raw input for real key presence so "leave untouched" (key absent)
  // never collides with "clear it" (key present, explicit null).
  const valueProvided = Object.prototype.hasOwnProperty.call(input, 'value');
  const row = await prisma().workflowSecretReference.update({
    where: { id: toId(id) },
    data: {
      label: parsed.label,
      description: parsed.description ?? null,
      ...(valueProvided
        ? { encryptedValueJson: parsed.value ? JSON.stringify(encryptWorkflowCredentialValue(parsed.value)) : null }
        : {}),
      updatedBy: parsed.updatedBy != null ? toId(parsed.updatedBy) : null,
      updatedAt: new Date(),
    },
  });
  return mapRecord(row);
}

export async function deleteWorkflowSecretReference(id: number): Promise<void> {
  await prisma().workflowSecretReference.delete({ where: { id: toId(id) } });
}

/**
 * p-99/WFT-3 — prefers a stored encrypted value; falls back to `process.env[name]`
 * (Option 1's original behavior) when no value is stored. Leftover pre-vault blobs
 * throw a loud migrate-script error instead of falling through to env. Returns `null`
 * when nothing resolves either way — the caller (`secretResolution.ts`) turns that
 * into a domain error.
 */
export async function resolveWorkflowCredentialValue(name: string): Promise<string | null> {
  const row = await prisma().workflowSecretReference.findFirst({ where: { name } });
  if (row?.encryptedValueJson) {
    let blob: unknown;
    try {
      blob = JSON.parse(row.encryptedValueJson);
    } catch {
      blob = undefined;
    }
    if (isLegacyWorkflowCredentialBlob(blob)) {
      throw new Error(LEGACY_WORKFLOW_SECRET_BLOB_ERROR);
    }
    if (isWorkflowCredentialEncryptedBlob(blob)) {
      return decryptWorkflowCredentialValue(blob);
    }
  }
  const envValue = String(process.env[name] ?? '').trim();
  return envValue.length > 0 ? envValue : null;
}

/**
 * Re-encrypts stale Prisma `encryptedValueJson` blobs with the current
 * master-key version. Operator-only; not wired to boot. Does not add a Prisma model.
 */
export async function rotateWorkflowSecretBlobs(): Promise<{ migrated: number; failed: string[] }> {
  const currentVersion = resolveCredentialKeyVersion();
  const rows = await prisma().workflowSecretReference.findMany({
    select: { id: true, name: true, encryptedValueJson: true },
  });

  type StaleRow = { id: bigint; name: string; blob: ReturnType<typeof encryptWorkflowCredentialValue> };
  const stale: StaleRow[] = [];
  const failed: string[] = [];

  for (const row of rows) {
    if (!row.encryptedValueJson) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.encryptedValueJson);
    } catch {
      failed.push(`${row.name}: encryptedValueJson is not valid JSON.`);
      continue;
    }
    if (isLegacyWorkflowCredentialBlob(parsed)) {
      failed.push(`${row.name}: ${LEGACY_WORKFLOW_SECRET_BLOB_ERROR}`);
      continue;
    }
    if (isWorkflowCredentialEncryptedBlob(parsed) && parsed.keyVersion !== currentVersion) {
      stale.push({ id: row.id, name: row.name, blob: parsed });
    }
  }

  if (stale.length > 0 && !resolveCredentialPreviousKey() && stale.some((row) => row.blob.keyVersion === currentVersion - 1)) {
    throw new Error(
      'APPENDO_CREDENTIAL_MASTER_KEY_PREVIOUS is required before rotating secrets that still use the previous key version.',
    );
  }

  let migrated = 0;
  const now = new Date();
  for (const row of stale) {
    try {
      const plaintext = decryptWorkflowCredentialValue(row.blob);
      const next = encryptWorkflowCredentialValue(plaintext);
      await prisma().workflowSecretReference.update({
        where: { id: row.id },
        data: { encryptedValueJson: JSON.stringify(next), updatedAt: now },
      });
      migrated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push(`${row.name}: ${message}`);
    }
  }

  return { migrated, failed };
}
