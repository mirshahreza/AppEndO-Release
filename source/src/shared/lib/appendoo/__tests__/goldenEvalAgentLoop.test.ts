import { describe, expect, it } from 'vitest';
import {
  evaluateAllV4AgentLoopGoldenScenarios,
  evaluateGeAgentRetrieve_001,
  evaluateGeAgentWf4_001,
  evaluateGeUxActivity_001,
  GE_AGENT_RETRIEVE_001_SCENARIO_ID,
  GE_AGENT_WF4_001_SCENARIO_ID,
  GE_UX_ACTIVITY_001_SCENARIO_ID,
} from '../goldenEvalAgentLoop';

describe('goldenEvalAgentLoop (P4.1 / P4.2 / P4.4)', () => {
  it('passes GE-AGENT-WF4-001 routing assertions', () => {
    const result = evaluateGeAgentWf4_001();
    expect(result.scenarioId).toBe(GE_AGENT_WF4_001_SCENARIO_ID);
    expect(result.passed, result.failures.join('; ')).toBe(true);
  });

  it('passes GE-AGENT-RETRIEVE-001 gate assertions', () => {
    const result = evaluateGeAgentRetrieve_001();
    expect(result.scenarioId).toBe(GE_AGENT_RETRIEVE_001_SCENARIO_ID);
    expect(result.passed, result.failures.join('; ')).toBe(true);
  });

  it('passes GE-UX-ACTIVITY-001 feed label assertions', () => {
    const result = evaluateGeUxActivity_001();
    expect(result.scenarioId).toBe(GE_UX_ACTIVITY_001_SCENARIO_ID);
    expect(result.passed, result.failures.join('; ')).toBe(true);
  });

  it('passes all V4 agent-loop golden scenarios together', () => {
    const results = evaluateAllV4AgentLoopGoldenScenarios();
    expect(results.every((result) => result.passed)).toBe(true);
  });
});
