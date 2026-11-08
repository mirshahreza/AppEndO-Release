import { buildContextPackScaffold } from './contextPackBuilder';
import { resolvePlanActionPolicy } from './semanticPlanAuthorityGates';
import { enrichContextPackWithRanking } from './contextRankingScaffold';
import { buildSemanticPlanScaffold } from './semanticPlanBuilder';

export const APPENDOO_CONTEXT_SEMANTIC_PLANNING_HEALTH_VERSION = '1.1.0';

export type ContextSemanticPlanningHealthProbe = {
  ok: boolean;
  rankingPolicyVersion: string;
  planCompilerVersion: string;
  failures: string[];
};

/** AE-6.1/6.2 — health probe for context ranking + semantic planning depth. */
export const probeContextSemanticPlanningScaffold = (): ContextSemanticPlanningHealthProbe => {
  const failures: string[] = [];

  const basePack = buildContextPackScaffold({
    applicationScope: {
      kind: 'platform',
      scopeKey: 'platform:studio:page:users',
      mountId: 'studio',
      pageKey: 'users',
    },
    pageContext: {
      pageKey: 'users',
      pageLabel: 'Users',
    },
    userPrompt: 'Add export to users grid',
    tokenBudget: 8000,
  });

  const ranked = enrichContextPackWithRanking({
    ...basePack,
    governance: ['Engineering changes require V3 pipeline.'],
    capabilityEvidence: ['capability:appendo-files'],
    structuralEvidence: ['src/features/users/UsersPage.tsx:10#UsersPage'],
  }, 'Add export to users grid');

  if (ranked.selectionExplanations.length === 0) {
    failures.push('Ranking pipeline produced no selection explanations.');
  }
  if (ranked.trustedPatterns.length === 0 && ranked.primaryTargets.some((target) => target.ref === 'users')) {
    // patterns optional when no match — not a failure
  }

  const plan = buildSemanticPlanScaffold({
    applicationScope: {
      kind: 'platform',
      scopeKey: 'platform:studio:page:users',
      mountId: 'studio',
      pageKey: 'users',
    },
    contextPack: ranked,
    userPrompt: 'Add export to users grid',
  });

  if (plan.authority !== 'SCAFFOLD') {
    failures.push('Expected scaffold authority for generic planning probe.');
  }
  if (resolvePlanActionPolicy(plan).canApprove) {
    failures.push('Scaffold plan must not be approvable.');
  }
  if (!plan.compositionCandidates?.length) {
    failures.push('Semantic plan missing composition candidates.');
  }
  if (plan.reuseSummary?.compositeReuseScore === undefined) {
    failures.push('Semantic plan missing reuse summary.');
  }

  return {
    ok: failures.length === 0,
    rankingPolicyVersion: ranked.indexVersions.retrievalPolicy,
    planCompilerVersion: '1.0.0',
    failures,
  };
};
