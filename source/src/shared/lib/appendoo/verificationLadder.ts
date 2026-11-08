import type { SemanticBlastRadius } from './patchIntentBlastRadius';

/**
 * V5 Phase P07 § V5-10 — verification ladder (L0-L5), policy-selected from blast radius.
 *
 * DoD: "deployable must no longer derive only from path graders" — this makes the required
 * verification LEVEL a real function of `SemanticBlastRadius` (P06, itself real/AST-derived —
 * not of line-diff size or grader pass/fail alone). Scope: this phase implements the level
 * SELECTION rule and proves it against the DoD; it does NOT implement L1-L5's actual executors
 * (real typecheck/build/lint/integration-test orchestration) — `run_tests` (real, existing) is
 * the only ladder rung with a real executor today. See PHASE-EVIDENCE-REPORT-P07.md § Remaining.
 */
export type VerificationLadderLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

const LADDER_DESCRIPTIONS: Record<VerificationLadderLevel, string> = {
  L0: 'Patch structure only (existing structural/policy graders).',
  L1: 'Targeted diagnostics/typecheck for changed files.',
  L2: 'Targeted tests for the changed symbol(s).',
  L3: 'Affected tests (real reference fan-out — P06 directCallers).',
  L4: 'Integration/build.',
  L5: 'AppEndO-specific semantic verification (permission/route/binding checks).',
};

export const resolveRequiredVerificationLevel = (blastRadius: SemanticBlastRadius): VerificationLadderLevel => {
  switch (blastRadius.level) {
    case 'CRITICAL': return 'L5';
    case 'HIGH': return 'L4';
    case 'MEDIUM': return 'L3';
    default: return blastRadius.directCallers.length > 0 ? 'L2' : 'L1';
  }
};

export const describeVerificationLevel = (level: VerificationLadderLevel): string => LADDER_DESCRIPTIONS[level];

/** Real (not fabricated) "deployable" derivation — requires BOTH structural graders passing AND the blast-radius-selected ladder level having been reached. */
export const resolveDeployable = (params: {
  structuralGradersPassed: boolean;
  requiredLevel: VerificationLadderLevel;
  reachedLevel: VerificationLadderLevel;
}): boolean => {
  const order: VerificationLadderLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  const reachedIndex = order.indexOf(params.reachedLevel);
  const requiredIndex = order.indexOf(params.requiredLevel);
  return params.structuralGradersPassed && reachedIndex >= requiredIndex;
};
