import { describe, expect, it } from 'vitest';
import { buildContextPackScaffold, summarizeContextPack } from '../contextPackBuilder';

describe('buildContextPackScaffold', () => {
  it('builds primary targets from page context and scope', () => {
    const pack = buildContextPackScaffold({
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
        functionId: 'demo.fn',
        functionName: 'demoFn',
      },
      correlationId: 'run-1',
    });

    expect(pack.applicationScopeRef).toBe('platform:studio:page:server-functions');
    expect(pack.primaryTargets.some((target) => target.kind === 'page')).toBe(true);
    expect(pack.primaryTargets.some((target) => target.kind === 'function')).toBe(true);
    expect(pack.engineeringStandards.length).toBeGreaterThan(0);
    expect(pack.selectionExplanations.length).toBeGreaterThan(0);
    expect(pack.tokenBudget).toBeGreaterThan(0);
  });

  it('prioritizes prompt-named function targets over unrelated page context', () => {
    const pack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      pageContext: {
        path: '/us/studio/users',
        pageLabel: 'Users',
        pageKey: 'users',
      },
      userPrompt: 'Build a user interface for math.sum-two-numbers',
      correlationId: 'run-cross-page',
    });

    expect(pack.primaryTargets.some((target) => target.ref === 'math.sum-two-numbers')).toBe(true);
    expect(pack.primaryTargets.some((target) => target.ref === 'users')).toBe(false);
  });

  it('summarizes context pack for routing telemetry', () => {
    const pack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio',
        mountId: 'studio',
      },
      pageContext: {
        path: '/us/studio/settings',
        pageLabel: 'Settings',
        pageKey: 'settings',
      },
    });

    const summary = summarizeContextPack(pack);
    expect(summary.contextPackId).toBe(pack.contextPackId);
    expect(summary.primaryTargetCount).toBe(pack.primaryTargets.length);
    expect(summary.standardsCount).toBe(pack.engineeringStandards.length);
  });
});
