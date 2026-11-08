/**
 * V5 Phase P11 (follow-up to P10 § 33) — the cross-run TaskOutcome aggregation buffer P10's own
 * evidence report named as the specific missing piece behind 18 of 19 KPIs ("no cross-run
 * TaskOutcome/CompletionGate result buffer exists yet"). Same in-process-buffer pattern already
 * established and trusted elsewhere in this codebase (`proposalOutcomeTelemetry.ts`,
 * `chatPerceivedLatencyTelemetry.ts`) — not a new architecture, the same one extended to a new
 * signal. Fed from the real `AgentOrchestrator.run()` completion point (`CompletionGate`'s
 * evaluated `TaskOutcome`, P07 — evidence-backed, not a bare model claim), so "verified" in
 * `verified_task_success_rate` means what P07 already enforces it to mean.
 */
export type TaskOutcomeRecord = {
  taskId: string;
  attemptId: string;
  outcome: string;
  hadUnresolvedUnknownOutcomeAtStart: boolean;
  blockedRepeatedFailureRetry: boolean;
  maxFailureSignatureOccurrences: number;
  recordedAt: string;
};

const MAX_BUFFER = 500;
const buffer: TaskOutcomeRecord[] = [];

export const recordTaskOutcome = (input: {
  taskId: string;
  attemptId: string;
  outcome: string;
  hadUnresolvedUnknownOutcomeAtStart: boolean;
  blockedRepeatedFailureRetry: boolean;
  maxFailureSignatureOccurrences: number;
}): TaskOutcomeRecord => {
  const record: TaskOutcomeRecord = {
    ...input,
    recordedAt: new Date().toISOString(),
  };
  buffer.push(record);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }
  return record;
};

export const getTaskOutcomeRecords = (): TaskOutcomeRecord[] => [...buffer];

export const clearTaskOutcomeRecords = (): void => {
  buffer.length = 0;
};

const SUCCESS_OUTCOMES = new Set(['CHANGE_COMPLETED', 'NO_CHANGE_REQUIRED', 'DOCUMENTATION_ONLY', 'TEST_ONLY']);

export const summarizeTaskOutcomes = (): {
  total: number;
  verifiedTaskSuccessRate: number | null;
  resumeSuccessRate: number | null;
  duplicateMutationAttemptRate: number | null;
  sameFailureRepeatCountMax: number | null;
} => {
  const total = buffer.length;
  const successCount = buffer.filter((record) => SUCCESS_OUTCOMES.has(record.outcome)).length;

  const resumedRuns = buffer.filter((record) => record.hadUnresolvedUnknownOutcomeAtStart);
  const resumedSuccessCount = resumedRuns.filter((record) => SUCCESS_OUTCOMES.has(record.outcome)).length;

  const runsWithFailureSignature = buffer.filter((record) => record.maxFailureSignatureOccurrences > 0);
  const duplicateAttemptBlockedCount = buffer.filter((record) => record.blockedRepeatedFailureRetry).length;

  return {
    total,
    verifiedTaskSuccessRate: total > 0 ? successCount / total : null,
    resumeSuccessRate: resumedRuns.length > 0 ? resumedSuccessCount / resumedRuns.length : null,
    duplicateMutationAttemptRate: runsWithFailureSignature.length > 0
      ? duplicateAttemptBlockedCount / runsWithFailureSignature.length
      : null,
    sameFailureRepeatCountMax: total > 0
      ? Math.max(...buffer.map((record) => record.maxFailureSignatureOccurrences))
      : null,
  };
};

export const probeTaskOutcomeTelemetryHealth = (): { ok: boolean; failures: string[] } => {
  const failures: string[] = [];
  const summary = summarizeTaskOutcomes();
  if (summary.total > MAX_BUFFER) {
    failures.push('Task outcome buffer exceeded max size.');
  }
  if (summary.verifiedTaskSuccessRate !== null && (summary.verifiedTaskSuccessRate < 0 || summary.verifiedTaskSuccessRate > 1)) {
    failures.push('Invalid verified task success rate computed.');
  }
  return { ok: failures.length === 0, failures };
};
