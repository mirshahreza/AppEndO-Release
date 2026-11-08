import crypto from 'node:crypto';

export type ImpersonationGrant = {
  id: string;
  impersonatorId: number;
  impersonatorEmail: string | null;
  targetUserId: number | null;
  targetEmail: string | null;
  targetRoles: string[];
  createdAt: number;
  expiresAt: number;
};

const DEFAULT_DURATION_MS = 15 * 60 * 1000;
/** Client-requested duration per PDK-7, but capped server-side — the client value is a request, not a grant. */
const MAX_DURATION_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60_000;

const grants = new Map<string, ImpersonationGrant>();

const sweepExpiredGrants = (): void => {
  const now = Date.now();
  for (const [id, grant] of grants) {
    if (grant.expiresAt <= now) {
      grants.delete(id);
    }
  }
};

const sweepTimer = setInterval(sweepExpiredGrants, SWEEP_INTERVAL_MS);
sweepTimer.unref?.();

export const createImpersonationGrant = (input: {
  impersonatorId: number;
  impersonatorEmail: string | null;
  targetUserId?: number | null;
  targetEmail?: string | null;
  targetRoles: string[];
  durationMinutes?: number;
}): ImpersonationGrant => {
  const requestedMs = Number(input.durationMinutes) > 0
    ? Number(input.durationMinutes) * 60_000
    : DEFAULT_DURATION_MS;
  const durationMs = Math.min(Math.max(requestedMs, 60_000), MAX_DURATION_MS);
  const now = Date.now();

  const grant: ImpersonationGrant = {
    id: crypto.randomUUID(),
    impersonatorId: input.impersonatorId,
    impersonatorEmail: input.impersonatorEmail,
    targetUserId: input.targetUserId ?? null,
    targetEmail: input.targetEmail ?? null,
    targetRoles: input.targetRoles.map((role) => role.trim().toUpperCase()).filter(Boolean),
    createdAt: now,
    expiresAt: now + durationMs,
  };
  grants.set(grant.id, grant);
  return grant;
};

/** Only the admin who created a grant may use it — grant ids are not transferable between sessions. */
export const getActiveImpersonationGrant = (
  grantId: string,
  requestingUserId: number,
): ImpersonationGrant | null => {
  const grant = grants.get(grantId);
  if (!grant) {
    return null;
  }
  if (grant.expiresAt <= Date.now()) {
    grants.delete(grantId);
    return null;
  }
  if (grant.impersonatorId !== requestingUserId) {
    return null;
  }
  return grant;
};

export const endImpersonationGrant = (grantId: string, requestingUserId: number): ImpersonationGrant | null => {
  const grant = grants.get(grantId);
  if (!grant || grant.impersonatorId !== requestingUserId) {
    return null;
  }
  grants.delete(grantId);
  return grant;
};

export const resetImpersonationGrantsForTests = (): void => {
  grants.clear();
};
