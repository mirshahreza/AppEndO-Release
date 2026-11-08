import { describe, expect, it } from 'vitest';
import { getGoldenEvalCatalogHealth, validateGoldenEvalCatalog } from '../goldenEvalCatalog';
import { GOLDEN_EVAL_SCENARIOS } from '../../../api/contracts/appendoo/goldenEval.types';

describe('goldenEvalCatalog', () => {
  it('validates catalog integrity', () => {
    const result = validateGoldenEvalCatalog();
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports catalog health', () => {
    const health = getGoldenEvalCatalogHealth();
    expect(health.scenarioCount).toBe(GOLDEN_EVAL_SCENARIOS.length);
    expect(health.releaseBlockingCount).toBeGreaterThan(0);
  });
});
