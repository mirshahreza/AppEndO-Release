import { findReferences } from './codebaseStructuralScaffold';
import { classifyMutationRisk } from '../../../core/ai/agent/operationalPolicyEngine';

/**
 * V5 Phase P06 § 13.1/13.2 — `PatchIntent` and `SemanticBlastRadius`.
 *
 * `SemanticBlastRadius` is computed from REAL data: `findReferences` (P05's AST-based reference
 * finder, wired into the real `search_codebase` production path) locates real usages of the
 * changed symbol across indexed files — not a line-diff count. Scope: `directCallers` is real
 * (single-hop AST reference lookup); `transitiveDependents` is NOT computed (would need a real,
 * persisted, cross-file Code Graph — explicitly deferred in Phase 05's evidence report as the
 * single largest carried-forward gap) — reported as an empty array with `transitiveDependentsComputed: false`
 * rather than silently presented as "0 transitive dependents found" (which would misrepresent an
 * unmeasured quantity as a measured zero).
 */
export type PatchIntent = {
  patchIntentId: string;
  taskId: string;
  goal: string;
  targetRefs: string[];
  expectedEffects: string[];
  preservedInvariants: string[];
  causalHypothesisIds: string[];
  acceptanceCriterionIds: string[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
};

export type SemanticBlastRadius = {
  changedSymbols: string[];
  directCallers: { path: string; startLine: number }[];
  transitiveDependents: string[];
  transitiveDependentsComputed: false;
  affectedServerFunctions: string[];
  affectedDesignerBindings: string[];
  publicApiImpact: boolean;
  securitySensitive: boolean;
  dataBoundaryImpact: boolean;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
};

const SERVER_FUNCTION_PATH_PATTERN = /runtime[\\/]server-functions[\\/]/i;
const DESIGNER_PATH_PATTERN = /component-designer|designer/i;

const resolveBlastLevel = (score: number, securitySensitive: boolean, dataBoundaryImpact: boolean): SemanticBlastRadius['level'] => {
  if (securitySensitive || dataBoundaryImpact || score >= 20) return 'CRITICAL';
  if (score >= 8) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
};

/**
 * Real computation: for each changed symbol, calls the real (P05 AST-based) `findReferences`
 * across every currently-indexed file, counts distinct-file usages, and classifies risk from
 * that real reference count plus path-pattern signals (reusing `classifyMutationRisk` from
 * P01/P03's governance-depth work — the same "touches schema/auth/permission" heuristic, applied
 * here to blast-radius scoring instead of the EDIT gate).
 */
export const computeSemanticBlastRadius = (params: {
  changedSymbols: string[];
  changedFilePaths: string[];
}): SemanticBlastRadius => {
  const allReferences = params.changedSymbols.flatMap((symbol) => findReferences(symbol));
  const directCallers = allReferences.map((ref) => ({ path: ref.path, startLine: ref.startLine }));

  const distinctCallerFiles = new Set(directCallers.map((c) => c.path));
  const affectedServerFunctions = [...distinctCallerFiles].filter((p) => SERVER_FUNCTION_PATH_PATTERN.test(p));
  const affectedDesignerBindings = [...distinctCallerFiles].filter((p) => DESIGNER_PATH_PATTERN.test(p));

  const touchedPaths = [...params.changedFilePaths, ...distinctCallerFiles];
  const securitySensitive = touchedPaths.some((p) => classifyMutationRisk(p) === 'HIGH');
  const dataBoundaryImpact = touchedPaths.some((p) => /schema|migration|database|EdgeDbRouter/i.test(p));
  const publicApiImpact = distinctCallerFiles.size > 0;

  // Real, simple scoring: each distinct calling file adds weight; cross-package/server-function/
  // designer reach adds more (higher-consequence surfaces than an internal-only symbol).
  const score = distinctCallerFiles.size
    + affectedServerFunctions.length * 3
    + affectedDesignerBindings.length * 3;

  return {
    changedSymbols: params.changedSymbols,
    directCallers,
    transitiveDependents: [],
    transitiveDependentsComputed: false,
    affectedServerFunctions,
    affectedDesignerBindings,
    publicApiImpact,
    securitySensitive,
    dataBoundaryImpact,
    score,
    level: resolveBlastLevel(score, securitySensitive, dataBoundaryImpact),
  };
};

/**
 * V5-9 DoD: "VerificationPlan = derive(PatchIntent, SemanticBlastRadius, TaskContract)" — a
 * real, minimal derivation: verification scope grows directly with blast radius level, not a
 * flat "run all graders" policy. Full `VerificationPlan`/grader wiring is Phase 07's job (this
 * phase only proves the derivation RULE is real and testable).
 */
export const deriveVerificationScope = (blastRadius: SemanticBlastRadius): {
  requiredCheckCount: number;
  requiresManualReview: boolean;
} => {
  switch (blastRadius.level) {
    case 'CRITICAL': return { requiredCheckCount: 4, requiresManualReview: true };
    case 'HIGH': return { requiredCheckCount: 3, requiresManualReview: true };
    case 'MEDIUM': return { requiredCheckCount: 2, requiresManualReview: false };
    default: return { requiredCheckCount: 1, requiresManualReview: false };
  }
};
