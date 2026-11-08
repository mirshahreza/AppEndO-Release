/**
 * p-98 §7 — fastApplyPatch healing has no telemetry today, so there's no data to judge whether
 * its exact-match-first/line-trimmed-fallback healing is adequate for real edit volume, or
 * whether a dedicated Fast-Apply model (Cursor-style) would be worth building. This is the
 * lightweight instrumentation the plan's own evaluation recommended adding before that bigger
 * investment decision — record outcomes here, judge from real sessions later.
 */
export type FastApplyOutcomeKind = 'exact' | 'healed' | 'failed';

export type FastApplyOutcomeRecord = {
  path: string;
  outcome: FastApplyOutcomeKind;
  blockCount: number;
  healedBlockCount: number;
  failureReason?: string;
  recordedAt: string;
};

const MAX_BUFFER = 500;
const buffer: FastApplyOutcomeRecord[] = [];

export const recordFastApplyOutcome = (input: {
  path: string;
  blockCount: number;
  healedBlockCount?: number;
  failureReason?: string;
}): FastApplyOutcomeRecord => {
  const healedBlockCount = Math.max(0, Math.floor(input.healedBlockCount ?? 0));
  const outcome: FastApplyOutcomeKind = input.failureReason
    ? 'failed'
    : healedBlockCount > 0 ? 'healed' : 'exact';

  const record: FastApplyOutcomeRecord = {
    path: input.path,
    outcome,
    blockCount: Math.max(0, Math.floor(input.blockCount)),
    healedBlockCount,
    failureReason: input.failureReason,
    recordedAt: new Date().toISOString(),
  };
  buffer.push(record);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }
  return record;
};

export const getFastApplyOutcomeRecords = (): FastApplyOutcomeRecord[] => [...buffer];

export const clearFastApplyOutcomeRecords = (): void => {
  buffer.length = 0;
};

export const summarizeFastApplyOutcomes = (): {
  total: number;
  exact: number;
  healed: number;
  failed: number;
  healRate: number | null;
  failureRate: number | null;
} => {
  const total = buffer.length;
  const exact = buffer.filter((item) => item.outcome === 'exact').length;
  const healed = buffer.filter((item) => item.outcome === 'healed').length;
  const failed = buffer.filter((item) => item.outcome === 'failed').length;
  return {
    total,
    exact,
    healed,
    failed,
    healRate: total > 0 ? healed / total : null,
    failureRate: total > 0 ? failed / total : null,
  };
};
