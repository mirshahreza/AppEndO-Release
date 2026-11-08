import { describe, expect, it } from 'vitest';
import {
  buildContextPackScaffold,
  enrichContextPackWithMemoryKnowledge,
} from '../contextPackBuilder';
import { probeContextPackMemoryKnowledgeEnrichment } from '../contextPackBuilderHealth';

describe('AE-5.2 contextPack memory/knowledge enrichment', () => {
  it('merges governance, capabilities, and trusted patterns', () => {
    const pack = buildContextPackScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      pageContext: { pageKey: 'users', pageLabel: 'Users' },
    });

    const enriched = enrichContextPackWithMemoryKnowledge(pack, {
      governance: ['Engineering changes require V3 pipeline.'],
      capabilityEvidence: ['capability:appendo-files', 'capability:appendo-codebase'],
      trustedPatterns: ['pattern.crud-grid-export'],
      decisionMemoryVersion: '1.0.0',
      capabilitySnapshotVersion: '1.0.0:agent:',
    });

    expect(enriched.governance.length).toBeGreaterThan(0);
    expect(enriched.capabilityEvidence).toContain('capability:appendo-files');
    expect(enriched.indexVersions.decisionMemory).toBe('1.0.0');
  });

  it('passes health probe', () => {
    expect(probeContextPackMemoryKnowledgeEnrichment().ok).toBe(true);
  });
});
