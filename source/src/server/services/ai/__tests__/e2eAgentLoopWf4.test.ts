/**
 * P4.1 — GE-AGENT-WF4-001 agent-loop E2E on orchestrator (retrieve → draft → proposal).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { clearAgentDrafts } from '../../../../core/ai/tools/native/agentDraftStore';
import {
  markGeAgentWf4E2ePassed,
  runGeAgentWf4_001OrchestratorScenario,
} from '../../../../shared/lib/appendoo/goldenEvalAgentLoopE2e';

describe('E2E Agent Loop WF-4 (GE-AGENT-WF4-001)', () => {
  afterEach(() => {
    clearAgentDrafts();
  });

  it('runs agent-only WF-4 with retrieve before draft and emits proposal', async () => {
    const result = await runGeAgentWf4_001OrchestratorScenario();
    markGeAgentWf4E2ePassed(result.passed);
    expect(result.passed, result.failures.join('; ')).toBe(true);
  });
});
