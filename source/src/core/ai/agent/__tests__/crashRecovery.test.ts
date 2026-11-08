import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../AgentOrchestrator';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { clearAgentDrafts } from '../../tools/native/agentDraftStore';
import { getProjectStandardsTool } from '../../tools/native/getProjectStandards';
import { readFileTool } from '../../tools/native/readFile';
import { draftFilePatchTool } from '../../tools/native/draftFilePatch';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../IAiProvider';
import { AgentEventStore, loadEventLog } from '../AgentEventStore';
import { RuntimeEventSequencer, createRuntimeEvent } from '../runtimeEvents';
import { detectOrphanedToolExecution } from '../crashRecovery';

/**
 * V5 Phase P09 § V5-13 — the exact fixture the phase doc names as the DoD: "crash after patch
 * apply before completion event → resume → reconcile → no duplicate patch."
 */
describe('V5 P09 — crash-safe task runtime', () => {
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

  it('detectOrphanedToolExecution finds an unresolved ToolExecutionStarted and ignores resolved ones', () => {
    const sequencer = new RuntimeEventSequencer();
    const taskId = 't1';
    const attemptId = 'a1';
    const resolved = [
      createRuntimeEvent({ taskId, attemptId, type: 'ToolExecutionStarted' as const, payload: { toolName: 'read_file', target: 'x.ts' }, sequencer }),
      createRuntimeEvent({ taskId, attemptId, type: 'ToolExecutionCompleted' as const, payload: { toolName: 'read_file', target: 'x.ts', isRetrieve: true, isDraft: false }, sequencer }),
    ];
    expect(detectOrphanedToolExecution(resolved)).toBeUndefined();

    const orphaned = [
      ...resolved,
      createRuntimeEvent({ taskId, attemptId, type: 'ToolExecutionStarted' as const, payload: { toolName: 'draft_file_patch', target: 'y.ts' }, sequencer }),
    ];
    const orphan = detectOrphanedToolExecution(orphaned);
    expect(orphan?.toolName).toBe('draft_file_patch');
    expect(orphan?.target).toBe('y.ts');
  });

  it('crash after patch apply before completion event -> resume -> reconcile -> no duplicate patch', async () => {
    clearAgentDrafts();
    const taskId = 'crash-fixture-task';
    const attemptId = 'crash-fixture-attempt-1';
    const targetPath = 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts';

    // --- Simulate the crash ---
    // A prior attempt durably persisted TaskCreated + ToolExecutionStarted for draft_file_patch
    // on targetPath (AgentEventStore.append now persists synchronously per event — P09), then the
    // process died before ToolExecutionCompleted/Failed was ever recorded.
    const crashSequencer = new RuntimeEventSequencer();
    const crashedStore = new AgentEventStore(taskId, attemptId);
    crashedStore.append(createRuntimeEvent({
      taskId, attemptId, type: 'TaskCreated', payload: { mode: 'agent', executionProfile: 'agent_implement' }, sequencer: crashSequencer,
    }));
    crashedStore.append(createRuntimeEvent({
      taskId, attemptId, type: 'ToolExecutionStarted', payload: { toolName: 'draft_file_patch', target: targetPath }, sequencer: crashSequencer,
    }));

    const priorLog = loadEventLog(taskId, attemptId);
    expect(priorLog).toHaveLength(2);
    expect(priorLog![1].type).toBe('ToolExecutionStarted');

    // --- Resume ---
    // A fresh orchestrator run with the SAME taskId/attemptId. The model (unaware its previous
    // attempt was interrupted) naively proposes the identical draft_file_patch again.
    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'search', 'read', 'draft'], executionProfile: 'agent_implement' });
    registry.register(getProjectStandardsTool);
    registry.register(readFileTool);
    registry.register(draftFilePatchTool);

    const provider = createSequentialProvider([
      { toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }] },
      { toolCalls: [{ id: 'read', name: 'read_file', args: { path: targetPath } }] },
      { toolCalls: [{ id: 'retry', name: 'draft_file_patch', args: { path: targetPath, content: 'export const X = 1;\n' } }] },
      { text: 'Done.' },
    ]);

    const orchestrator = new AgentOrchestrator({ provider, modelId: 'mock-model', toolRegistry: registry });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'continue the previous task' }],
      {
        mode: 'agent',
        executionProfile: 'agent_implement',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        taskId,
        attemptId,
      },
    );

    // The blindly-retried draft_file_patch must be rejected, not silently re-applied.
    const draftTrace = result.traces.find((trace) => trace.toolName === 'draft_file_patch');
    expect(draftTrace?.ok).toBe(false);
    expect(draftTrace?.error).toBe('unresolved_unknown_outcome');

    // No new proposal/draft was created by the resumed run for that target — no duplicate patch.
    expect(result.proposalId).toBeUndefined();

    // Reconciliation is real and durable: the persisted log now records the crash's resolution.
    expect(result.runtimeState?.pendingUnknownOutcomeCount).toBeGreaterThan(0);
    const reconciledLog = loadEventLog(taskId, attemptId);
    expect(reconciledLog!.some((event) => event.type === 'ToolOutcomeUnknown')).toBe(true);
  });

  it('a SAFE_RETRY tool orphaned by a crash does not block re-issuing it on resume', async () => {
    const taskId = 'crash-fixture-task-2';
    const attemptId = 'crash-fixture-attempt-1';
    const targetPath = 'src/shared/lib/appendoo/v5Baseline/permissionSample.ts';

    const crashSequencer = new RuntimeEventSequencer();
    const crashedStore = new AgentEventStore(taskId, attemptId);
    crashedStore.append(createRuntimeEvent({
      taskId, attemptId, type: 'TaskCreated', payload: { mode: 'agent', executionProfile: 'agent_implement' }, sequencer: crashSequencer,
    }));
    crashedStore.append(createRuntimeEvent({
      taskId, attemptId, type: 'ToolExecutionStarted', payload: { toolName: 'read_file', target: targetPath }, sequencer: crashSequencer,
    }));

    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'search', 'read', 'draft'], executionProfile: 'agent_implement' });
    registry.register(getProjectStandardsTool);
    registry.register(readFileTool);
    registry.register(draftFilePatchTool);

    const provider = createSequentialProvider([
      { toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }] },
      { toolCalls: [{ id: 'read', name: 'read_file', args: { path: targetPath } }] },
      { text: 'Done.' },
    ]);

    const orchestrator = new AgentOrchestrator({ provider, modelId: 'mock-model', toolRegistry: registry });
    const result = await orchestrator.run(
      [{ role: 'user', content: 'continue' }],
      {
        mode: 'agent',
        executionProfile: 'agent_implement',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        taskId,
        attemptId,
      },
    );

    const readTrace = result.traces.find((trace) => trace.toolName === 'read_file');
    expect(readTrace?.ok).toBe(true);
  });
});
