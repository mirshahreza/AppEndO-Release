import { afterEach, describe, expect, it } from 'vitest';
import { clearTaskOutcomeRecords, probeTaskOutcomeTelemetryHealth, recordTaskOutcome, summarizeTaskOutcomes } from '../taskOutcomeTelemetry';

describe('V5 P11 (P10 § 33 follow-up) — taskOutcomeTelemetry', () => {
  afterEach(() => {
    clearTaskOutcomeRecords();
  });

  it('computes verifiedTaskSuccessRate from real CompletionGate-shaped outcomes', () => {
    recordTaskOutcome({ taskId: 't1', attemptId: 'a1', outcome: 'CHANGE_COMPLETED', hadUnresolvedUnknownOutcomeAtStart: false, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0 });
    recordTaskOutcome({ taskId: 't2', attemptId: 'a2', outcome: 'NO_CHANGE_REQUIRED', hadUnresolvedUnknownOutcomeAtStart: false, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0 });
    recordTaskOutcome({ taskId: 't3', attemptId: 'a3', outcome: 'FAILED', hadUnresolvedUnknownOutcomeAtStart: false, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0 });

    const summary = summarizeTaskOutcomes();
    expect(summary.total).toBe(3);
    expect(summary.verifiedTaskSuccessRate).toBeCloseTo(2 / 3);
  });

  it('resumeSuccessRate only considers runs that started with an unresolved unknown outcome (P09)', () => {
    recordTaskOutcome({ taskId: 't1', attemptId: 'a1', outcome: 'CHANGE_COMPLETED', hadUnresolvedUnknownOutcomeAtStart: true, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0 });
    recordTaskOutcome({ taskId: 't2', attemptId: 'a2', outcome: 'FAILED', hadUnresolvedUnknownOutcomeAtStart: true, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0 });
    recordTaskOutcome({ taskId: 't3', attemptId: 'a3', outcome: 'CHANGE_COMPLETED', hadUnresolvedUnknownOutcomeAtStart: false, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0 });

    const summary = summarizeTaskOutcomes();
    expect(summary.resumeSuccessRate).toBe(0.5); // 1 of 2 resumed runs succeeded; t3 excluded (not a resume)
  });

  it('returns null (not 0 or NaN) for a metric with zero eligible samples — honest absence, not a fabricated zero', () => {
    const summary = summarizeTaskOutcomes();
    expect(summary.total).toBe(0);
    expect(summary.verifiedTaskSuccessRate).toBeNull();
    expect(summary.resumeSuccessRate).toBeNull();
    expect(summary.duplicateMutationAttemptRate).toBeNull();
    expect(summary.sameFailureRepeatCountMax).toBeNull();
  });

  it('probeTaskOutcomeTelemetryHealth reports ok on a well-formed buffer', () => {
    recordTaskOutcome({ taskId: 't1', attemptId: 'a1', outcome: 'CHANGE_COMPLETED', hadUnresolvedUnknownOutcomeAtStart: false, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0 });
    expect(probeTaskOutcomeTelemetryHealth().ok).toBe(true);
  });
});
