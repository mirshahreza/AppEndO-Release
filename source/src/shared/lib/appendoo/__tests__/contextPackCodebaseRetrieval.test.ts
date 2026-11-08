import { describe, expect, it } from 'vitest';
import {
  buildContextPackScaffold,
  enrichContextPackWithCodebaseRetrieval,
} from '../contextPackBuilder';
import { probeContextPackCodebaseRetrievalEnrichment } from '../contextPackBuilderHealth';

describe('AE-4.2 contextPack codebase retrieval enrichment', () => {
  it('merges structural and similar implementation evidence', () => {
    const pack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      pageContext: { pageKey: 'users', pageLabel: 'Users' },
      userPrompt: 'Add export column',
    });

    const enriched = enrichContextPackWithCodebaseRetrieval(pack, {
      structuralEvidence: ['src/features/users/UsersPage.tsx:42#UsersGrid'],
      similarImplementations: ['src/features/settings/SettingsPage.tsx'],
      codebaseIndexVersion: 'codebase:1.0.0',
    });

    expect(enriched.structuralEvidence).toContain('src/features/users/UsersPage.tsx:42#UsersGrid');
    expect(enriched.similarImplementations.length).toBeGreaterThan(0);
    expect(enriched.indexVersions.codebaseIndex).toBe('codebase:1.0.0');
  });

  it('passes health probe', () => {
    expect(probeContextPackCodebaseRetrievalEnrichment().ok).toBe(true);
  });
});
