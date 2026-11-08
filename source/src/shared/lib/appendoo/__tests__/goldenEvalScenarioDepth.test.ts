import { describe, expect, it } from 'vitest';
import {
  DOC13_EXPECTED_SCENARIO_IDS,
  summarizeDoc13ScenarioDepth,
  validateDoc13ScenarioDepth,
} from '../goldenEvalScenarioDepth';

describe('goldenEvalScenarioDepth', () => {
  it('validates all doc 13 scenario ids and metadata depth', () => {
    const result = validateDoc13ScenarioDepth();
    expect(result.ok).toBe(true);
    expect(DOC13_EXPECTED_SCENARIO_IDS).toHaveLength(22);
  });

  it('summarizes catalog status distribution', () => {
    const summary = summarizeDoc13ScenarioDepth();
    expect(summary.scenarioCount).toBe(22);
    expect(summary.v34TargetCount).toBeGreaterThan(0);
    expect(summary.engineeringPipelineCount).toBeGreaterThan(0);
  });
});
