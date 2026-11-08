import type { NativeToolDefinition } from '../ToolRegistry';

export const PROPOSE_HYPOTHESIS_TOOL_NAME = 'propose_hypothesis';

const VALID_TYPES = new Set(['LOCALIZATION', 'ROOT_CAUSE', 'SOLUTION', 'ENVIRONMENT']);

/**
 * V5 Phase P02 § 11 — model-facing entry point for `HypothesisLedger`. Mirrors the existing
 * `ask_clarifying_question` pattern: this tool only validates/echoes structured input.
 * `AgentOrchestrator` interprets `result.data` and applies it to the run's real
 * `HypothesisLedger` (see AgentOrchestrator.ts `PROPOSE_HYPOTHESIS_TOOL_NAME` handling) —
 * including possibly overriding `ok:true` to `ok:false` if the ledger's own
 * reject-without-new-evidence rule vetoes it, the same override pattern already used for the
 * harness retrieve gate and the P01 `OperationalPolicyEngine`.
 */
export const proposeHypothesisTool: NativeToolDefinition = {
  name: PROPOSE_HYPOTHESIS_TOOL_NAME,
  description: 'Record a debugging/implementation hypothesis (localization, root cause, solution, or environment) before acting on it, so it can be tracked, supported/contradicted by verification evidence, and — if rejected — cannot silently be retried without new evidence. Example: propose_hypothesis({ claim: "the bug is in clampPercentage missing a lower bound", type: "ROOT_CAUSE" }).',
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      claim: { type: 'string', description: 'The hypothesis statement, specific enough to be confirmed or contradicted by a test/verification step.' },
      type: { type: 'string', description: 'One of LOCALIZATION, ROOT_CAUSE, SOLUTION, ENVIRONMENT.' },
    },
    required: ['claim', 'type'],
  },
  execute: async (args) => {
    const claim = typeof args.claim === 'string' ? args.claim.trim() : '';
    const type = typeof args.type === 'string' ? args.type.trim().toUpperCase() : '';

    if (!claim) {
      return { ok: false as const, summary: 'claim is required.', error: 'missing_claim' };
    }
    if (!VALID_TYPES.has(type)) {
      return { ok: false as const, summary: `type must be one of ${[...VALID_TYPES].join(', ')}.`, error: 'invalid_type' };
    }

    return {
      ok: true as const,
      summary: `Hypothesis proposed: ${claim}`,
      data: { claim, type },
    };
  },
};
