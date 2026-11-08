import { describe, expect, it } from 'vitest';
import { buildContextPackScaffold } from '../contextPackBuilder';
import {
  applyContextTokenBudget,
  buildContextRankingCandidates,
  enrichContextPackWithRanking,
} from '../contextRankingScaffold';

describe('contextRankingScaffold', () => {
  it('prioritizes hard-include governing decisions in ranking', () => {
    const pack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      pageContext: { pageKey: 'users', pageLabel: 'Users' },
      tokenBudget: 8000,
    });

    const candidates = buildContextRankingCandidates({
      ...pack,
      governance: ['Active ADR requires pipeline approval.'],
    }, 'users grid');

    const ranking = applyContextTokenBudget(candidates, 8000);
    expect(ranking.overflow).toBe(false);
    expect(ranking.selectedCandidateIds.length).toBeGreaterThan(0);
  });

  it('returns CONTEXT_OVERFLOW when hard includes exceed budget', () => {
    const pack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio',
        mountId: 'studio',
      },
      tokenBudget: 10,
    });

    const enriched = enrichContextPackWithRanking({
      ...pack,
      governance: ['x'.repeat(400)],
      engineeringStandards: pack.engineeringStandards,
    });

    expect(enriched.overflow).toBe('CONTEXT_OVERFLOW');
  });
});
