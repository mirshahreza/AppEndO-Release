import { randomBytes, createHash } from 'crypto';
import { prisma, toId, fromId } from '../../domain/workflow/prismaHelpers';

/**
 * p-68 WHOOK — one active webhook secret per workflow definition. Follows the hashing pattern
 * already used by `mcpInboundAuth.ts` (sha256, never store the raw secret), but looks the caller up
 * by an indexed hash column rather than comparing against one in-memory secret, since there are
 * many possible tokens (one per workflow) rather than a single configured key.
 */

export type WorkflowWebhookBindingRecord = {
  workflowDefinitionId: number;
  workflowRevisionId: number;
  enabled: boolean;
  rotatedAt: string | null;
  createdAt: string;
};

const mapBinding = (row: {
  workflowDefinitionId: bigint;
  workflowRevisionId: bigint;
  enabled: boolean;
  rotatedAt: Date | null;
  createdAt: Date;
}): WorkflowWebhookBindingRecord => ({
  workflowDefinitionId: fromId(row.workflowDefinitionId),
  workflowRevisionId: fromId(row.workflowRevisionId),
  enabled: row.enabled,
  rotatedAt: row.rotatedAt ? row.rotatedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
});

export const generateSecret = (): string => randomBytes(32).toString('base64url');

export const hashSecret = (rawSecret: string): string => createHash('sha256').update(rawSecret).digest('hex');

/** Finds the active binding for a raw secret (already URL-decoded), if any. Used by the public webhook route. */
export async function findWorkflowByWebhookSecret(rawSecret: string): Promise<WorkflowWebhookBindingRecord | undefined> {
  const row = await prisma().workflowWebhookBinding.findFirst({
    where: { secretHash: hashSecret(rawSecret), enabled: true },
  });
  return row ? mapBinding(row) : undefined;
}

export async function getWebhookBindingForDefinition(workflowDefinitionId: number): Promise<WorkflowWebhookBindingRecord | undefined> {
  const row = await prisma().workflowWebhookBinding.findUnique({ where: { workflowDefinitionId: toId(workflowDefinitionId) } });
  return row ? mapBinding(row) : undefined;
}

/**
 * Generates a fresh secret and upserts the binding row, pointing it at `workflowRevisionId` and
 * enabling it. Always rotates — any existing secret stops matching immediately. Returns the raw
 * secret; callers must show it to the admin exactly once (only the hash is persisted).
 */
export async function rotateWebhookSecret(workflowDefinitionId: number, workflowRevisionId: number, createdBy?: number | null): Promise<string> {
  const rawSecret = generateSecret();
  const secretHash = hashSecret(rawSecret);
  const now = new Date();

  await prisma().workflowWebhookBinding.upsert({
    where: { workflowDefinitionId: toId(workflowDefinitionId) },
    create: {
      workflowDefinitionId: toId(workflowDefinitionId),
      workflowRevisionId: toId(workflowRevisionId),
      secretHash,
      enabled: true,
      createdBy: createdBy != null ? toId(createdBy) : null,
    },
    update: {
      workflowRevisionId: toId(workflowRevisionId),
      secretHash,
      enabled: true,
      rotatedAt: now,
    },
  });

  return rawSecret;
}

/**
 * Idempotently re-points an EXISTING binding row at `workflowRevisionId` and re-enables it —
 * never rotates the secret, never creates a row. Used by activate()/reconcile() on (re)publish.
 * Deliberately a no-op when no binding row exists yet: the admin hasn't clicked "Generate" for
 * this workflow, so there is nothing to activate — a webhook secret is only ever born from the
 * explicit `rotateWebhookSecret` admin action, never silently as a side effect of publishing
 * (auto-generating here would produce a secret nobody could ever see, since only the hash is
 * persisted — the raw value is returned exactly once, at generation time).
 */
export async function reactivateWebhookBindingIfConfigured(workflowDefinitionId: number, workflowRevisionId: number): Promise<void> {
  const existing = await getWebhookBindingForDefinition(workflowDefinitionId);
  if (!existing) return;
  await prisma().workflowWebhookBinding.update({
    where: { workflowDefinitionId: toId(workflowDefinitionId) },
    data: { workflowRevisionId: toId(workflowRevisionId), enabled: true },
  });
}

export async function disableWebhookBinding(workflowDefinitionId: number): Promise<void> {
  const existing = await getWebhookBindingForDefinition(workflowDefinitionId);
  if (!existing) return;
  await prisma().workflowWebhookBinding.update({
    where: { workflowDefinitionId: toId(workflowDefinitionId) },
    data: { enabled: false },
  });
}
