import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../AgentOrchestrator';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { clearAgentDrafts } from '../../tools/native/agentDraftStore';
import { getProjectStandardsTool } from '../../tools/native/getProjectStandards';
import { readFileTool } from '../../tools/native/readFile';
import { draftFilePatchTool } from '../../tools/native/draftFilePatch';
import { proposeHypothesisTool } from '../../tools/native/proposeHypothesis';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../IAiProvider';

/**
 * V5 Phase P02 — end-to-end proof that Evidence/HypothesisLedger are real and wired into
 * `AgentOrchestrator.run()`, not just unit-tested in isolation.
 *
 * p-98 — the TaskContract/ClaimStore-finalization tests that used to live here were removed
 * alongside `taskContract.ts`/`completionGate.ts` (confirmed pure telemetry, fed only unread
 * result fields). The hypothesis-reject-without-new-evidence test below is real, load-bearing
 * behavior and stays.
 */
describe('V5 P02 — AgentOrchestrator Evidence/Hypothesis integration', () => {
  type ProviderStep = { toolCalls: { id: string; name: string; args: Record<string, unknown> }[] } | { text: string };
  const createSequentialProvider = (steps: ProviderStep[]): IAiProvider => {
    let callIndex = 0;
    return {
      getProviderName: () => 'mock',
      chat: async () => 'mock',
      chatWithTools: async () => {
        const step = steps[callIndex] ?? steps[steps.length - 1] ?? { text: 'Done.' };
        callIndex += 1;
        return step;
      },
    };
  };

  const buildRegistry = () => {
    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'search', 'read', 'draft', 'context'], executionProfile: 'agent_implement' });
    registry.register(getProjectStandardsTool);
    registry.register(readFileTool);
    registry.register(draftFilePatchTool);
    registry.register(proposeHypothesisTool);
    return registry;
  };

  it('propose_hypothesis → two contradicting VERIFY failures auto-rejects it, then a same-claim re-propose is blocked', async () => {
    clearAgentDrafts();
    const registry = buildRegistry();
    registry.register({
      name: 'run_tests',
      description: 'stub',
      group: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ ok: false as const, summary: 'still failing', error: 'assertion_failed' }),
    });

    const provider = createSequentialProvider([
      { toolCalls: [{ id: 'h1', name: 'propose_hypothesis', args: { claim: 'off-by-one in the loop bound', type: 'ROOT_CAUSE' } }] },
      { toolCalls: [{ id: 'v1', name: 'run_tests', args: {} }] },
      { toolCalls: [{ id: 'h2', name: 'propose_hypothesis', args: { claim: 'off-by-one in the loop bound', type: 'ROOT_CAUSE' } }] },
      { toolCalls: [{ id: 'v2', name: 'run_tests', args: {} }] },
      { toolCalls: [{ id: 'h3', name: 'propose_hypothesis', args: { claim: 'off-by-one in the loop bound', type: 'ROOT_CAUSE' } }] },
      { text: 'Stopping.' },
    ]);

    const orchestrator = new AgentOrchestrator({ provider, modelId: 'mock-model', toolRegistry: registry });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'debug the failing test' }],
      { mode: 'agent', executionProfile: 'agent_implement', agentSettings: DEFAULT_AI_AGENT_SETTINGS },
    );

    const hypothesisTraces = result.traces.filter((t) => t.toolName === 'propose_hypothesis');
    expect(hypothesisTraces).toHaveLength(3);
    expect(hypothesisTraces[0].ok).toBe(true);
    expect(hypothesisTraces[1].ok).toBe(true); // reactivated after first contradiction
    expect(hypothesisTraces[2].ok).toBe(false); // rejected after second contradiction, no new evidence
    expect(hypothesisTraces[2].error).toBe('rejected_without_new_evidence');
  });
});
