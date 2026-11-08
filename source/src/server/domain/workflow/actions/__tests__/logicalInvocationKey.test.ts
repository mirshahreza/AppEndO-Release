import { describe, expect, it } from 'vitest';
import { computeLogicalInvocationKey, computeRetryDelayMs, computeMaximumLogicalInvocationWindowMs, LOGICAL_INVOCATION_KEY_POLICY } from '../logicalInvocationKey';
import type { RetryPolicy } from '../../awm/types';

describe('computeLogicalInvocationKey (doc 04 section 9)', () => {
  it('is deterministic for identical inputs', () => {
    const input = { workflowInstanceId: 'i1', nodeInstanceId: 'n1', logicalInvocationId: 'l1' };
    expect(computeLogicalInvocationKey(input)).toBe(computeLogicalInvocationKey(input));
  });

  it('changes when any input field changes', () => {
    const base = computeLogicalInvocationKey({ workflowInstanceId: 'i1', nodeInstanceId: 'n1', logicalInvocationId: 'l1' });
    expect(computeLogicalInvocationKey({ workflowInstanceId: 'i2', nodeInstanceId: 'n1', logicalInvocationId: 'l1' })).not.toBe(base);
    expect(computeLogicalInvocationKey({ workflowInstanceId: 'i1', nodeInstanceId: 'n2', logicalInvocationId: 'l1' })).not.toBe(base);
    expect(computeLogicalInvocationKey({ workflowInstanceId: 'i1', nodeInstanceId: 'n1', logicalInvocationId: 'l2' })).not.toBe(base);
  });

  it('is a lowercase 64-char hex SHA-256 digest', () => {
    const key = computeLogicalInvocationKey({ workflowInstanceId: 'i1', nodeInstanceId: 'n1', logicalInvocationId: 'l1' });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('registers exactly one policy identifier', () => {
    expect(LOGICAL_INVOCATION_KEY_POLICY).toBe('workflow.logical-invocation-key/v1');
  });
});

describe('computeRetryDelayMs (doc 05 section 27)', () => {
  it('FIXED strategy always returns initialDelayMs', () => {
    const policy: RetryPolicy = { maxAttempts: 5, strategy: 'FIXED', initialDelayMs: 1000, retryOn: [] };
    expect(computeRetryDelayMs(policy, 1)).toBe(1000);
    expect(computeRetryDelayMs(policy, 4)).toBe(1000);
  });

  it('EXPONENTIAL strategy computes initialDelayMs * multiplier^(n-1), floored', () => {
    const policy: RetryPolicy = { maxAttempts: 5, strategy: 'EXPONENTIAL', initialDelayMs: 100, multiplier: 2, retryOn: [] };
    expect(computeRetryDelayMs(policy, 1)).toBe(100);
    expect(computeRetryDelayMs(policy, 2)).toBe(200);
    expect(computeRetryDelayMs(policy, 3)).toBe(400);
  });

  it('EXPONENTIAL strategy clamps to maxDelayMs', () => {
    const policy: RetryPolicy = { maxAttempts: 10, strategy: 'EXPONENTIAL', initialDelayMs: 100, multiplier: 10, maxDelayMs: 500, retryOn: [] };
    expect(computeRetryDelayMs(policy, 3)).toBe(500);
  });

  it('rejects EXPONENTIAL with multiplier < 1', () => {
    const policy: RetryPolicy = { maxAttempts: 5, strategy: 'EXPONENTIAL', initialDelayMs: 100, multiplier: 0.5, retryOn: [] };
    expect(() => computeRetryDelayMs(policy, 1)).toThrow();
  });
});

describe('computeMaximumLogicalInvocationWindowMs (doc 04 section 9)', () => {
  it('matches the exact formula for a FIXED retry policy', () => {
    const retryPolicy: RetryPolicy = { maxAttempts: 3, strategy: 'FIXED', initialDelayMs: 1000, retryOn: [] };
    // actionTimeoutMs * maxAttempts + sum(delays before attempts 2..3) + recoveryDetectionBoundMs
    // = 5000*3 + (1000 + 1000) + 200 = 15000 + 2000 + 200 = 17200
    const result = computeMaximumLogicalInvocationWindowMs({ actionTimeoutMs: 5000, retryPolicy, recoveryDetectionBoundMs: 200 });
    expect(result).toBe(17200);
  });

  it('matches the exact formula for an EXPONENTIAL retry policy', () => {
    const retryPolicy: RetryPolicy = { maxAttempts: 3, strategy: 'EXPONENTIAL', initialDelayMs: 100, multiplier: 2, retryOn: [] };
    // delays before attempts 2,3 = 100, 200 -> sum 300
    const result = computeMaximumLogicalInvocationWindowMs({ actionTimeoutMs: 1000, retryPolicy, recoveryDetectionBoundMs: 50 });
    expect(result).toBe(1000 * 3 + 300 + 50);
  });

  it('with maxAttempts=1 there are no retry delays to sum', () => {
    const retryPolicy: RetryPolicy = { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 1000, retryOn: [] };
    const result = computeMaximumLogicalInvocationWindowMs({ actionTimeoutMs: 5000, retryPolicy, recoveryDetectionBoundMs: 100 });
    expect(result).toBe(5000 + 100);
  });

  it('is never recomputed with different results for the same inputs (determinism)', () => {
    const retryPolicy: RetryPolicy = { maxAttempts: 4, strategy: 'EXPONENTIAL', initialDelayMs: 500, multiplier: 1.5, retryOn: [] };
    const input = { actionTimeoutMs: 2000, retryPolicy, recoveryDetectionBoundMs: 300 };
    expect(computeMaximumLogicalInvocationWindowMs(input)).toBe(computeMaximumLogicalInvocationWindowMs(input));
  });
});
