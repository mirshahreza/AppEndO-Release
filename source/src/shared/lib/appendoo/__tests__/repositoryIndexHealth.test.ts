import { describe, expect, it, beforeEach } from 'vitest';
import { computeRepositoryIndexHealth } from '../repositoryIndexHealth';
import { resetCodebaseStructuralIndexForTests } from '../codebaseStructuralScaffold';

describe('V5 P05 § 7.4 — computeRepositoryIndexHealth (real canary, not asserted HEALTHY)', () => {
  beforeEach(() => {
    resetCodebaseStructuralIndexForTests();
  });

  it('reports HEALTHY syntax/symbols after indexing real canary files and finding the real symbols', () => {
    const health = computeRepositoryIndexHealth();
    expect(health.syntax.state).toBe('HEALTHY');
    expect(health.symbols.state).toBe('HEALTHY');
    expect(health.symbols.indexedItems).toBe(2);
  });

  it('honestly reports graph as NOT_AVAILABLE rather than fabricating HEALTHY', () => {
    const health = computeRepositoryIndexHealth();
    expect(health.graph.state).toBe('NOT_AVAILABLE');
  });

  it('every layer has a real, typed state', () => {
    const health = computeRepositoryIndexHealth();
    const validStates = ['HEALTHY', 'DEGRADED', 'FAILED', 'NOT_AVAILABLE'];
    for (const layer of Object.values(health)) {
      expect(validStates).toContain(layer.state);
    }
  });
});
