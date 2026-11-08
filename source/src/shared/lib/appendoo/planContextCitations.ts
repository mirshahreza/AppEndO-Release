import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan, ContextItemRef } from '../../api/contracts/appendoo/semanticPlan.types';

/**
 * V5 Phase P11 § V5-24 "Why this plan panel" — the phase doc explicitly forbids starting this
 * before Phase 05's real retrieval exists ("without Phase 05 these citations stay meaningless"). It
 * does: `ContextPack.selectionExplanations` (Phase 05/12) is real, computed retrieval-explanation
 * data, not a placeholder.
 *
 * DoD (literal): every plan needs an auditable list of `ContextItemRef`s that were actually
 * UTILIZED, not just discovered. `ContextItemUtilized` (the P04-reserved runtime event) is only
 * emitted from `AgentOrchestrator`'s agent-loop trajectory — a DIFFERENT execution path than
 * where `AppEndooSemanticPlan`s are built (`semanticPlanBuilder.ts`, driven by the engineering
 * pipeline, confirmed by direct inspection: `buildSemanticPlan` never touches
 * `AgentOrchestrator`/`recordRuntimeEvent`). Rather than force a cross-subsystem event dependency
 * that doesn't exist, this derives "utilized" from the mechanism THIS subsystem already has and
 * already trusts: `SemanticPlanArtifact.evidenceIds` — a context item is utilized if and only if
 * some proposed artifact actually cites it; everything else in `selectionExplanations` was
 * discovered/considered but not incorporated. Same underlying distinction the doc asks for
 * (discovered vs. utilized), grounded in a real, existing correlation instead of a new one.
 */
export const deriveContextItemRefsForPlan = (
  contextPack: ContextPack,
  plan: Pick<AppEndooSemanticPlan, 'proposedArtifacts'>,
): ContextItemRef[] => {
  const citedEvidenceIds = new Set(
    plan.proposedArtifacts.flatMap((artifact) => artifact.evidenceIds ?? []),
  );

  return contextPack.selectionExplanations.map((explanation) => ({
    contextItemId: explanation.evidenceId,
    reasonCode: explanation.reasonCode,
    summary: explanation.summary,
    utilized: citedEvidenceIds.has(explanation.evidenceId),
  }));
};
