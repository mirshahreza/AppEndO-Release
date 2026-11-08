import { describe, expect, it } from 'vitest';
import {
  getAppendooProductionOpsHealth,
  probeAppendooProductionOps,
} from '../appendooProductionOpsHealth';
import { probeContextPackEnrichmentProductionDepth } from '../contextPackBuilderHealth';

describe('appendooProductionOpsHealth', () => {
  it('reports production ops health snapshot', () => {
    const health = getAppendooProductionOpsHealth();
    expect(health.version).toBe('1.0.0');
    expect(health.cutoverEnabled).toBe(true);
    expect(health.contextPackEnrichmentOk).toBe(true);
  });

  it('passes aggregate production ops probe under cutover', () => {
    const probe = probeAppendooProductionOps();
    expect(probe.ok).toBe(true);
    expect(probe.failures).toHaveLength(0);
  });

  it('passes combined context pack enrichment production depth', () => {
    const probe = probeContextPackEnrichmentProductionDepth();
    expect(probe.ok).toBe(true);
    expect(probe.applicationIntelligenceOk).toBe(true);
    expect(probe.codebaseRetrievalOk).toBe(true);
    expect(probe.memoryKnowledgeOk).toBe(true);
  });
});
