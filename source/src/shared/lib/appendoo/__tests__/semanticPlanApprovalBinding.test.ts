import { describe, expect, it } from 'vitest';
import { buildContextPackScaffold } from '../contextPackBuilder';
import { buildSemanticPlanScaffold } from '../semanticPlanBuilder';
import { validateApprovalBindingAttribution } from '../semanticPlanCompositionScaffold';

describe('AE-6.2 approval binding attribution validation', () => {
  it('rejects plan/context revision drift against binding', () => {
    const contextPack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:server-functions',
        mountId: 'studio',
        pageKey: 'server-functions',
      },
      pageContext: { pageKey: 'server-functions', pageLabel: 'Server Functions' },
      userPrompt: 'Add health check',
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
      },
      userPrompt: 'Add health check',
    });

    const valid = validateApprovalBindingAttribution(plan, contextPack, {
      planId: plan.planId,
      planRevision: plan.revision,
      contextPackId: contextPack.contextPackId,
      contextPackRevision: contextPack.revision,
      fingerprint: 'fp:test',
    });

    expect(valid.ok).toBe(true);

    const drifted = validateApprovalBindingAttribution(plan, contextPack, {
      planId: plan.planId,
      planRevision: plan.revision + 1,
      contextPackId: contextPack.contextPackId,
      contextPackRevision: contextPack.revision,
      fingerprint: 'fp:test',
    });

    expect(drifted.ok).toBe(false);
    expect(drifted.issues.some((issue) => issue.code === 'ASP-BIND-02')).toBe(true);
  });
});
