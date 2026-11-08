import { summarizePerceivedLatency } from './chatPerceivedLatencyTelemetry';
import { summarizeProposalOutcomes } from './proposalOutcomeTelemetry';
import { summarizeTaskOutcomes } from './taskOutcomeTelemetry';
import { V5_KPI_DEFINITIONS, type V5KpiDefinition } from '../../api/contracts/appendoo/v5KpiSet.types';

export type V5KpiValue = {
  kpiId: string;
  computability: V5KpiDefinition['computability'];
  value?: number;
  sampleCount?: number;
  note: string;
};

/**
 * V5 Phase P10 § 33, extended in P11 — real computation for every KPI genuinely derivable from
 * existing, already-aggregated telemetry. `p95_task_latency` reads `chatPerceivedLatencyTelemetry`
 * (P10); `verified_task_success_rate`/`resume_success_rate`/`duplicate_mutation_rate`/
 * `same_failure_repeat_count` read the new `taskOutcomeTelemetry` buffer (P11 follow-up), fed
 * live from `AgentOrchestrator.run()`'s real `CompletionGate` result. The remaining 14 KPIs are
 * still returned `NOT_YET_COMPUTABLE` with their specific `missingDataSource` — never fabricated.
 *
 * Deliberately does NOT map `proposalOutcomeTelemetry.summarizeProposalOutcomes().acceptanceRate`
 * onto `verified_task_success_rate` or `false_success_rate` — the phase doc explicitly warns
 * against exactly this substitution ("do not make task pass rate the primary metric"). Acceptance is
 * a real but *different*, weaker signal (a user can accept an unverified change); it is surfaced
 * separately via `getProposalAcceptanceSignal`, never disguised as the KPI it is not. Likewise,
 * `verified_task_success_rate` here reads `CompletionGate`'s evidence-backed outcome (P07), not a
 * bare model claim — that is what makes "verified" honest, not just a rename of "pass rate".
 */
export const computeV5KpiSet = (): V5KpiValue[] => (
  V5_KPI_DEFINITIONS.map((definition): V5KpiValue => {
    if (definition.kpiId === 'p95_task_latency') {
      const summary = summarizePerceivedLatency();
      return {
        kpiId: definition.kpiId,
        computability: 'COMPUTABLE_NOW',
        value: summary.p95Ms ?? undefined,
        sampleCount: summary.sampleCount,
        note: summary.sampleCount > 0
          ? 'Computed from perceived-latency telemetry (chat round-trip, not the full agent task span) — a real but narrower proxy for the doc\'s "task latency"; labeled honestly, not equated.'
          : 'No perceived-latency samples recorded yet in this process.',
      };
    }

    if (definition.kpiId === 'verified_task_success_rate') {
      const summary = summarizeTaskOutcomes();
      return {
        kpiId: definition.kpiId,
        computability: 'COMPUTABLE_NOW',
        value: summary.verifiedTaskSuccessRate ?? undefined,
        sampleCount: summary.total,
        note: summary.total > 0
          ? 'Share of runs whose CompletionGate outcome (P07, evidence-backed) was CHANGE_COMPLETED/NO_CHANGE_REQUIRED/DOCUMENTATION_ONLY/TEST_ONLY.'
          : 'No task outcome samples recorded yet in this process.',
      };
    }

    if (definition.kpiId === 'resume_success_rate') {
      const summary = summarizeTaskOutcomes();
      return {
        kpiId: definition.kpiId,
        computability: 'COMPUTABLE_NOW',
        value: summary.resumeSuccessRate ?? undefined,
        sampleCount: summary.total,
        note: summary.resumeSuccessRate !== null
          ? 'Share of runs that started with a P09 pendingUnknownOutcome (a resumed/reconciled attempt) and still reached a successful CompletionGate outcome.'
          : 'No resumed-attempt (pendingUnknownOutcome-at-start) samples recorded yet.',
      };
    }

    if (definition.kpiId === 'duplicate_mutation_rate') {
      const summary = summarizeTaskOutcomes();
      return {
        kpiId: definition.kpiId,
        computability: 'COMPUTABLE_NOW',
        value: summary.duplicateMutationAttemptRate ?? undefined,
        sampleCount: summary.total,
        note: summary.duplicateMutationAttemptRate !== null
          ? 'Among runs with an unrecovered failure signature, the share where the P01/P09 repeated-failure/unresolved-unknown-outcome gate actually blocked a retry.'
          : 'No runs with a failure signature recorded yet.',
      };
    }

    if (definition.kpiId === 'same_failure_repeat_count') {
      const summary = summarizeTaskOutcomes();
      return {
        kpiId: definition.kpiId,
        computability: 'COMPUTABLE_NOW',
        value: summary.sameFailureRepeatCountMax ?? undefined,
        sampleCount: summary.total,
        note: summary.total > 0
          ? 'Max occurrences of any single (tool, target) failure signature across all recorded runs.'
          : 'No task outcome samples recorded yet in this process.',
      };
    }

    return {
      kpiId: definition.kpiId,
      computability: 'NOT_YET_COMPUTABLE',
      note: definition.missingDataSource ?? 'No data source.',
    };
  })
);

/**
 * Real, existing signal (`proposalOutcomeTelemetry.ts`, unchanged) — surfaced under its own name,
 * explicitly NOT presented as `verified_task_success_rate`/`false_success_rate`. See file doc
 * comment above for why conflating them would repeat the exact anti-pattern the phase doc warns
 * against.
 */
export const getProposalAcceptanceSignal = (): { acceptanceRate: number | null; total: number } => {
  const summary = summarizeProposalOutcomes();
  return { acceptanceRate: summary.acceptanceRate, total: summary.total };
};
