import { describe, expect, it } from 'vitest';
import { runRetrievalStep, retrievalOutcomeOr, isRetrievalFailure } from '../retrievalOutcome';

describe('V5 P04 § 6.2 — runRetrievalStep (empty result ≠ subsystem failure)', () => {
  it('returns SUCCESS with the real value when the function returns normally', () => {
    const outcome = runRetrievalStep(() => [1, 2, 3]);
    expect(outcome.status).toBe('SUCCESS');
    expect(retrievalOutcomeOr(outcome, [])).toEqual([1, 2, 3]);
  });

  it('returns SUCCESS (not FAILED) when the function returns an empty/undefined result', () => {
    const emptyArray = runRetrievalStep(() => [] as string[]);
    const undefinedResult = runRetrievalStep(() => undefined);
    expect(emptyArray.status).toBe('SUCCESS');
    expect(undefinedResult.status).toBe('SUCCESS');
    expect(isRetrievalFailure(emptyArray)).toBe(false);
  });

  it('returns FAILED with the real error when the function throws', () => {
    const outcome = runRetrievalStep(() => { throw new Error('subsystem exploded'); });
    expect(outcome.status).toBe('FAILED');
    expect(isRetrievalFailure(outcome)).toBe(true);
    if (outcome.status === 'FAILED') {
      expect(outcome.errorCode).toBe('subsystem exploded');
    }
    expect(retrievalOutcomeOr(outcome, 'fallback')).toBe('fallback');
  });
});
