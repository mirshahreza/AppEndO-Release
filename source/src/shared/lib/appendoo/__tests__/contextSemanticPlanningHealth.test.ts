import { describe, expect, it } from 'vitest';
import { probeContextSemanticPlanningScaffold } from '../contextSemanticPlanningHealth';

describe('contextSemanticPlanningHealth', () => {
  it('passes combined context and semantic planning probe', () => {
    const probe = probeContextSemanticPlanningScaffold();
    expect(probe.ok).toBe(true);
    expect(probe.failures).toEqual([]);
  });
});
