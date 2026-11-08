import { canonicalJsonFingerprint } from '../canonicalJson';
import { WorkflowDomainError } from '../errors';
import type { RetryPolicy } from '../awm/types';

/** Doc 04 section 9 — the sole registered logical-invocation key policy identifier. */
export const LOGICAL_INVOCATION_KEY_POLICY = 'workflow.logical-invocation-key/v1' as const;

export type LogicalInvocationKeyInput = {
  workflowInstanceId: string;
  nodeInstanceId: string;
  logicalInvocationId: string;
};

/**
 * The canonical idempotency key input is the UTF-8 canonical semantic JSON object
 * `{ policy, workflowInstanceId, nodeInstanceId, logicalInvocationId }`, hashed with the shared
 * canonical JSON utility (doc 03 section 20). Provider-specific prefixes/wrapping may be applied
 * only outside this persisted canonical key and may not change logical grouping.
 */
export function computeLogicalInvocationKey(input: LogicalInvocationKeyInput): string {
  return canonicalJsonFingerprint({
    policy: LOGICAL_INVOCATION_KEY_POLICY,
    workflowInstanceId: input.workflowInstanceId,
    nodeInstanceId: input.nodeInstanceId,
    logicalInvocationId: input.logicalInvocationId,
  });
}

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/** Doc 05 section 27 — 1-based attempt delay formula. Delay before attempt `n+1` given attempt `n` just failed. */
export function computeRetryDelayMs(policy: RetryPolicy, failedAttemptNumber: number): number {
  if (failedAttemptNumber < 1) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'failedAttemptNumber must be >= 1.', { failedAttemptNumber });
  }
  if (policy.strategy === 'FIXED') {
    return policy.initialDelayMs;
  }
  const multiplier = policy.multiplier ?? 1;
  if (!Number.isFinite(multiplier) || multiplier < 1) {
    throw new WorkflowDomainError('WF_DEF_INVALID_RETRY_POLICY', 'EXPONENTIAL retry requires a finite multiplier >= 1.', { multiplier });
  }
  const raw = policy.initialDelayMs * multiplier ** (failedAttemptNumber - 1);
  const ceiling = policy.maxDelayMs ?? MAX_SAFE;
  const bounded = Math.min(ceiling, raw);
  const floored = Math.floor(bounded);
  if (!Number.isFinite(floored) || !Number.isSafeInteger(floored)) {
    throw new WorkflowDomainError('WF_DEF_INVALID_RETRY_POLICY', 'Computed retry delay is not a finite safe integer.', { failedAttemptNumber, raw });
  }
  return floored;
}

/**
 * Doc 04 section 9: `actionTimeoutMs * maxAttempts + sum(all retry delays before attempts
 * 2..maxAttempts) + recoveryDetectionBoundMs`, checked safe-integer arithmetic throughout.
 * Persisted once at publication; recovery never recomputes it (doc 05 section 27).
 */
export function computeMaximumLogicalInvocationWindowMs(input: { actionTimeoutMs: number; retryPolicy: RetryPolicy; recoveryDetectionBoundMs: number }): number {
  const { actionTimeoutMs, retryPolicy, recoveryDetectionBoundMs } = input;
  const assertSafe = (value: number, label: string): number => {
    if (!Number.isFinite(value) || !Number.isSafeInteger(Math.trunc(value)) || value > MAX_SAFE) {
      throw new WorkflowDomainError('WF_DEF_INVALID_RETRY_POLICY', `${label} overflowed safe-integer arithmetic while computing maximumLogicalInvocationWindowMs.`, { value });
    }
    return value;
  };

  let total = assertSafe(actionTimeoutMs * retryPolicy.maxAttempts, 'actionTimeoutMs * maxAttempts');
  for (let failedAttempt = 1; failedAttempt < retryPolicy.maxAttempts; failedAttempt += 1) {
    const delay = computeRetryDelayMs(retryPolicy, failedAttempt);
    total = assertSafe(total + delay, 'cumulative retry delay');
  }
  total = assertSafe(total + recoveryDetectionBoundMs, 'total + recoveryDetectionBoundMs');
  return total;
}
