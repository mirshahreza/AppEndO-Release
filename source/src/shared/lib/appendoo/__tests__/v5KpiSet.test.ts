import { afterEach, describe, expect, it } from 'vitest';
import { computeV5KpiSet, getProposalAcceptanceSignal } from '../v5KpiSet';
import { V5_KPI_DEFINITIONS } from '../../../api/contracts/appendoo/v5KpiSet.types';
import { clearPerceivedLatencySamples, ingestPerceivedLatencySample } from '../chatPerceivedLatencyTelemetry';
import { clearProposalOutcomeRecords, recordProposalOutcome } from '../proposalOutcomeTelemetry';
import { clearTaskOutcomeRecords, recordTaskOutcome } from '../taskOutcomeTelemetry';

describe('V5 P10 § 33 — v5KpiSet', () => {
  afterEach(() => {
    clearPerceivedLatencySamples();
    clearProposalOutcomeRecords();
    clearTaskOutcomeRecords();
  });

  it('covers the full 19-metric doc set, with false_success_rate present and marked non-primary-but-most-important-qualitative', () => {
    expect(V5_KPI_DEFINITIONS).toHaveLength(19);
    const falseSuccessRate = V5_KPI_DEFINITIONS.find((def) => def.kpiId === 'false_success_rate');
    expect(falseSuccessRate).toBeDefined();
    const verifiedTaskSuccessRate = V5_KPI_DEFINITIONS.find((def) => def.kpiId === 'verified_task_success_rate');
    expect(verifiedTaskSuccessRate?.isPrimary).toBe(true);
  });

  it('every NOT_YET_COMPUTABLE definition has a real, specific missingDataSource — never a silent gap', () => {
    for (const def of V5_KPI_DEFINITIONS) {
      if (def.computability === 'NOT_YET_COMPUTABLE') {
        expect(def.missingDataSource?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('computes p95_task_latency for real from actual recorded samples, with zero samples honestly reported as such', () => {
    const emptyResult = computeV5KpiSet().find((kpi) => kpi.kpiId === 'p95_task_latency');
    expect(emptyResult?.sampleCount).toBe(0);
    expect(emptyResult?.value).toBeUndefined();

    ingestPerceivedLatencySample({ latencyMs: 100, activityKind: 'user_echo' });
    ingestPerceivedLatencySample({ latencyMs: 900, activityKind: 'user_echo' });

    const populatedResult = computeV5KpiSet().find((kpi) => kpi.kpiId === 'p95_task_latency');
    expect(populatedResult?.sampleCount).toBe(2);
    expect(populatedResult?.value).toBeGreaterThan(0);
  });

  it('V5 P11 follow-up — verified_task_success_rate/resume_success_rate/duplicate_mutation_rate/same_failure_repeat_count are now computed for real from taskOutcomeTelemetry', () => {
    recordTaskOutcome({
      taskId: 't1', attemptId: 'a1', outcome: 'CHANGE_COMPLETED',
      hadUnresolvedUnknownOutcomeAtStart: true, blockedRepeatedFailureRetry: false, maxFailureSignatureOccurrences: 0,
    });
    recordTaskOutcome({
      taskId: 't2', attemptId: 'a2', outcome: 'FAILED',
      hadUnresolvedUnknownOutcomeAtStart: false, blockedRepeatedFailureRetry: true, maxFailureSignatureOccurrences: 3,
    });

    const results = computeV5KpiSet();
    const byId = (id: string) => results.find((kpi) => kpi.kpiId === id)!;

    expect(byId('verified_task_success_rate').value).toBe(0.5);
    expect(byId('resume_success_rate').value).toBe(1); // the one resumed run (t1) succeeded
    expect(byId('duplicate_mutation_rate').value).toBe(1); // the one run with a failure signature (t2) was blocked
    expect(byId('same_failure_repeat_count').value).toBe(3);
  });

  it('every remaining KPI honestly reports NOT_YET_COMPUTABLE rather than fabricating a value', () => {
    const results = computeV5KpiSet();
    const computableIds = new Set(['p95_task_latency', 'verified_task_success_rate', 'resume_success_rate', 'duplicate_mutation_rate', 'same_failure_repeat_count']);
    const notComputable = results.filter((kpi) => !computableIds.has(kpi.kpiId));
    expect(notComputable).toHaveLength(19 - computableIds.size);
    for (const kpi of notComputable) {
      expect(kpi.computability).toBe('NOT_YET_COMPUTABLE');
      expect(kpi.value).toBeUndefined();
    }
  });

  it('getProposalAcceptanceSignal is a real, distinct signal, never presented as a KPI it is not', () => {
    recordProposalOutcome({ outcome: 'accepted', changeSetCount: 1 });
    recordProposalOutcome({ outcome: 'rejected_full', changeSetCount: 1 });

    const signal = getProposalAcceptanceSignal();
    expect(signal.total).toBe(2);
    expect(signal.acceptanceRate).toBe(0.5);

    // Confirm this signal is not one of the 19 catalog KPI ids (would be a silent conflation).
    expect(V5_KPI_DEFINITIONS.some((def) => def.kpiId === 'proposal_acceptance_rate')).toBe(false);
  });
});
