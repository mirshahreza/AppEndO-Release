import type { IAiProvider } from '../IAiProvider';
import { aiManager } from '../AiManager';
import { resolveFastClassifierModelId } from '../../../shared/lib/resolvePreferredAgentModel';
import type { AgentActionClass } from './operationalPolicyEngine';

/**
 * V5 Phase P01 § V5-2b (T3 from p-60) — `ModelRouter`.
 *
 * Scope note: `AgentOrchestrator` today takes ONE `provider`/`modelId` per whole run, chosen by
 * the caller before construction — there is no per-iteration model-swap point in the main chat
 * loop (`AgentOrchestratorDeps.provider`/`modelId` are fixed for the run's lifetime). Rewiring
 * that would be a much larger, riskier change to the actively-tested main loop than this phase's
 * blast radius should cover. So `ModelRouter` is wired at the two real per-purpose model-selection
 * points that already exist and already vary independently of the main model:
 *   1. `resolveSummaryProvider` (context/segment-history summarization) — now tier-aware.
 *   2. A new `resolveProviderWithFallback` wrapper around `provider.chatWithTools`, used by
 *      `AgentOrchestrator` for the main loop call — same primary model as before, but falls back
 *      to `deps.fallbackProviders` (optional, defaults to none — 100% compatible) on a thrown
 *      provider error instead of failing the whole run.
 * Full per-iteration primary-model tiering (swap the MAIN model based on live action class) is
 * deferred — tracked as debt in PHASE-EVIDENCE-REPORT-P01.md.
 */

export type ModelTier = 'fast' | 'strong';

const STRONG_TIER_ACTION_CLASSES = new Set<AgentActionClass>(['PLAN', 'EDIT', 'VERIFY', 'RECOVER', 'ESCALATE']);

export const resolveModelTierForActionClass = (actionClass: AgentActionClass): ModelTier => (
  STRONG_TIER_ACTION_CLASSES.has(actionClass) ? 'strong' : 'fast'
);

/**
 * Resolves a real, currently-enabled model id for a given tier, using the same
 * `resolveFastClassifierModelId` heuristic already used by `resolveSummaryProvider` for the
 * 'fast' tier, and the platform default model for 'strong'. Throws (does not fabricate a model
 * id) if AI is disabled — same failure mode as `AiManager.resolveModel` today (EV-3).
 */
export const resolveModelIdForTier = (tier: ModelTier): string => {
  const settings = aiManager.getSettings();
  if (!settings?.enabled) {
    throw new Error('AI is disabled in platform settings.');
  }
  if (tier === 'fast') {
    return resolveFastClassifierModelId(settings.models, settings.defaultModelId);
  }
  return settings.defaultModelId;
};

/**
 * Calls `chatWithTools` on `primary`; on a thrown error, tries each of `fallbacks` in order.
 * Real resilience behavior, testable without a live model (a provider whose `chatWithTools`
 * throws is enough — no live-model dependency). Errors from all providers are aggregated so the
 * caller sees exactly what was tried, rather than only the last error.
 */
export const callWithProviderFallback = async <T>(
  providers: readonly IAiProvider[],
  call: (provider: IAiProvider) => Promise<T>,
): Promise<T> => {
  if (providers.length === 0) {
    throw new Error('callWithProviderFallback requires at least one provider.');
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await call(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.getProviderName()}: ${message}`);
    }
  }

  throw new Error(`All providers failed — ${errors.join(' | ')}`);
};
