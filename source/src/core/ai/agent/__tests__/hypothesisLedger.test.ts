import { describe, expect, it } from 'vitest';
import { HypothesisLedger } from '../hypothesisLedger';

describe('V5 P02 — HypothesisLedger', () => {
  it('proposes a new hypothesis as PROPOSED', () => {
    const ledger = new HypothesisLedger('t');
    const result = ledger.propose({ claim: 'bug is in clamp lower bound', type: 'ROOT_CAUSE', currentEvidenceCount: 0 });
    expect(result.ok).toBe(true);
    expect(result.hypothesis.status).toBe('PROPOSED');
  });

  it('re-proposing an identical claim while active returns the same hypothesis (idempotent)', () => {
    const ledger = new HypothesisLedger('t');
    const first = ledger.propose({ claim: 'X causes Y', type: 'ROOT_CAUSE', currentEvidenceCount: 0 });
    const second = ledger.propose({ claim: 'X causes Y', type: 'ROOT_CAUSE', currentEvidenceCount: 0 });
    expect(second.hypothesis.hypothesisId).toBe(first.hypothesis.hypothesisId);
  });

  it('blocks re-proposing a REJECTED hypothesis without new evidence (doc rule, verbatim)', () => {
    const ledger = new HypothesisLedger('t');
    const proposed = ledger.propose({ claim: 'the bug is X', type: 'ROOT_CAUSE', currentEvidenceCount: 0 });
    ledger.reject(proposed.hypothesis.hypothesisId, 2);

    const retry = ledger.propose({ claim: 'the bug is X', type: 'ROOT_CAUSE', currentEvidenceCount: 2 });
    expect(retry.ok).toBe(false);
    expect(retry.reason).toBe('rejected_without_new_evidence');
  });

  it('allows re-proposing a REJECTED hypothesis once new evidence exists', () => {
    const ledger = new HypothesisLedger('t');
    const proposed = ledger.propose({ claim: 'the bug is X', type: 'ROOT_CAUSE', currentEvidenceCount: 0 });
    ledger.reject(proposed.hypothesis.hypothesisId, 2);

    const retry = ledger.propose({ claim: 'the bug is X', type: 'ROOT_CAUSE', currentEvidenceCount: 3 });
    expect(retry.ok).toBe(true);
    expect(retry.hypothesis.status).toBe('PROPOSED');
  });

  it('confirm/contradict transition status and attach evidence ids', () => {
    const ledger = new HypothesisLedger('t');
    const proposed = ledger.propose({ claim: 'A', type: 'SOLUTION', currentEvidenceCount: 0 });
    ledger.confirm(proposed.hypothesis.hypothesisId, 'ev-1');
    expect(ledger.list()[0].status).toBe('CONFIRMED');
    expect(ledger.list()[0].supportingEvidenceIds).toContain('ev-1');
  });

  it('mostRecentActive returns the latest PROPOSED/SUPPORTED hypothesis, not a terminal one', () => {
    const ledger = new HypothesisLedger('t');
    const first = ledger.propose({ claim: 'A', type: 'SOLUTION', currentEvidenceCount: 0 });
    ledger.confirm(first.hypothesis.hypothesisId, 'ev-1');
    const second = ledger.propose({ claim: 'B', type: 'SOLUTION', currentEvidenceCount: 1 });
    expect(ledger.mostRecentActive()?.hypothesisId).toBe(second.hypothesis.hypothesisId);
  });
});
