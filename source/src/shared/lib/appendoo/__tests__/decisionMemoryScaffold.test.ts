import { describe, expect, it, beforeEach } from 'vitest';
import {
  getDecisionMemoryHealth,
  promoteDecision,
  proposeDecision,
  resetDecisionMemoryForTests,
  resolveTerm,
} from '../decisionMemoryScaffold';

describe('decisionMemoryScaffold', () => {
  beforeEach(() => {
    resetDecisionMemoryForTests();
  });

  it('resolves English aliases to canonical concepts', () => {
    const resolution = resolveTerm('AppEndoo assistant', 'platform:studio');
    expect(resolution.confidence).toBeGreaterThan(0);
    expect(resolution.canonicalConcepts.length).toBeGreaterThan(0);
    expect(resolution.matchedDecisionIds).toContain('sem.app-endoo-brand');
  });

  it('keeps proposed decisions out of active term resolution authority', () => {
    proposeDecision({
      applicationScopeRef: 'platform:studio',
      type: 'SEMANTIC_DECISION',
      title: 'Temporary glossary',
      canonicalStatement: 'Foo means Bar.',
      terms: ['foo-term'],
      multilingualAliases: { en: ['foo-term'] },
      excludedMeanings: [],
      sourceRefs: ['test'],
    });

    const resolution = resolveTerm('foo-term', 'platform:studio');
    expect(resolution.confidence).toBe(0);
    expect(getDecisionMemoryHealth().proposedDecisionCount).toBe(1);
  });

  it('promotes proposed decision to active governance authority', () => {
    const proposed = proposeDecision({
      applicationScopeRef: 'platform:studio',
      type: 'ADR',
      title: 'Export column policy',
      canonicalStatement: 'User export requires audit log entry.',
      terms: ['export column'],
      multilingualAliases: { en: ['export'] },
      excludedMeanings: [],
      sourceRefs: ['test'],
    });

    const promoted = promoteDecision(proposed.decisionId);
    expect(promoted?.status).toBe('ACTIVE');
    expect(getDecisionMemoryHealth().proposedDecisionCount).toBe(0);

    const resolution = resolveTerm('export column', 'platform:studio');
    expect(resolution.confidence).toBeGreaterThan(0);
  });
});
