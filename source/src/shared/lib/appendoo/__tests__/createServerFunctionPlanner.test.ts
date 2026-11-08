import { describe, expect, it } from 'vitest';
import { buildContextPackScaffold } from '../contextPackBuilder';
import { buildSemanticPlan } from '../semanticPlanBuilder';
import { deriveServerFunctionNameFromPrompt, canBuildCreateServerFunctionPlan } from '../createServerFunctionPlanner';

/**
 * V5 Phase P06 § 8.2 / EV-1 — the phase doc's own named acceptance scenario, verbatim: a prompt
 * requesting a brand-new server function must no longer fall through to the SCAFFOLD planner.
 */
describe('V5 P06 § 8.2 EV-1 — create-new-server-function planning', () => {
  // Matches the real EV-1 scenario (engineeringPipeline.liveActivation.test.ts): the operator has
  // already named the new function (e.g. via a "new function" flow) before the prompt — that
  // named-but-unresolvable functionId is the concrete signal this planner requires.
  const buildPack = (userPrompt: string, functionId = 'newExportFunction') => buildContextPackScaffold({
    applicationScope: {
      kind: 'platform',
      scopeKey: 'platform:studio:page:server-functions',
      mountId: 'studio',
      pageKey: 'server-functions',
    },
    pageContext: {
      path: '/us/studio/server-functions',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
      functionId,
    },
    userPrompt,
  });

  it('DoD: "create a new server function" produces an authoritative plan, not a SCAFFOLD', () => {
    const contextPack = buildPack('Add export server function for live activation', 'exportUsers');
    const plan = buildSemanticPlan({ applicationScope: null, contextPack, userPrompt: contextPack.userPrompt ?? 'Add export server function for live activation' });

    expect(plan.authority).toBe('VALIDATED');
    expect(plan.status).toBe('READY_FOR_APPROVAL');
    expect(plan.producer).toBe('create_server_function_planner');
    expect(plan.validation?.ok).toBe(true);
    expect(plan.blockingIssues).toEqual([]);
    expect(plan.proposedArtifacts.some((a) => a.kind === 'server_function' && a.action === 'create')).toBe(true);
    // targetRef must be the bare name (see createServerFunctionPlanner.ts's double-prefix comment)
    expect(plan.proposedArtifacts[0]?.targetRef).toBe('exportusers');
  });

  it('the Persian-language equivalent of the doc\'s own example prompt also produces an authoritative plan', () => {
    const prompt = 'Create a new server function that returns warehouse inventory';
    const contextPack = buildPack(prompt, 'inventoryReport');
    const plan = buildSemanticPlan({ applicationScope: null, contextPack, userPrompt: prompt });

    expect(plan.authority).toBe('VALIDATED');
    expect(plan.validation?.ok).toBe(true);
  });

  it('does NOT hijack a UI-intent prompt (that remains buildServerFunctionUiPlan\'s job)', () => {
    expect(canBuildCreateServerFunctionPlan(
      buildPack('build a form for math.sum-two-numbers'),
      'build a form for math.sum-two-numbers',
    )).toBe(false);
  });

  it('does NOT hijack a fully generic request with no concrete function name anywhere (stays SCAFFOLD — a real, intentional safety property)', () => {
    const contextPack = buildContextPackScaffold({
      applicationScope: { kind: 'platform', scopeKey: 'platform:studio:page:server-functions', mountId: 'studio', pageKey: 'server-functions' },
      pageContext: { path: '/us/studio/server-functions', pageLabel: 'Server Functions', pageKey: 'server-functions' },
      userPrompt: 'Add a list items API server function',
    });
    expect(canBuildCreateServerFunctionPlan(contextPack, 'Add a list items API server function')).toBe(false);
    const plan = buildSemanticPlan({ applicationScope: null, contextPack, userPrompt: 'Add a list items API server function' });
    expect(plan.authority).toBe('SCAFFOLD');
  });

  it('does NOT hijack a prompt targeting an existing, resolvable function (that is an edit, not a create)', () => {
    const contextPack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:server-functions',
        mountId: 'studio',
        pageKey: 'server-functions',
      },
      pageContext: { path: '/x', pageLabel: 'X', pageKey: 'server-functions', functionId: 'math.sum-two-numbers' },
      userPrompt: 'fix the validation in this server function',
    });
    // primaryTargets would include the resolved function in a real pipeline run — simulate that.
    contextPack.primaryTargets.push({ targetId: 't1', kind: 'function', ref: 'math.sum-two-numbers', label: 'Sum Two Numbers' });
    expect(canBuildCreateServerFunctionPlan(contextPack, 'fix the validation in this server function')).toBe(false);
  });

  it('deriveServerFunctionNameFromPrompt produces a real, deterministic, non-empty slug', () => {
    // "add"/"export"/"server"/"function"/"for" are filtered as stopwords — only real content words remain.
    expect(deriveServerFunctionNameFromPrompt('Add export server function for live activation')).toBe('live-activation');
    expect(deriveServerFunctionNameFromPrompt('')).toBe('custom-function');
  });
});
