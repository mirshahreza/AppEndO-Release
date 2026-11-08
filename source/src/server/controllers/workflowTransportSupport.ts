import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { getAccessTokenSecret } from '../constants/auth';
import { isWorkflowDomainError } from '../domain/workflow/errors';

/**
 * Shared transport plumbing for every Workflow HTTP controller (Designer, Runtime, Work Items,
 * Publication, Proof). Doc 10 section 7 — external error envelope — and doc 02 section 13 — "a
 * handler may translate transport errors to canonical AppEndO envelopes but machine code and
 * expected-version semantics are preserved" — are both satisfied by `handleWorkflowError` alone;
 * every controller in this package MUST reuse this one function rather than re-deriving its own
 * status-code/body mapping (doc 03 section 14/30 exactness only holds if there is exactly one
 * translation site).
 *
 * Repository Reality Audit (doc 10 section 9, Slice 12): the platform's own baseline is an informal
 * `{ success: boolean, error?: string }` convention with no shared machine-code field
 * (`src/server/errors/HttpError.ts` + `src/server/utils/controllerHttp.ts`'s `sendHttpError`) — this
 * envelope is a strict superset of that baseline (`success/code/error/details`), so it stays
 * compatible with the rest of the platform while actually satisfying doc 10 section 7's "carries
 * exactly the canonical machine code... never exposes stack traces" requirement, which the
 * platform-wide baseline does not itself enforce.
 */

const STALE_VERSION_CODES = new Set(['WF_DEF_STALE_DRAFT_VERSION', 'WF_DEF_STALE_REVISION_VERSION', 'WF_EXEC_STALE_STATE_VERSION']);
const FORBIDDEN_CODES = new Set(['WF_AUTH_FORBIDDEN']);
const NOT_FOUND_MESSAGE_MARKERS = ['not found'];

function statusForWorkflowCode(code: string, message: string): number {
  if (STALE_VERSION_CODES.has(code)) return 409;
  if (FORBIDDEN_CODES.has(code)) return 403;
  if (NOT_FOUND_MESSAGE_MARKERS.some((marker) => message.toLowerCase().includes(marker))) return 404;
  return 400;
}

export const handleWorkflowError = (error: unknown, _req: Request, res: Response): boolean => {
  if (isWorkflowDomainError(error)) {
    res.status(statusForWorkflowCode(error.code, error.message)).json({ success: false, code: error.code, error: error.message, details: error.details ?? null });
    return true;
  }
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  res.status(500).json({ success: false, code: 'WF_EXEC_ENGINE_INVARIANT', error: message });
  return true;
};

export const actorFromRequest = (req: Request): { type: 'USER'; id: number | null } => ({ type: 'USER', id: req.auth?.userId ?? null });

/**
 * Doc 10 section 3 — cursor-based pagination for every list surface exposed by this package.
 * Repository Reality Audit found no canonical opaque-cursor primitive anywhere in the platform
 * (list endpoints elsewhere use plain `take`/offset), so this is new, narrowly-scoped Workflow
 * transport code, not a duplicated platform primitive — it never touches storage/query shape,
 * only slices an already-deterministically-ordered in-memory array the same way
 * `workItemInboxService.ts` already filters in application code. The cursor is HMAC-signed with
 * the platform's existing access-token secret (`getAccessTokenSecret`) so it is tamper-evident and
 * non-guessable without inventing a second secret/config primitive.
 */
export type CursorPage<T> = { items: T[]; nextCursor: string | null };

const CURSOR_SECRET = () => getAccessTokenSecret();

export function encodeCursor(position: number): string {
  const payload = String(position);
  const sig = createHmac('sha256', CURSOR_SECRET()).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${sig}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): number | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [payload, sig] = raw.split('.');
    if (!payload || !sig) return null;
    const expectedSig = createHmac('sha256', CURSOR_SECRET()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const position = Number(payload);
    return Number.isInteger(position) && position >= 0 ? position : null;
  } catch {
    return null;
  }
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** Rejects (does not silently truncate) a page-size request above the ceiling — doc 10 section 3. */
export function resolvePageSize(raw: unknown): number {
  if (raw === undefined) return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error(`Invalid pageSize "${String(raw)}".`), { workflowTransportBadRequest: true });
  }
  if (n > MAX_PAGE_SIZE) {
    throw Object.assign(new Error(`pageSize ${n} exceeds the maximum of ${MAX_PAGE_SIZE}.`), { workflowTransportBadRequest: true });
  }
  return n;
}

/** Slices a stably-ordered array by an opaque position cursor. A cursor issued against one ordering is invalid against another only because callers must always pass the same deterministic ordering they paginated from — not enforced here since ordering identity is the caller's responsibility (doc 07 section 10 / repository `orderBy`). */
export function paginateArray<T>(items: readonly T[], cursorParam: unknown, pageSize: number): CursorPage<T> {
  let start = 0;
  if (typeof cursorParam === 'string' && cursorParam.length > 0) {
    const decoded = decodeCursor(cursorParam);
    if (decoded === null) {
      throw Object.assign(new Error('Invalid or tampered pagination cursor.'), { workflowTransportBadRequest: true });
    }
    start = decoded;
  }
  const page = items.slice(start, start + pageSize);
  const end = start + page.length;
  const nextCursor = end < items.length ? encodeCursor(end) : null;
  return { items: page, nextCursor };
}

/**
 * Adapter so `paginateArray`'s thrown plain Error (malformed cursor/pageSize) still renders through
 * one error-handling site. This is deliberately NOT stamped with a `WorkflowDomainError` machine
 * code — none of the 33 registered doc 03 section 14/30 codes describes "malformed pagination
 * input" and the registry is closed/exhaustive (`errors.test.ts` asserts exactly 33 entries), so
 * inventing a 34th code here would violate that invariant. A transport-level `success:false` body
 * with no `code` field is honest about that rather than misusing an unrelated canonical code.
 */
export const handleTransportError = (error: unknown, req: Request, res: Response): boolean => {
  if (error && typeof error === 'object' && (error as { workflowTransportBadRequest?: boolean }).workflowTransportBadRequest) {
    res.status(400).json({ success: false, error: (error as Error).message });
    return true;
  }
  return handleWorkflowError(error, req, res);
};
