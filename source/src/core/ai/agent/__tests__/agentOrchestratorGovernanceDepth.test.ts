import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../AgentOrchestrator';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { clearAgentDrafts } from '../../tools/native/agentDraftStore';
import { getProjectStandardsTool } from '../../tools/native/getProjectStandards';
import { readFileTool } from '../../tools/native/readFile';
import { draftFilePatchTool } from '../../tools/native/draftFilePatch';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../IAiProvider';
import { loadEventLog } from '../AgentEventStore';

/**
 * V5 Phase P03 § T7, revised by p-61 Phase B (B5) — the repeated-failure policy signal is
 * telemetry only: it never denies the model's retry (blocking retries taught the model to
 * abandon tasks). `governanceDepth` still changes WHEN the stall signature fires — proven here
 * via the persisted StallDetected runtime events rather than via denied tool calls.
 */
describe('V5 P03 — governanceDepth changes real orchestrator gating behavior', () => {
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
    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'search', 'read', 'draft'], executionProfile: 'agent_implement' });
    registry.register(getProjectStandardsTool);
    registry.register(readFileTool);
    registry.register(draftFilePatchTool);
    return registry;
  };

  const targetPath = 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts';
  const malformedDraftCall = (id: string) => ({ id, name: 'draft_file_patch', args: { path: targetPath, content: 'x', patch: 'y' } });

  const buildSteps = (): ProviderStep[] => [
    { toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }] },
    { toolCalls: [{ id: 'read', name: 'read_file', args: { path: targetPath } }] },
    { toolCalls: [malformedDraftCall('bad1')] },
    { toolCalls: [malformedDraftCall('bad2')] },
    { text: 'Stopping.' },
  ];

  it('THOROUGH flags the SECOND attempt as a stall (threshold 1) but the real tool still runs', async () => {
    clearAgentDrafts();
    const taskId = 'gov-depth-thorough-task';
    const attemptId = `attempt-${Date.now()}`;
    const orchestrator = new AgentOrchestrator({ provider: createSequentialProvider(buildSteps()), modelId: 'mock-model', toolRegistry: buildRegistry() });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'test governance depth THOROUGH' }],
      { mode: 'agent', executionProfile: 'agent_implement', agentSettings: DEFAULT_AI_AGENT_SETTINGS, governanceDepth: 'THOROUGH', taskId, attemptId },
    );

    const draftTraces = result.traces.filter((t) => t.toolName === 'draft_file_patch');
    expect(draftTraces).toHaveLength(2);
    expect(draftTraces[0].error).toBe('ambiguous_patch_input'); // real tool failure
    expect(draftTraces[1].error).toBe('ambiguous_patch_input'); // retry reaches the real tool — never policy-denied

    const events = loadEventLog(taskId, attemptId) ?? [];
    expect(events.some((event) => event.type === 'StallDetected'
      && (event.payload as { reasonCode?: string }).reasonCode === 'repeated_failure_without_recovery')).toBe(true);
  });

  it('AUTO (default) allows the SAME second attempt through to the real tool (threshold 2)', async () => {
    clearAgentDrafts();
    const orchestrator = new AgentOrchestrator({ provider: createSequentialProvider(buildSteps()), modelId: 'mock-model', toolRegistry: buildRegistry() });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'test governance depth AUTO' }],
      { mode: 'agent', executionProfile: 'agent_implement', agentSettings: DEFAULT_AI_AGENT_SETTINGS }, // governanceDepth omitted → AUTO
    );

    const draftTraces = result.traces.filter((t) => t.toolName === 'draft_file_patch');
    expect(draftTraces).toHaveLength(2);
    expect(draftTraces[0].error).toBe('ambiguous_patch_input');
    expect(draftTraces[1].error).toBe('ambiguous_patch_input'); // still the REAL tool failure, not policy-blocked yet
  });

  it('LEAN requested on a HIGH-risk target auto-escalates to THOROUGH (p-60 T7 rule)', async () => {
    clearAgentDrafts();
    const registry = buildRegistry();
    // Use a schema-shaped path so classifyMutationRisk('...schema...') === 'HIGH'.
    const riskyPath = 'src/shared/lib/appendoo/v5Baseline/schema-permission-sample.ts';
    const steps: ProviderStep[] = [
      { toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }] },
      { toolCalls: [{ id: 'read', name: 'read_file', args: { path: targetPath } }] },
      { toolCalls: [{ id: 'bad1', name: 'draft_file_patch', args: { path: riskyPath, content: 'x', patch: 'y' } }] },
      { toolCalls: [{ id: 'bad2', name: 'draft_file_patch', args: { path: riskyPath, content: 'x', patch: 'y' } }] },
      { text: 'Stopping.' },
    ];
    const taskId = 'gov-depth-lean-task';
    const attemptId = `attempt-${Date.now()}`;
    const orchestrator = new AgentOrchestrator({ provider: createSequentialProvider(steps), modelId: 'mock-model', toolRegistry: registry });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'test LEAN escalation on a risky target' }],
      { mode: 'agent', executionProfile: 'agent_implement', agentSettings: DEFAULT_AI_AGENT_SETTINGS, governanceDepth: 'LEAN', taskId, attemptId },
    );

    const draftTraces = result.traces.filter((t) => t.toolName === 'draft_file_patch');
    expect(draftTraces).toHaveLength(2);
    // LEAN's own threshold is 3 — if it weren't escalated, the 2nd attempt would produce no
    // stall signal at all. Escalation to THOROUGH (threshold 1) fires the stall telemetry;
    // the retry itself still reaches the real tool (B5 — telemetry, not steering).
    expect(draftTraces[1].error).toBe('ambiguous_patch_input');
    const events = loadEventLog(taskId, attemptId) ?? [];
    expect(events.some((event) => event.type === 'StallDetected'
      && (event.payload as { reasonCode?: string }).reasonCode === 'repeated_failure_without_recovery')).toBe(true);
  });
});
