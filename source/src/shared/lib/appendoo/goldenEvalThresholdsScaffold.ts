import type { GoldenEvalRunResult, GoldenEvalThresholds } from '../../api/contracts/appendoo/goldenEval.types';
import { DEFAULT_GOLDEN_EVAL_THRESHOLDS } from '../../api/contracts/appendoo/goldenEval.types';

export type GoldenEvalSummaryInput = {
  total: number;
  passed: number;
  failed: number;
  releaseBlockingFailures: number;
  requestClassAccuracy: number;
  releaseBlockingTotal: number;
  releaseBlockingPassed: number;
  labeledGateTotal: number;
  labeledGatePassed: number;
};

export type GoldenEvalThresholdComplianceInput = {
  summary: GoldenEvalSummaryInput;
  verificationGraderCount: number;
  scaffoldProbePassCount: number;
  scaffoldProbeTotal: number;
};

export type GoldenEvalThresholdComplianceResult = {
  ok: boolean;
  failures: string[];
  thresholds: GoldenEvalThresholds;
};

/** AE-11.3 — versioned threshold evaluation for CI and release-candidate gates. */
export const evaluateGoldenEvalThresholdCompliance = (
  input: GoldenEvalThresholdComplianceInput,
  thresholds: GoldenEvalThresholds = DEFAULT_GOLDEN_EVAL_THRESHOLDS,
): GoldenEvalThresholdComplianceResult => {
  const failures: string[] = [];

  if (input.summary.requestClassAccuracy < thresholds.requestClassAccuracyMin) {
    failures.push(
      `requestClassAccuracy ${input.summary.requestClassAccuracy.toFixed(3)} `
      + `< min ${thresholds.requestClassAccuracyMin}.`,
    );
  }

  if (input.summary.releaseBlockingFailures > thresholds.engineeringBypassMax) {
    failures.push(
      `releaseBlockingFailures ${input.summary.releaseBlockingFailures} `
      + `> max ${thresholds.engineeringBypassMax}.`,
    );
  }

  const releaseBlockingPassRate = input.summary.releaseBlockingTotal > 0
    ? input.summary.releaseBlockingPassed / input.summary.releaseBlockingTotal
    : 1;
  if (releaseBlockingPassRate < thresholds.releaseBlockingPassRateMin) {
    failures.push(
      `releaseBlockingPassRate ${releaseBlockingPassRate.toFixed(3)} `
      + `< min ${thresholds.releaseBlockingPassRateMin}.`,
    );
  }

  const labeledGatePassRate = input.summary.labeledGateTotal > 0
    ? input.summary.labeledGatePassed / input.summary.labeledGateTotal
    : 1;
  if (labeledGatePassRate < thresholds.labeledGatePassRateMin) {
    failures.push(
      `labeledGatePassRate ${labeledGatePassRate.toFixed(3)} `
      + `< min ${thresholds.labeledGatePassRateMin}.`,
    );
  }

  if (input.verificationGraderCount < thresholds.minImplementedGraderCount) {
    failures.push(
      `implementedGraderCount ${input.verificationGraderCount} `
      + `< min ${thresholds.minImplementedGraderCount}.`,
    );
  }

  const scaffoldProbePassRate = input.scaffoldProbeTotal > 0
    ? input.scaffoldProbePassCount / input.scaffoldProbeTotal
    : 1;
  if (scaffoldProbePassRate < thresholds.minScaffoldProbePassRate) {
    failures.push(
      `scaffoldProbePassRate ${scaffoldProbePassRate.toFixed(3)} `
      + `< min ${thresholds.minScaffoldProbePassRate}.`,
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    thresholds,
  };
};

export const summarizeLabeledGateResults = (results: GoldenEvalRunResult[]) => {
  const labeled = results.filter((result) => result.scenarioId.endsWith('-STATUS'));
  return {
    labeledGateTotal: labeled.filter((result) => result.releaseBlocking).length,
    labeledGatePassed: labeled.filter((result) => result.releaseBlocking && result.passed).length,
  };
};
