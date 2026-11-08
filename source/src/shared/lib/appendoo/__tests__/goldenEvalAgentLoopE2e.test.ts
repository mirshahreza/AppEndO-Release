import { afterEach, describe, expect, it } from 'vitest';
import { clearAgentDrafts } from '../../../../core/ai/tools/native/agentDraftStore';
import {
  markGeAgentWf4E2ePassed,
  runGeAgentWf4_001OrchestratorScenario,
} from '../goldenEvalAgentLoopE2e';
import { GE_AGENT_WF4_001_SCENARIO_ID } from '../goldenEvalAgentLoop';

describe('GE-AGENT-WF4-001 orchestrator E2E', () => {
  afterEach(() => {
    clearAgentDrafts();
  });

  it('retrieve-before-draft agent loop produces a valid layout proposal', async () => {
    const result = await runGeAgentWf4_001OrchestratorScenario();
    markGeAgentWf4E2ePassed(result.passed);

    expect(result.scenarioId).toBe(`${GE_AGENT_WF4_001_SCENARIO_ID}-E2E`);
    expect(result.passed, result.failures.join('; ')).toBe(true);
    expect(result.retrievalOperationCount).toBeGreaterThanOrEqual(1);
    expect(result.toolOrder?.findIndex((name) => name.startsWith('draft_'))).toBeGreaterThan(0);
  });
});
