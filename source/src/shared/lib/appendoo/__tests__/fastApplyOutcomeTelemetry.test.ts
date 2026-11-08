import { describe, expect, it } from 'vitest';
import {
  clearFastApplyOutcomeRecords,
  recordFastApplyOutcome,
  summarizeFastApplyOutcomes,
} from '../fastApplyOutcomeTelemetry';

describe('fastApplyOutcomeTelemetry', () => {
  it('classifies exact-match success (no healing) separately from healed', () => {
    clearFastApplyOutcomeRecords();
    const record = recordFastApplyOutcome({ path: 'src/a.ts', blockCount: 1 });
    expect(record.outcome).toBe('exact');
    const summary = summarizeFastApplyOutcomes();
    expect(summary.exact).toBe(1);
    expect(summary.healed).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it('classifies a healed block separately from an untouched exact match', () => {
    clearFastApplyOutcomeRecords();
    recordFastApplyOutcome({ path: 'src/a.ts', blockCount: 2, healedBlockCount: 1 });
    const summary = summarizeFastApplyOutcomes();
    expect(summary.healed).toBe(1);
    expect(summary.exact).toBe(0);
    expect(summary.healRate).toBe(1);
  });

  it('tracks failures with their reason', () => {
    clearFastApplyOutcomeRecords();
    recordFastApplyOutcome({ path: 'src/a.ts', blockCount: 1, failureReason: 'Block 1: original snippet not found in file.' });
    const summary = summarizeFastApplyOutcomes();
    expect(summary.failed).toBe(1);
    expect(summary.failureRate).toBe(1);
  });

  it('returns null rates when nothing has been recorded', () => {
    clearFastApplyOutcomeRecords();
    const summary = summarizeFastApplyOutcomes();
    expect(summary.total).toBe(0);
    expect(summary.healRate).toBeNull();
    expect(summary.failureRate).toBeNull();
  });
});
