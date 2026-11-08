/**
 * V5 Phase P10 section 33 primary KPIs — the doc's literal 19-metric KPI set, formalized as a real
 * catalog. `v5KpiSet.ts` computes the subset genuinely derivable from telemetry that already
 * exists and is already aggregated (`proposalOutcomeTelemetry.ts`, `chatPerceivedLatencyTelemetry.ts`)
 * — per the phase doc's own grounding note (P1/P4 → light dashboard on EXISTING data, not a mandate
 * to invent new cross-run telemetry collection this phase). Every other KPI is honestly marked
 * `NOT_YET_COMPUTABLE` with the specific missing data source named — not silently omitted, not faked
 * with a placeholder number.
 */
export type V5KpiComputability = 'COMPUTABLE_NOW' | 'NOT_YET_COMPUTABLE';

export type V5KpiDefinition = {
  kpiId: string;
  descriptionEn: string;
  isPrimary: boolean;
  computability: V5KpiComputability;
  /** Required when NOT_YET_COMPUTABLE — the specific telemetry source that doesn't exist yet. */
  missingDataSource?: string;
};

export const V5_KPI_DEFINITIONS: V5KpiDefinition[] = [
  { kpiId: 'verified_task_success_rate', descriptionEn: 'Verified real success rate (not merely pass rate)', isPrimary: true, computability: 'COMPUTABLE_NOW' },
  { kpiId: 'cost_per_verified_success', descriptionEn: 'Cost per verified success', isPrimary: true, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No per-run cost/token-spend telemetry is persisted across runs (only per-run tokensEstimate/tokensBudget, not accumulated).' },
  { kpiId: 'false_success_rate', descriptionEn: 'Most important quality KPI — false success claim rate', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'Requires cross-run TaskOutcome + independent ground-truth verification, neither aggregated yet.' },
  { kpiId: 'premature_edit_rate', descriptionEn: 'Edit-before-sufficient-discovery rate', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No cross-run exploration-vs-edit-order telemetry buffer.' },
  { kpiId: 'no_change_precision', descriptionEn: 'NO_CHANGE_REQUIRED detection precision', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No aggregated CompletionGate outcome buffer.' },
  { kpiId: 'late_context_discovery', descriptionEn: 'Late relevant-context discovery', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No cross-run retrieval-timing telemetry.' },
  { kpiId: 'unused_context_ratio', descriptionEn: 'Ratio of retrieved but unused context', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'ContextItemDiscovered/Utilized events exist per-run (P04) but are not aggregated across runs.' },
  { kpiId: 'context_tokens_per_verified_claim', descriptionEn: 'Context tokens per verified claim', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No aggregated Evidence/Claim + token-usage join across runs.' },
  { kpiId: 'same_failure_repeat_count', descriptionEn: 'Same failure signature repeat count', isPrimary: false, computability: 'COMPUTABLE_NOW' },
  { kpiId: 'stall_duration', descriptionEn: 'Stall duration', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'StallDetected event exists (P01) but carries no duration field, and is not aggregated.' },
  { kpiId: 'recovery_success_rate', descriptionEn: 'Success rate after RecoveryStrategySelected', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'RecoveryStrategySelected event newly wired this phase (P10); no cross-run outcome-after-recovery buffer yet.' },
  { kpiId: 'patch_over_edit_rate', descriptionEn: 'Patch vs full-file edit ratio', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No aggregated patch-vs-content-mode telemetry across runs.' },
  { kpiId: 'semantic_blast_radius_miss_rate', descriptionEn: 'High blast-radius miss rate', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'computeSemanticBlastRadius (P06) runs per-patch but results are not persisted to a cross-run buffer.' },
  { kpiId: 'verification_false_pass_rate', descriptionEn: 'False pass rate in verification', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No independent ground-truth to compare verification results against across runs.' },
  { kpiId: 'resume_success_rate', descriptionEn: 'Resume success rate after crash', isPrimary: false, computability: 'COMPUTABLE_NOW' },
  { kpiId: 'duplicate_mutation_rate', descriptionEn: 'Duplicate mutation rate (blocked duplicate mutation attempts)', isPrimary: false, computability: 'COMPUTABLE_NOW' },
  { kpiId: 'p50_time_to_primary_target', descriptionEn: 'Median time to primary target', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'No "primary target reached" timestamp is recorded in any cross-run buffer.' },
  { kpiId: 'p50_time_to_first_useful_evidence', descriptionEn: 'Median time to first useful evidence', isPrimary: false, computability: 'NOT_YET_COMPUTABLE', missingDataSource: 'EvidenceProduced events exist per-run (P02) but timestamps are not aggregated across runs.' },
  { kpiId: 'p95_task_latency', descriptionEn: '95th percentile total task latency', isPrimary: false, computability: 'COMPUTABLE_NOW' },
];
