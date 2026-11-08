import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';
import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import { detectGovernedEngineeringIntent } from '../../../shared/lib/detectCodingIntent';

/** How this single user turn must run — resolved before tools, preload, or harness. */
export type TurnExecutionProfile =
  | 'ask_lookup'
  | 'plan_authoring'
  | 'agent_lookup'
  | 'agent_plan_review'
  | 'agent_implement'
  | 'agent_implement_governed';

export type AgentPlanActMode = 'review' | 'implement';

/**
 * Resolve execution profile from explicit user choices only: UI mode and the Plan/Act toggle.
 *
 * Agent mode always resolves to the full-toolset implement profile — whether a message is a
 * question or a build request is the model's call inside the loop, not a routing decision.
 * The old content-based routing (English-only regex + LLM classifiers) silently demoted
 * non-English build requests to a lookup profile with draft_* tools stripped, which made the
 * agent refuse to implement. Only the governed pipeline keeps a content trigger, because its
 * phrases ("architect approval", "promote to production") are explicit power-user opt-ins.
 */
export const resolveTurnExecutionProfile = (
  mode: AgentMode,
  userIntent: string,
  _pageContext?: Pick<AiPageContext, 'path' | 'pageKey' | 'functionId' | 'functionName' | 'layoutId'>,
  options?: { agentPlanActMode?: AgentPlanActMode },
): TurnExecutionProfile => {
  if (mode === 'ask') return 'ask_lookup';
  if (mode === 'plan') return 'plan_authoring';

  if (options?.agentPlanActMode === 'review') {
    return 'agent_plan_review';
  }

  if (detectGovernedEngineeringIntent(userIntent.trim())) return 'agent_implement_governed';

  return 'agent_implement';
};

export const isLookupProfile = (profile: TurnExecutionProfile): boolean => (
  profile === 'ask_lookup' || profile === 'agent_lookup' || profile === 'agent_plan_review'
);

export const isPlanReviewProfile = (profile: TurnExecutionProfile): boolean => (
  profile === 'agent_plan_review'
);

export const isImplementProfile = (profile: TurnExecutionProfile): boolean => (
  profile === 'agent_implement' || profile === 'agent_implement_governed'
);

export const isGovernedImplementProfile = (profile: TurnExecutionProfile): boolean => (
  profile === 'agent_implement_governed'
);

export const harnessShouldActivate = (profile: TurnExecutionProfile): boolean => (
  profile === 'agent_implement' || profile === 'plan_authoring'
);

// p-63 — the label formatter (with its display translations) lives in the i18n label module;
// re-exported here so existing importers keep working.
export { formatTurnProfileLabel } from '../../../shared/lib/appendoo/agentActivityLabels';
