import { DEFAULT_GOLDEN_EVAL_THRESHOLDS } from '../../api/contracts/appendoo/goldenEval.types';
import { probeVerificationEngineScaffold } from './verificationEngineHealth';
import {
  evaluateGoldenEvalThresholdCompliance,
  type GoldenEvalSummaryInput,
} from './goldenEvalThresholdsScaffold';

export type GoldenEvalThresholdsHealthProbe = {
  ok: boolean;
  thresholdVersion: string;
  failures: string[];
};

/** AE-11.3 — health probe for versioned golden eval threshold config. */
export const probeGoldenEvalThresholdsScaffold = (
  summary: GoldenEvalSummaryInput,
  scaffoldProbePassCount: number,
  scaffoldProbeTotal: number,
): GoldenEvalThresholdsHealthProbe => {
  const verification = probeVerificationEngineScaffold();
  const compliance = evaluateGoldenEvalThresholdCompliance({
    summary,
    verificationGraderCount: verification.implementedGraderCount,
    scaffoldProbePassCount,
    scaffoldProbeTotal,
  });

  const failures = [...compliance.failures];
  if (compliance.thresholds.version !== DEFAULT_GOLDEN_EVAL_THRESHOLDS.version) {
    failures.push('Threshold version mismatch with default config.');
  }

  return {
    ok: failures.length === 0,
    thresholdVersion: compliance.thresholds.version,
    failures,
  };
};

export const validateGoldenEvalThresholdConfig = (
  thresholds = DEFAULT_GOLDEN_EVAL_THRESHOLDS,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (thresholds.requestClassAccuracyMin <= 0 || thresholds.requestClassAccuracyMin > 1) {
    errors.push('requestClassAccuracyMin must be in (0, 1].');
  }
  if (thresholds.releaseBlockingPassRateMin <= 0 || thresholds.releaseBlockingPassRateMin > 1) {
    errors.push('releaseBlockingPassRateMin must be in (0, 1].');
  }
  if (thresholds.labeledGatePassRateMin <= 0 || thresholds.labeledGatePassRateMin > 1) {
    errors.push('labeledGatePassRateMin must be in (0, 1].');
  }
  if (thresholds.minImplementedGraderCount < 1) {
    errors.push('minImplementedGraderCount must be >= 1.');
  }
  if (thresholds.minScaffoldProbePassRate <= 0 || thresholds.minScaffoldProbePassRate > 1) {
    errors.push('minScaffoldProbePassRate must be in (0, 1].');
  }

  return { ok: errors.length === 0, errors };
};
