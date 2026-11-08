import type { Request } from 'express';
import { hasAdminRole } from './auth.middleware';
import { getActiveImpersonationGrant } from '../services/dev-toolbar/impersonationGrantStore';

export const IMPERSONATE_GRANT_HEADER = 'x-impersonate-grant';

/**
 * PDK-7 — if the caller is the REAL authenticated ADMIN and supplies a valid, unexpired grant
 * they created, temporarily swap `req.auth` to the impersonated actor for the rest of this
 * request only — never touches the real session/cookie/JWT. Record Policy scope-hashing and the
 * Data API response cache key (`dataApiRuntimePolicy.ts`) both read `req.auth`/`hasAdminRole(req)`
 * directly, so swapping here — before `prepareDataApiRuntime` runs — makes both automatically
 * actor-correct with no separate cache-bypass logic needed.
 *
 * Silently no-ops on any invalid/missing/expired/foreign grant, or if the real caller is not
 * ADMIN — falls back to the real actor. Never escalates: the caller was already ADMIN to reach
 * this at all, and a grant can only be redeemed by the exact admin who created it.
 */
export const applyImpersonationForRequest = (req: Request): void => {
  const header = req.headers[IMPERSONATE_GRANT_HEADER];
  const grantId = typeof header === 'string' ? header.trim() : '';
  if (!grantId) {
    return;
  }

  const realAuth = req.auth;
  if (!realAuth || !hasAdminRole(req)) {
    return;
  }

  const grant = getActiveImpersonationGrant(grantId, realAuth.userId);
  if (!grant) {
    return;
  }

  req.impersonatorId = realAuth.userId;
  req.auth = {
    userId: grant.targetUserId ?? realAuth.userId,
    email: grant.targetEmail ?? realAuth.email,
    role: grant.targetRoles[0] ?? realAuth.role,
    roles: grant.targetRoles.length > 0 ? grant.targetRoles : realAuth.roles,
  };
};
