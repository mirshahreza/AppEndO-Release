/**
 * V5 Phase P10 § V5-15 "Replay Harness and Architecture-Aware Eval" — the phase doc's literal
 * contract, applied to the 10 named acceptance scenarios (V5-GE-001..010) from the doc's own
 * "Source-Grounded Problem" section 32. DoD: every important agent bug gets a trajectory fixture and regression eval.
 *
 * Deliberate architectural choice, not a shortcut: this codebase's existing regression suite
 * (vitest, `test:critical`/`test:appendoo-golden`) already IS a real trajectory-fixture-to-
 * regression-eval mechanism — most of these 10 scenarios were already proven by earlier V5 phases
 * (P01-P09) as real, passing tests. Building a second, parallel "eval harness" that re-implements
 * the same checks would be exactly the kind of duplicate/parallel authority
 * `ANTI-SCAFFOLD-RULES.md` warns against. This catalog's job is to make that mapping explicit,
 * verifiable (the referenced fixture file/test must actually exist), and honest about the one
 * scenario that is not yet fully covered (see `fixtureStatus`).
 */
export type EvalLayer =
  | 'TASK_OUTCOME'
  | 'EXPLORATION'
  | 'CONTEXT'
  | 'POLICY'
  | 'TOOL_ACI'
  | 'PATCH'
  | 'VERIFICATION'
  | 'TRAJECTORY'
  | 'COST_LATENCY'
  | 'SECURITY';

export type V5ReplayEvalFixtureStatus = 'FIXTURE_EXISTS' | 'GAP_DOCUMENTED';

export type V5ReplayEvalScenario = {
  scenarioId: string;
  title: string;
  descriptionEn: string;
  evalLayers: EvalLayer[];
  expectedProperties: string[];
  fixtureStatus: V5ReplayEvalFixtureStatus;
  /** Repo-relative path to the real test file proving this scenario, or the closest existing infra when status is GAP_DOCUMENTED. */
  fixtureFile: string;
  fixtureTestName: string;
  /** Required when fixtureStatus is GAP_DOCUMENTED — must state exactly what's missing, not gloss over it. */
  gapNote?: string;
};

export const V5_REPLAY_EVAL_CATALOG_VERSION = 'p10-v1';
