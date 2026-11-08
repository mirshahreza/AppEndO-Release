import { describe, expect, it } from 'vitest';
import { DEFAULT_GOLDEN_EVAL_THRESHOLDS } from '../../../api/contracts/appendoo/goldenEval.types';
import { evaluateGoldenEvalThresholdCompliance } from '../goldenEvalThresholdsScaffold';

describe('goldenEvalThresholdsScaffold', () => {
  it('passes when summary and probes meet versioned thresholds', () => {
    const result = evaluateGoldenEvalThresholdCompliance({
      summary: {
        total: 19,
        passed: 19,
        failed: 0,
        releaseBlockingFailures: 0,
        releaseBlockingTotal: 10,
        releaseBlockingPassed: 10,
        requestClassAccuracy: 0.95,
        labeledGateTotal: 8,
        labeledGatePassed: 8,
      },
      verificationGraderCount: 13,
      scaffoldProbePassCount: 10,
      scaffoldProbeTotal: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.thresholds.version).toBe(DEFAULT_GOLDEN_EVAL_THRESHOLDS.version);
  });

  it('fails when request class accuracy is below threshold', () => {
    const result = evaluateGoldenEvalThresholdCompliance({
      summary: {
        total: 19,
        passed: 10,
        failed: 9,
        releaseBlockingFailures: 0,
        releaseBlockingTotal: 10,
        releaseBlockingPassed: 10,
        requestClassAccuracy: 0.5,
        labeledGateTotal: 8,
        labeledGatePassed: 8,
      },
      verificationGraderCount: 13,
      scaffoldProbePassCount: 10,
      scaffoldProbeTotal: 10,
    });

    expect(result.ok).toBe(false);
  });
});
