import { describe, expect, it } from 'vitest';
import { probeMemoryKnowledgeCapabilitiesScaffold } from '../memoryKnowledgeCapabilitiesHealth';

describe('memoryKnowledgeCapabilitiesHealth', () => {
  it('passes combined memory/knowledge/capabilities probe', () => {
    const probe = probeMemoryKnowledgeCapabilitiesScaffold();
    expect(probe.ok).toBe(true);
    expect(probe.patternCount).toBeGreaterThan(0);
    expect(probe.failures).toEqual([]);
  });
});
