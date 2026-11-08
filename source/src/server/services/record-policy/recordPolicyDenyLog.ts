import { logger } from '../../../core/logging/Logger';

export type RecordPolicyDenyLogInput = {
  reason: 'deny_all' | 'out_of_scope' | 'unauthenticated';
  edgeModelId: string;
  action: string;
  userId?: number | null;
  scopeHash?: string | null;
};

/** Optional security observability for fail-closed / out-of-scope denials (RPE-10-3). */
export const logRecordPolicyDeny = (input: RecordPolicyDenyLogInput): void => {
  logger.warn('RecordPolicy', 'Record access denied by policy', {
    reason: input.reason,
    edgeModelId: input.edgeModelId,
    action: input.action,
    userId: input.userId ?? null,
    scopeHash: input.scopeHash ?? null,
  });
};
