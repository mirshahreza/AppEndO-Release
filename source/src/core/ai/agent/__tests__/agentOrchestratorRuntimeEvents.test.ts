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
import { loadPersistedOperationalState } from '../operationalState';

/**
 * V5 Phase P01 — end-to-end proof (not just unit-level) that:
 *   1. AgentOrchestrator.run() emits real runtime events and reduces them into OperationalState.
 *   2. The new OperationalPolicyEngine second gate actually blocks a repeated failing EDIT that
 *      the pre-existing harness retrieve gate alone would have allowed through.
 *   3. Both are durably persisted and independently reloadable.
 */
describe('V5 P01 — AgentOrchestrator runtime events + policy gate integration', () => {
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

  it('flags the third same-target draft_file_patch attempt as a stall (telemetry only — the retry still runs) and persists the event/state trail', async () => {
    clearAgentDrafts();
    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'search', 'read', 'draft'], executionProfile: 'agent_implement' });
    registry.register(getProjectStandardsTool);
    registry.register(readFileTool);
    registry.register(draftFilePatchTool);

    const targetPath = 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts';
    // Deliberately malformed args (both content AND patch set) — draftFilePatchTool really
    // rejects this with ok:false ('ambiguous_patch_input'), a genuine, reproducible failure.
    const malformedDraftCall = {
      id: 'bad',
      name: 'draft_file_patch',
      args: { path: targetPath, content: 'x', patch: 'y' },
    };

    const provider = createSequentialProvider([
      { toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }] },
      { toolCalls: [{ id: 'read', name: 'read_file', args: { path: targetPath } }] },
      { toolCalls: [malformedDraftCall] },
      { toolCalls: [{ ...malformedDraftCall, id: 'bad2' }] },
      { toolCalls: [{ ...malformedDraftCall, id: 'bad3' }] },
      { text: 'Stopping — repeated failures.' },
    ]);

    const orchestrator = new AgentOrchestrator({ provider, modelId: 'mock-model', toolRegistry: registry });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'test repeated failure policy gate' }],
      { mode: 'agent', executionProfile: 'agent_implement', agentSettings: DEFAULT_AI_AGENT_SETTINGS },
    );

    const draftTraces = result.traces.filter((trace) => trace.toolName === 'draft_file_patch');
    expect(draftTraces).toHaveLength(3);
    expect(draftTraces[0].ok).toBe(false);
    expect(draftTraces[0].error).toBe('ambiguous_patch_input');
    expect(draftTraces[1].ok).toBe(false);
    expect(draftTraces[1].error).toBe('ambiguous_patch_input');
    // Third attempt: p-61 Phase B (B5) — the policy engine records the unrecovered-failure
    // stall but never denies the retry; the call reaches the real tool and fails for the
    // real reason again.
    expect(draftTraces[2].ok).toBe(false);
    expect(draftTraces[2].error).toBe('ambiguous_patch_input');

    expect(result.runtimeState).toBeDefined();
    expect(result.runtimeState?.eventCount).toBeGreaterThan(0);

    const { taskId, attemptId } = result.runtimeState!;
    const persistedEvents = loadEventLog(taskId, attemptId);
    expect(persistedEvents).toBeDefined();
    expect(persistedEvents!.some((event) => event.type === 'StallDetected')).toBe(true);
    // V5 Phase P10 § V5-GE-003 — the same repeated-failure scenario also now emits a real,
    // independently-queryable RecoveryStrategySelected event once select() sees the unrecovered
    // failure signature, not just StallDetected/ActionRejected on the individual blocked call.
    expect(persistedEvents!.some((event) => event.type === 'RecoveryStrategySelected')).toBe(true);

    const persistedState = loadPersistedOperationalState(taskId, attemptId);
    expect(persistedState).toBeDefined();
    expect(persistedState!.hash).toBe(result.runtimeState!.operationalStateHash);
  });

  it('does not block draft_file_patch on a fresh (non-repeated-failure) target', async () => {
    clearAgentDrafts();
    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'search', 'read', 'draft'], executionProfile: 'agent_implement' });
    registry.register(getProjectStandardsTool);
    registry.register(readFileTool);
    registry.register(draftFilePatchTool);

    const targetPath = 'src/shared/lib/appendoo/v5Baseline/permissionSample.ts';
    const provider = createSequentialProvider([
      { toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }] },
      { toolCalls: [{ id: 'read', name: 'read_file', args: { path: targetPath } }] },
      { toolCalls: [{ id: 'good', name: 'draft_file_patch', args: { path: targetPath, content: 'export const X = 1;\n' } }] },
      { text: 'Done.' },
    ]);

    const orchestrator = new AgentOrchestrator({ provider, modelId: 'mock-model', toolRegistry: registry });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'benign edit' }],
      { mode: 'agent', executionProfile: 'agent_implement', agentSettings: DEFAULT_AI_AGENT_SETTINGS },
    );

    const draftTrace = result.traces.find((trace) => trace.toolName === 'draft_file_patch');
    expect(draftTrace?.ok).toBe(true);
    expect(result.proposalId).toBeDefined();
  });
});
