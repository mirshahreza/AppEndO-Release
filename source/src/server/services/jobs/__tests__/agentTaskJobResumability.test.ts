import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../../../../core/ai/agent/AgentOrchestrator';
import { ToolRegistry } from '../../../../core/ai/tools/ToolRegistry';
import { clearAgentDrafts } from '../../../../core/ai/tools/native/agentDraftStore';
import { getProjectStandardsTool } from '../../../../core/ai/tools/native/getProjectStandards';
import { readFileTool } from '../../../../core/ai/tools/native/readFile';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../../../core/ai/IAiProvider';
import { loadEventLog } from '../../../../core/ai/agent/AgentEventStore';
import { replayOperationalState } from '../../../../core/ai/agent/operationalState';

/**
 * V5 Phase P11 section V5-21 — the phase doc's literal DoD: a large task must be able to leave the session UI
 * and later resume/reconstruct results from AgentEventStore (Phase 01). This test proves it
 * directly against the real orchestrator (what `agentTaskJobExecutor.ts` calls in production via
 * `aiManager.processAgentRun`), without needing a live model or a real DB-backed job row —
 * the resumability property lives entirely in `AgentOrchestrator`/`AgentEventStore`/
 * `operationalState`, already proven under a crash scenario in P09's `crashRecovery.test.ts`;
 * this test frames the SAME mechanism as "background job left the session and comes back later."
 */
describe('V5 P11 § V5-21 — background agent task is reconstructable from AgentEventStore after the fact', () => {
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

  it('a completed background task run leaves a durable event log that a later, independent reader can fully reconstruct progress from', async () => {
    clearAgentDrafts();
    const taskId = 'bg-job-task-1';
    const attemptId = 'bg-job-attempt-1';
    const targetPath = 'src/shared/lib/appendoo/v5Baseline/permissionSample.ts';

    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'search', 'read', 'draft'], executionProfile: 'agent_implement' });
    registry.register(getProjectStandardsTool);
    registry.register(readFileTool);

    const provider = createSequentialProvider([
      { toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }] },
      { toolCalls: [{ id: 'read', name: 'read_file', args: { path: targetPath } }] },
      { text: 'Background task finished.' },
    ]);

    // This IS what `agentTaskJobExecutor.executeAgentTaskForJob` triggers in production (via
    // aiManager.processAgentRun) — the job "runs in the background" from the caller's point of
    // view; nothing here is a simulation of a different code path.
    const orchestrator = new AgentOrchestrator({ provider, modelId: 'mock-model', toolRegistry: registry });
    await orchestrator.run(
      [{ role: 'user', content: 'run this in the background' }],
      { mode: 'agent', executionProfile: 'agent_implement', agentSettings: DEFAULT_AI_AGENT_SETTINGS, taskId, attemptId },
    );

    // --- The "session UI left" moment: a completely independent reader, with no reference to
    // the orchestrator instance above, reconstructs full progress purely from AgentEventStore.
    const persistedEvents = loadEventLog(taskId, attemptId);
    expect(persistedEvents).toBeDefined();
    expect(persistedEvents!.length).toBeGreaterThan(0);

    const reconstructedState = replayOperationalState(taskId, attemptId, persistedEvents!);
    expect(reconstructedState.outcomeState).not.toBe('IN_PROGRESS');
    expect(reconstructedState.retrievalOperationCount).toBeGreaterThan(0);
    expect(persistedEvents!.some((event) => event.type === 'TaskCompleted' || event.type === 'TaskBlocked' || event.type === 'TaskFailed')).toBe(true);
  });
});
