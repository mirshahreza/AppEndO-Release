import type {
  GoldenEvalCatalogHealth,
  GoldenEvalScenario,
} from '../../api/contracts/appendoo/goldenEval.types';
import {
  DEFAULT_GOLDEN_EVAL_THRESHOLDS,
  GOLDEN_EVAL_CATALOG_VERSION,
  GOLDEN_EVAL_SCENARIOS,
} from '../../api/contracts/appendoo/goldenEval.types';

export const validateGoldenEvalCatalog = (
  scenarios: GoldenEvalScenario[] = GOLDEN_EVAL_SCENARIOS,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const scenario of scenarios) {
    if (ids.has(scenario.scenarioId)) {
      errors.push(`Duplicate scenarioId: ${scenario.scenarioId}`);
    }
    ids.add(scenario.scenarioId);

    if (!scenario.prompt.trim()) {
      errors.push(`${scenario.scenarioId}: prompt is required.`);
    }

    if (scenario.metrics.length === 0) {
      errors.push(`${scenario.scenarioId}: at least one metric is required.`);
    }

    if (scenario.catalogStatus === 'FUTURE_ECOSYSTEM' && scenario.releaseBlocking) {
      errors.push(`${scenario.scenarioId}: FUTURE_ECOSYSTEM cannot be release-blocking.`);
    }
  }

  return { ok: errors.length === 0, errors };
};

export const getGoldenEvalCatalogHealth = (): GoldenEvalCatalogHealth => ({
  catalogVersion: GOLDEN_EVAL_CATALOG_VERSION,
  scenarioCount: GOLDEN_EVAL_SCENARIOS.length,
  releaseBlockingCount: GOLDEN_EVAL_SCENARIOS.filter((scenario) => scenario.releaseBlocking).length,
  thresholdVersion: DEFAULT_GOLDEN_EVAL_THRESHOLDS.version,
});
