import { describe, expect, it } from 'vitest';
import { contextIntelligenceService } from '../contextIntelligence.service';

describe('contextIntelligenceService', () => {
  it('builds run context pack with feature graph version when available', () => {
    const pack = contextIntelligenceService.buildRunContextPack({
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
      userPrompt: 'How does user management work?',
    });

    expect(pack.contextPackId).toMatch(/^ctxpack:/);
    expect(pack.indexVersions.knowledgeRegistry).toBeTruthy();
    expect(pack.primaryTargets.length).toBeGreaterThan(0);
    expect(pack.selectionExplanations.length).toBeGreaterThan(0);
    expect(pack.capabilityEvidence.length).toBeGreaterThan(0);
    expect(pack.indexVersions.retrievalPolicy).toBeTruthy();
  });
});
