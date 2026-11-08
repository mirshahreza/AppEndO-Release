import { describe, expect, it } from 'vitest';
import { buildSemanticPlanScaffold } from '../semanticPlanBuilder';
import { buildContextPackScaffold } from '../contextPackBuilder';

describe('semanticPlanCompositionScaffold', () => {
  it('builds composition candidates and reuse summary on ASP', () => {
    const contextPack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:server-functions',
        mountId: 'studio',
        pageKey: 'server-functions',
      },
      pageContext: {
        pageKey: 'server-functions',
        pageLabel: 'Server Functions',
      },
      userPrompt: 'Add health check endpoint',
    });

    const plan = buildSemanticPlanScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:server-functions',
        mountId: 'studio',
        pageKey: 'server-functions',
      },
      contextPack: {
        ...contextPack,
        capabilityEvidence: ['capability:appendo-server-functions'],
        trustedPatterns: ['pattern.ref-hello-api'],
        selectionExplanations: [{
          reasonCode: 'EXACT_TARGET',
          evidenceId: 'page:server-functions',
          summary: 'Primary page target.',
        }],
      },
      userPrompt: 'Add health check endpoint',
    });

    expect(plan.compositionCandidates?.length).toBeGreaterThan(0);
    expect(plan.reuseSummary?.compositeReuseScore).toBeDefined();
    // AE-HARDEN: scaffold plans never carry executable authority — validation.ok is
    // forced false and PLANNING_NOT_IMPLEMENTED is attached so callers can't approve
    // a plan the vertical-slice planner didn't actually produce (see semanticPlanBuilder.ts).
    expect(plan.validation?.ok).toBe(false);
    expect(plan.blockingIssues?.some((issue) => issue.code === 'PLANNING_NOT_IMPLEMENTED')).toBe(true);
    expect(plan.requestedOutcomes?.length).toBeGreaterThan(0);
  });
});
