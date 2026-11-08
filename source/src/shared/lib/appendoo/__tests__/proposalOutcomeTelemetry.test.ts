import { describe, expect, it } from 'vitest';
import {
  clearProposalOutcomeRecords,
  recordProposalOutcome,
  summarizeProposalOutcomes,
} from '../proposalOutcomeTelemetry';

describe('proposalOutcomeTelemetry', () => {
  it('tracks acceptance rate', () => {
    clearProposalOutcomeRecords();
    recordProposalOutcome({ proposalId: 'p1', outcome: 'accepted', changeSetCount: 2 });
    recordProposalOutcome({ proposalId: 'p2', outcome: 'rejected_full', changeSetCount: 1 });
    const summary = summarizeProposalOutcomes();
    expect(summary.accepted).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.acceptanceRate).toBe(0.5);
  });

  it('tracks dismissed pre-apply separately from rejection rate', () => {
    clearProposalOutcomeRecords();
    recordProposalOutcome({ proposalId: 'p1', outcome: 'accepted', changeSetCount: 1 });
    recordProposalOutcome({ proposalId: 'p2', outcome: 'dismissed_pre_apply', changeSetCount: 3 });
    const summary = summarizeProposalOutcomes();
    expect(summary.accepted).toBe(1);
    expect(summary.rejected).toBe(0);
    expect(summary.dismissedPreApply).toBe(1);
    expect(summary.acceptanceRate).toBe(1);
  });
});
