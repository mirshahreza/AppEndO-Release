import { describe, expect, it } from 'vitest';
import { probeGoldenEvalThresholdsScaffold, validateGoldenEvalThresholdConfig } from '../goldenEvalThresholdsHealth';

describe('goldenEvalThresholdsHealth', () => {
  it('validates default threshold config', () => {
    expect(validateGoldenEvalThresholdConfig().ok).toBe(true);
  });

  it('passes probe with healthy summary', () => {
    const probe = probeGoldenEvalThresholdsScaffold({
      total: 19,
      passed: 19,
      failed: 0,
      releaseBlockingFailures: 0,
      releaseBlockingTotal: 10,
      releaseBlockingPassed: 10,
      requestClassAccuracy: 0.95,
      labeledGateTotal: 8,
      labeledGatePassed: 8,
    }, 10, 10);

    expect(probe.ok).toBe(true);
  });
});
