import { randomUUID } from 'node:crypto';
import { prisma, toId, fromId, toIsoString } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkflowEventInboxStatus, type WorkflowEventInboxCommand, type WorkflowEventInboxStatus } from './transitions';
import type { WorkflowEventInboxRecord } from './types';

/** Sentinel prefix for rows with no caller-supplied dedup key (Slice 1 plan D6) — kept out of the public record shape. */
const NO_DEDUP_SENTINEL_PREFIX = '__no_dedup__:';

const isSentinelDeduplicationKey = (key: string): boolean => key.startsWith(NO_DEDUP_SENTINEL_PREFIX);

const mapWorkflowEventInboxRecord = (row: {
  id: bigint;
  eventName: string;
  providerEventId: string | null;
  eventSourceIdentity: string;
  correlationEncoderVersion: string | null;
  correlationHashAlgorithm: string | null;
  correlationValueHash: string | null;
  payloadJson: string | null;
  source: string | null;
  receivedAt: Date | null;
  processedAt: Date | null;
  status: string;
  deduplicationKey: string;
  recheckUntil: Date | null;
  leaseOwnerId: string | null;
  leaseExpiresAt: Date | null;
  stateVersion: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}): WorkflowEventInboxRecord => ({
  id: fromId(row.id),
  eventName: row.eventName,
  providerEventId: row.providerEventId,
  eventSourceIdentity: row.eventSourceIdentity,
  correlationEncoderVersion: row.correlationEncoderVersion,
  correlationHashAlgorithm: row.correlationHashAlgorithm,
  correlationValueHash: row.correlationValueHash,
  payloadJson: row.payloadJson,
  source: row.source,
  receivedAt: toIsoString(row.receivedAt),
  processedAt: toIsoString(row.processedAt),
  status: row.status as WorkflowEventInboxStatus,
  deduplicationKey: isSentinelDeduplicationKey(row.deduplicationKey) ? null : row.deduplicationKey,
  recheckUntil: toIsoString(row.recheckUntil),
  leaseOwnerId: row.leaseOwnerId,
  leaseExpiresAt: toIsoString(row.leaseExpiresAt),
  stateVersion: row.stateVersion,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

export type InsertOrReturnExistingInboxInput = {
  eventName: string;
  providerEventId?: string;
  eventSourceIdentity: string;
  correlationEncoderVersion?: string;
  correlationHashAlgorithm?: string;
  correlationValueHash?: string;
  payloadJson?: string;
  source?: string;
  deduplicationKey?: string;
  recheckUntilMs?: number;
};

const DEFAULT_RECHECK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Insert-or-return-existing dedup semantics (doc 03 section 27). A nullable caller
 * `deduplicationKey` is stored NOT NULL via a generated unique sentinel when absent (Slice 1 plan
 * D6) so `@@unique([eventSourceIdentity, deduplicationKey])` stays portable across every provider,
 * including SQL Server (which treats unique-index NULLs as equal, unlike Postgres/MySQL/SQLite).
 */
export async function insertOrReturnExistingInbox(
  input: InsertOrReturnExistingInboxInput,
): Promise<{ record: WorkflowEventInboxRecord; wasCreated: boolean }> {
  const deduplicationKey = input.deduplicationKey ?? `${NO_DEDUP_SENTINEL_PREFIX}${randomUUID()}`;
  const receivedAt = new Date();
  try {
    const row = await prisma().workflowEventInbox.create({
      data: {
        eventName: input.eventName,
        providerEventId: input.providerEventId ?? null,
        eventSourceIdentity: input.eventSourceIdentity,
        correlationEncoderVersion: input.correlationEncoderVersion ?? null,
        correlationHashAlgorithm: input.correlationHashAlgorithm ?? null,
        correlationValueHash: input.correlationValueHash ?? null,
        payloadJson: input.payloadJson ?? null,
        source: input.source ?? null,
        receivedAt,
        status: 'RECEIVED',
        deduplicationKey,
        recheckUntil: new Date(receivedAt.getTime() + (input.recheckUntilMs ?? DEFAULT_RECHECK_WINDOW_MS)),
      },
    });
    return { record: mapWorkflowEventInboxRecord(row), wasCreated: true };
  } catch (error) {
    // Unique-constraint violation on (eventSourceIdentity, deduplicationKey) — return the existing row.
    if (input.deduplicationKey) {
      const existing = await prisma().workflowEventInbox.findUnique({
        where: { eventSourceIdentity_deduplicationKey: { eventSourceIdentity: input.eventSourceIdentity, deduplicationKey } },
      });
      if (existing) {
        return { record: mapWorkflowEventInboxRecord(existing), wasCreated: false };
      }
    }
    throw error;
  }
}

export async function getInboxById(id: number): Promise<WorkflowEventInboxRecord | undefined> {
  const row = await prisma().workflowEventInbox.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkflowEventInboxRecord(row) : undefined;
}

/** Bounded-recheck sweep source query (doc 03 section 23) — every `UNMATCHED` row still within its `recheckUntil` bound and not currently claimed. */
export async function listRecheckEligibleUnmatchedInbox(now: Date): Promise<WorkflowEventInboxRecord[]> {
  const rows = await prisma().workflowEventInbox.findMany({
    where: { status: 'UNMATCHED', recheckUntil: { gt: now }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapWorkflowEventInboxRecord);
}

/**
 * Releases a correlation-attempt lease without a status transition — used when a claimed row was
 * already `UNMATCHED` (a recheck-sweep attempt that again found no match) and stays `UNMATCHED`, so
 * no row in `transitions.ts`'s `EVENT_INBOX_ROWS` applies (that table only has `UNMATCHED →
 * CORRELATED`, no `UNMATCHED → UNMATCHED`). Unlike `transitionInboxStatus`, this never changes status.
 */
export async function releaseInboxCorrelationClaim(id: number, expectedStateVersion: number): Promise<WorkflowEventInboxRecord> {
  const result = await prisma().workflowEventInbox.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    data: { leaseOwnerId: null, leaseExpiresAt: null, stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox stateVersion is stale for claim release.', { id, expectedStateVersion });
  }
  return (await getInboxById(id))!;
}

/** Claims a RECEIVED or non-final UNMATCHED row for correlation/recheck — expected-version lease mutation, no semantic status change. */
export async function claimForCorrelation(
  id: number,
  expectedStateVersion: number,
  leaseOwnerId: string,
  leaseDurationMs: number,
): Promise<WorkflowEventInboxRecord> {
  const existing = await getInboxById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox not found.', { id });
  }
  const now = new Date();
  const isClaimable =
    existing.status === 'RECEIVED' ||
    (existing.status === 'UNMATCHED' && existing.recheckUntil !== null && new Date(existing.recheckUntil) > now);
  if (!isClaimable) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox is not claimable (terminal or final-unmatched).', { id });
  }
  const result = await prisma().workflowEventInbox.updateMany({
    where: {
      id: toId(id),
      stateVersion: expectedStateVersion,
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
    },
    data: { leaseOwnerId, leaseExpiresAt: new Date(now.getTime() + leaseDurationMs), stateVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox claim precondition failed (version/lease race).', { id });
  }
  return (await getInboxById(id))!;
}

/** CAS status transition — guard from transitions.ts. `null` fromStatus models ingress-time creation and is not reachable here (handled by `insertOrReturnExistingInbox`). */
export async function transitionInboxStatus(
  id: number,
  expectedStateVersion: number,
  command: Exclude<WorkflowEventInboxCommand, 'ACCEPT_INGRESS' | 'INGRESS_REJECTED'>,
): Promise<WorkflowEventInboxRecord> {
  const existing = await getInboxById(id);
  if (!existing) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox not found.', { id });
  }
  const nextStatus = nextWorkflowEventInboxStatus(existing.status, command);
  if (!nextStatus) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Illegal inbox command ${command} from ${existing.status}.`, { id, command });
  }
  const result = await prisma().workflowEventInbox.updateMany({
    where: { id: toId(id), stateVersion: expectedStateVersion },
    // Releases the claim on every transition (doc 03 section 27: recheck-exhausted explicitly
    // releases the claim while remaining eligible; terminal transitions make the lease moot).
    data: { status: nextStatus, processedAt: new Date(), stateVersion: { increment: 1 }, leaseOwnerId: null, leaseExpiresAt: null },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox stateVersion is stale.', { id, expectedStateVersion });
  }
  return (await getInboxById(id))!;
}
