import type { PlanningBlocker, ResolvedTargetBinding } from '../../api/contracts/appendoo/semanticPlanAuthority.types';
import { resolveServerFunctionFixture } from './serverFunctionContractFixtures';

/**
 * V5 Phase P11 § V5-18 "independent Critic Agent" — an independent, deterministic re-verification of
 * `ResolvedTargetBinding`s before a plan reaches approval. Bounded scope, disclosed honestly: the
 * phase doc's own framing calls for "an independent critic agent (different prompt or model from the main agent)" —
 * a genuinely separate MODEL invocation. That is not buildable for real in this environment (EV-3
 * — no live model configured, same blocker every other V5 phase that needed live-model grounding
 * hit; see D-007). What IS real and buildable without a model: an independent, deterministic
 * check that re-derives target-binding correctness from first principles instead of trusting the
 * planner's own claim — catching exactly the class of bug P06's own development found three times
 * (target resolved to something unresolvable, a malformed double-prefixed id, a confidence/method
 * mismatch) BEFORE a human ever sees the plan, which is the DoD's literal requirement.
 */

const DOUBLE_NAMESPACE_PREFIX_PATTERN = /^([a-z0-9-]+)\.\1\./i;

export const runTargetBindingCriticCheck = (
  bindings: readonly ResolvedTargetBinding[] | undefined,
): PlanningBlocker[] => {
  const blockers: PlanningBlocker[] = [];

  for (const binding of bindings ?? []) {
    if (binding.artifactType !== 'SERVER_FUNCTION') continue;

    if (DOUBLE_NAMESPACE_PREFIX_PATTERN.test(binding.canonicalId)) {
      blockers.push({
        code: 'CRITIC_TARGET_BINDING_REJECTED',
        stage: 'PLANNING',
        materiality: 'BLOCKING',
        question: `Critic check: target binding "${binding.canonicalId}" has a duplicated namespace prefix — this is the exact malformed-id pattern found and fixed during P06 development, not a real function id.`,
        evidenceRefs: binding.evidenceRefs,
      });
      continue;
    }

    if (binding.resolutionMethod !== 'EXACT_TARGET') continue;

    if (binding.confidence < 1) {
      blockers.push({
        code: 'CRITIC_TARGET_BINDING_REJECTED',
        stage: 'PLANNING',
        materiality: 'BLOCKING',
        question: `Critic check: binding claims EXACT_TARGET resolution but confidence is ${binding.confidence}, not 1 — internally inconsistent.`,
        evidenceRefs: binding.evidenceRefs,
      });
      continue;
    }

    if (binding.evidenceRefs.length === 0) {
      blockers.push({
        code: 'CRITIC_TARGET_BINDING_REJECTED',
        stage: 'PLANNING',
        materiality: 'BLOCKING',
        question: 'Critic check: binding claims EXACT_TARGET resolution with zero evidence refs — unverifiable.',
        evidenceRefs: [],
      });
      continue;
    }

    if (!resolveServerFunctionFixture(binding.canonicalId)) {
      blockers.push({
        code: 'CRITIC_TARGET_BINDING_REJECTED',
        stage: 'PLANNING',
        materiality: 'BLOCKING',
        question: `Critic check: binding target "${binding.canonicalId}" does not independently resolve to any known server function contract.`,
        evidenceRefs: binding.evidenceRefs,
      });
    }
  }

  return blockers;
};
