import { describe, expect, it, beforeEach } from 'vitest';
import {
  hybridRetrieveFromCandidates,
  rankHybridRetrievalHits,
  resetSemanticRetrievalStoreForTests,
} from '../semanticRetrievalScaffold';

describe('semanticRetrievalScaffold', () => {
  beforeEach(() => {
    resetSemanticRetrievalStoreForTests();
  });

  it('prioritizes exact symbol matches over lexical-only hits', () => {
    const hits = rankHybridRetrievalHits('UsersPage', [
      {
        path: 'src/features/users/UsersPage.tsx',
        startLine: 10,
        endLine: 20,
        symbol: 'UsersPage',
        lexicalScore: 3,
        exactMatch: true,
      },
      {
        path: 'src/features/dashboard/DashboardPage.tsx',
        startLine: 4,
        endLine: 12,
        lexicalScore: 8,
      },
    ]);

    expect(hits[0]?.exactMatch).toBe(true);
    expect(hits[0]?.symbol).toBe('UsersPage');
  });

  it('returns hybrid retrieval result with policy version', () => {
    const result = hybridRetrieveFromCandidates({
      query: 'buildContextPackScaffold',
      applicationScopeRef: 'platform:studio',
      candidates: [
        {
          path: 'src/shared/lib/appendoo/contextPackBuilder.ts',
          startLine: 1,
          endLine: 3,
          symbol: 'buildContextPackScaffold',
          lexicalScore: 5,
          exactMatch: true,
        },
      ],
    });

    expect(result.hits).toHaveLength(1);
    expect(result.exactMatchCount).toBe(1);
    expect(result.policyVersion).toBe('1.0.0');
  });
});
