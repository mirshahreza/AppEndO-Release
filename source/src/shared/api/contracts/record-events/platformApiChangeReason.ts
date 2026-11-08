import {
  RECORD_CHANGE_REASON_SAMPLE_MOCK,
  RECORD_CHANGE_REASON_USERS_LIFECYCLE,
  RECORD_CHANGE_REASON_USERS_LOCK,
  RECORD_CHANGE_REASON_USERS_ROLES,
} from './changeReasonVocab';

const optionalBoth = (reasonVocabNodeId?: string) => ({
  reasonAsk: 'optional' as const,
  reasonCapture: 'both' as const,
  ...(reasonVocabNodeId ? { reasonVocabNodeId } : {}),
});

/** Express Users profile / account PATCH — Confirm on that API save, not per field. */
export const USERS_PROFILE_CHANGE_REASON = optionalBoth(RECORD_CHANGE_REASON_USERS_LIFECYCLE);

/** Express Users lock / unlock. */
export const USERS_LOCK_CHANGE_REASON = optionalBoth(RECORD_CHANGE_REASON_USERS_LOCK);

/** Express Users roles assign/remove. */
export const USERS_ROLES_CHANGE_REASON = optionalBoth(RECORD_CHANGE_REASON_USERS_ROLES);

/** Org/geo membership — optional so inspectors keep working without a Confirm. */
export const USERS_SCOPE_CHANGE_REASON = optionalBoth();

/** Role catalog rename — optional until that UI gets a Confirm. */
export const ROLE_CATALOG_CHANGE_REASON = optionalBoth();

/** Sample-mock CRUD Set writes (content / lock / approve / delete share one folder). */
export const SAMPLE_MOCK_CHANGE_REASON = optionalBoth(RECORD_CHANGE_REASON_SAMPLE_MOCK);

const catalogRouteKey = (method: string, path: string): string => {
  const withoutQuery = path.split('?')[0]?.trim() || '/';
  const normalized = withoutQuery.length > 1 && withoutQuery.endsWith('/')
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
  return `${method.toUpperCase()} ${normalized}`;
};

type FunctionChangeReasonFallback = typeof USERS_PROFILE_CHANGE_REASON;

const FUNCTION_CHANGE_REASON_FALLBACKS: Record<string, FunctionChangeReasonFallback> = {
  'PUT /api/users/:id': USERS_PROFILE_CHANGE_REASON,
  'PUT /api/users/:id/profile': USERS_PROFILE_CHANGE_REASON,
  'PUT /api/profile': USERS_PROFILE_CHANGE_REASON,
  'PUT /api/profile/me': USERS_PROFILE_CHANGE_REASON,
  'PUT /api/profile/me/editable-fields': USERS_PROFILE_CHANGE_REASON,
  'DELETE /api/users/:id': USERS_PROFILE_CHANGE_REASON,
  'PATCH /api/users/:id/lock': USERS_LOCK_CHANGE_REASON,
  'PATCH /api/users/:id/unlock': USERS_LOCK_CHANGE_REASON,
  'PATCH /api/users/:id/locked': USERS_LOCK_CHANGE_REASON,
  'PUT /api/users/:id/roles': USERS_ROLES_CHANGE_REASON,
  'PATCH /api/sample-mock/records/:id': SAMPLE_MOCK_CHANGE_REASON,
  'PATCH /api/sample-mock/records/:id/approve': SAMPLE_MOCK_CHANGE_REASON,
  'PATCH /api/sample-mock/records/:id/lock': SAMPLE_MOCK_CHANGE_REASON,
  'DELETE /api/sample-mock/records/:id': SAMPLE_MOCK_CHANGE_REASON,
};

const CHANGE_REASON_SETTINGS_DENY = /\/(reset-password|change-password|login|logout|refresh|execute)(\/|$)/i;

/** Reason Ask/folder settings apply to mutations of existing records that emit history — never GET/list, create, or auth/password. */
export const namedApiAllowsChangeReasonSettings = (method: string, path: string): boolean => {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || m === 'POST') return false;
  if (CHANGE_REASON_SETTINGS_DENY.test(path)) return false;
  return m === 'PUT' || m === 'PATCH' || m === 'DELETE';
};

export const dataApiOperationAllowsChangeReason = (kind: string): boolean => (
  kind === 'update' || kind === 'patch' || kind === 'delete'
);

/** Catalog method+path fallback when the function has not stored its own `metadataJson.changeReason`. */
export const functionChangeReasonFallback = (
  method: string,
  path: string,
): FunctionChangeReasonFallback | undefined => FUNCTION_CHANGE_REASON_FALLBACKS[catalogRouteKey(method, path)];
