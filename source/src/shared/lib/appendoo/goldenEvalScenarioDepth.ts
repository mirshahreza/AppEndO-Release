import type { GoldenEvalScenario } from '../../api/contracts/appendoo/goldenEval.types';
import { GOLDEN_EVAL_SCENARIOS } from '../../api/contracts/appendoo/goldenEval.types';

export const DOC13_EXPECTED_SCENARIO_IDS = [
  ...Array.from({ length: 20 }, (_, index) => `GE-${String(index + 1).padStart(3, '0')}`),
  'GE-SF-UI-001',
  'GE-022',
];

/** AE-11.9 — doc `13` scenario catalog depth validation (metadata + status rules). */
export const validateDoc13ScenarioDepth = (
  scenarios: GoldenEvalScenario[] = GOLDEN_EVAL_SCENARIOS,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  const ids = scenarios.map((scenario) => scenario.scenarioId);

  for (const expectedId of DOC13_EXPECTED_SCENARIO_IDS) {
    if (!ids.includes(expectedId)) {
      errors.push(`Missing doc \`13\` scenario ${expectedId}.`);
    }
  }

  if (scenarios.length !== DOC13_EXPECTED_SCENARIO_IDS.length) {
    errors.push(`Expected ${DOC13_EXPECTED_SCENARIO_IDS.length} scenarios, found ${scenarios.length}.`);
  }

  for (const scenario of scenarios) {
    if (!scenario.title.trim()) {
      errors.push(`${scenario.scenarioId}: title is required.`);
    }
    if (!scenario.kind) {
      errors.push(`${scenario.scenarioId}: kind is required.`);
    }
    if (scenario.metrics.length === 0) {
      errors.push(`${scenario.scenarioId}: at least one metric is required.`);
    }

    if (scenario.catalogStatus === 'FUTURE_ECOSYSTEM' && scenario.releaseBlocking) {
      errors.push(`${scenario.scenarioId}: FUTURE_ECOSYSTEM cannot be release-blocking.`);
    }

    if (scenario.catalogStatus === 'V3_4_TARGET' && scenario.expectEngineeringPipeline !== true) {
      const engineeringQuery = scenario.expectedRequestClass === 'ENGINEERING_QUERY';
      const agentLoopChange = scenario.expectedRequestClass === 'ENGINEERING_CHANGE';
      if (!engineeringQuery && !agentLoopChange) {
        errors.push(`${scenario.scenarioId}: V3_4_TARGET must route to engineering pipeline, query, or agent-loop change.`);
      }
    }

    if (scenario.expectEngineeringPipeline && scenario.expectedRequestClass !== 'ENGINEERING_CHANGE') {
      errors.push(`${scenario.scenarioId}: expectEngineeringPipeline requires ENGINEERING_CHANGE routing.`);
    }
  }

  return { ok: errors.length === 0, errors };
};

export const summarizeDoc13ScenarioDepth = (
  scenarios: GoldenEvalScenario[] = GOLDEN_EVAL_SCENARIOS,
) => ({
  scenarioCount: scenarios.length,
  availableNowCount: scenarios.filter((item) => item.catalogStatus === 'AVAILABLE_NOW').length,
  v34TargetCount: scenarios.filter((item) => item.catalogStatus === 'V3_4_TARGET').length,
  packageDependentCount: scenarios.filter((item) => item.catalogStatus === 'PACKAGE_DEPENDENT').length,
  futureEcosystemCount: scenarios.filter((item) => item.catalogStatus === 'FUTURE_ECOSYSTEM').length,
  engineeringPipelineCount: scenarios.filter((item) => item.expectEngineeringPipeline).length,
});
