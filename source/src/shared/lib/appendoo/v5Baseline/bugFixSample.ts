/**
 * Stable, owned fixture target for V5 Phase P00 baseline trajectories (`bug_fix` scenario).
 * Deliberately contains a one-line bug (missing lower-bound clamp) so a scripted agent
 * trajectory can propose a real `draft_file_patch` against a real, allowlisted file without
 * depending on unrelated application files that could churn independently of this corpus.
 */
export function clampPercentage(value: number): number {
  if (value > 100) return 100;
  return value;
}
