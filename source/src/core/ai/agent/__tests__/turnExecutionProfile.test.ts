import { describe, expect, it } from 'vitest';
import { resolveTurnExecutionProfile } from '../turnExecutionProfile';

/**
 * p-61 Phase B — profile resolution is deterministic from explicit user choices only
 * (mode + Plan/Act toggle + explicit governed phrases). Agent mode always gets the full
 * toolset; question-vs-build is the model's decision inside the loop, so content-based
 * routing (which misrouted every non-English request to lookup) is gone.
 */
describe('turnExecutionProfile', () => {
  it('forces ask mode to lookup regardless of message', () => {
    expect(resolveTurnExecutionProfile('ask', 'Build a CRUD')).toBe('ask_lookup');
    expect(resolveTurnExecutionProfile('ask', 'ask: what is the grid standard?')).toBe('ask_lookup');
  });

  it('agent mode always resolves to implement — questions included', () => {
    expect(resolveTurnExecutionProfile('agent', 'Where is VibeHarness defined?')).toBe('agent_implement');
    expect(resolveTurnExecutionProfile('agent', 'ask: what is the grid standard?')).toBe('agent_implement');
    expect(resolveTurnExecutionProfile('agent', 'hello')).toBe('agent_implement');
  });

  it('agent mode resolves to implement for non-English requests (the F1 regression)', () => {
    expect(resolveTurnExecutionProfile('agent', 'برای این API یک اینترفیس بساز')).toBe('agent_implement');
    expect(resolveTurnExecutionProfile('agent', 'یک تابع سرور برای جمع دو عدد بساز')).toBe('agent_implement');
  });

  it('routes governed engineering to agent_implement_governed profile', () => {
    expect(resolveTurnExecutionProfile('agent', 'Export to package with architect approval'))
      .toBe('agent_implement_governed');
    expect(resolveTurnExecutionProfile('agent', 'governed package export with architect approval'))
      .toBe('agent_implement_governed');
  });

  it('routes clear implementation requests to agent_implement', () => {
    expect(resolveTurnExecutionProfile('agent', 'Build a CRUD with a grid')).toBe('agent_implement');
    expect(resolveTurnExecutionProfile('agent', 'build user interface for sum-two-numbers')).toBe('agent_implement');
    expect(resolveTurnExecutionProfile('agent', 'continue')).toBe('agent_implement');
  });

  it('resolves implement on and off studio pages alike', () => {
    const studioPage = {
      path: '/us/studio/server-functions/math/sum-two-numbers',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
      functionId: 'math.sum-two-numbers',
    };
    expect(resolveTurnExecutionProfile('agent', 'grid', studioPage)).toBe('agent_implement');
    expect(resolveTurnExecutionProfile('agent', 'grid')).toBe('agent_implement');
  });

  it('honors agent Plan/Act toggle (C.3) — the only lookup-style path left in agent mode', () => {
    expect(resolveTurnExecutionProfile('agent', 'Build a CRUD', undefined, { agentPlanActMode: 'review' }))
      .toBe('agent_plan_review');
    expect(resolveTurnExecutionProfile('agent', 'ask: what is the grid standard?', undefined, { agentPlanActMode: 'implement' }))
      .toBe('agent_implement');
  });

  it('plan mode resolves to plan authoring', () => {
    expect(resolveTurnExecutionProfile('plan', 'evolve the design doc')).toBe('plan_authoring');
  });
});
