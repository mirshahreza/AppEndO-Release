import { describe, expect, it } from 'vitest';
import { deriveContextItemRefsForPlan } from '../planContextCitations';
import type { ContextPack } from '../../../api/contracts/appendoo/contextPack.types';
import type { SemanticPlanArtifact } from '../../../api/contracts/appendoo/semanticPlan.types';

const baseContextPack = (): ContextPack => ({
  contextPackId: 'ctxpack:test',
  revision: 1,
  applicationScopeRef: 'platform:studio:page:users',
  indexVersions: { knowledgeRegistry: '1', retrievalPolicy: '1' },
  tokenBudget: 8000,
  primaryTargets: [],
  dependencies: [],
  governance: [],
  businessRules: [],
  permissions: [],
  structuralEvidence: [],
  similarImplementations: [],
  trustedPatterns: [],
  engineeringStandards: [],
  capabilityEvidence: [],
  capabilityGaps: [],
  relevantChanges: [],
  excludedCandidates: [],
  unresolvedTerms: [],
  conflicts: [],
  selectionExplanations: [
    { reasonCode: 'EXACT_TARGET', evidenceId: 'ev-utilized', summary: 'Cited in the final plan.' },
    { reasonCode: 'SIMILAR_FEATURE', evidenceId: 'ev-discovered-only', summary: 'Considered but not used.' },
  ],
});

describe('V5 P11 § V5-24 — deriveContextItemRefsForPlan ("why this plan" audit trail)', () => {
  it('marks a context item utilized when a proposed artifact actually cites it', () => {
    const artifacts: SemanticPlanArtifact[] = [{
      artifactId: 'artifact:1',
      kind: 'page',
      title: 'Test',
      action: 'modify',
      evidenceIds: ['ev-utilized'],
    }];

    const refs = deriveContextItemRefsForPlan(baseContextPack(), { proposedArtifacts: artifacts });

    expect(refs).toHaveLength(2);
    expect(refs.find((r) => r.contextItemId === 'ev-utilized')?.utilized).toBe(true);
    expect(refs.find((r) => r.contextItemId === 'ev-discovered-only')?.utilized).toBe(false);
  });

  it('marks every context item as not-utilized when no artifact cites anything (pure discovery, no incorporation)', () => {
    const refs = deriveContextItemRefsForPlan(baseContextPack(), { proposedArtifacts: [] });
    expect(refs.every((r) => r.utilized === false)).toBe(true);
  });

  it('preserves reasonCode/summary from the real selectionExplanations, not fabricated text', () => {
    const refs = deriveContextItemRefsForPlan(baseContextPack(), { proposedArtifacts: [] });
    const item = refs.find((r) => r.contextItemId === 'ev-utilized');
    expect(item?.reasonCode).toBe('EXACT_TARGET');
    expect(item?.summary).toBe('Cited in the final plan.');
  });
});
