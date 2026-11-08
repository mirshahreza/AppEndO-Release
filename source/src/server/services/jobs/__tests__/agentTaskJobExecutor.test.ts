import { describe, expect, it, vi } from 'vitest';
import { executeAgentTaskForJob } from '../agentTaskJobExecutor';
import type { AgentTaskJobEnvelope } from '../../../domain/jobs/jobTypes';

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    processAgentRun: vi.fn(async () => ({
      text: 'done',
      modelId: 'mock-model',
      iterationCount: 3,
      traces: [],
    })),
  },
}));

const resolveAgentRunContext = vi.fn(async (..._args: unknown[]) => ({
  settings: {} as unknown,
  messages: [],
  cleanMessagesForIntent: [],
  effectiveMcpServers: [],
  runCapabilityScope: { packIds: ['appendo-files'], mcpServerIds: [] },
  enabledMcpServers: [{ id: 'mcp-1', name: 'MCP One' }],
  mcpAccessContext: undefined,
  autonomyTier: 'AUTOPILOT',
  persistedHistorySummary: undefined,
}));
vi.mock('../../ai/agent.service', () => ({
  resolveAgentRunContext: (...args: unknown[]) => resolveAgentRunContext(...args),
}));

const registerBuiltinCapabilityPacks = vi.fn((..._args: unknown[]) => undefined);
vi.mock('../../ai/mcp/builtin', () => ({
  registerBuiltinCapabilityPacks: (...args: unknown[]) => registerBuiltinCapabilityPacks(...args),
}));

const registerMcpTools = vi.fn(async (..._args: unknown[]) => ({ warnings: [] }));
const disconnectMcpServers = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('../../ai/mcp/mcpToolAdapter', () => ({
  registerMcpTools: (...args: unknown[]) => registerMcpTools(...args),
  disconnectMcpServers: (...args: unknown[]) => disconnectMcpServers(...args),
}));

describe('V5 P11 § V5-21 / p-102 — executeAgentTaskForJob', () => {
  it('calls the REAL production entry point (aiManager.processAgentRun), passing taskId/attemptId through unchanged', async () => {
    const { aiManager } = await import('../../../../core/ai/AiManager');
    const envelope: AgentTaskJobEnvelope = {
      taskId: 'job-task-1',
      attemptId: 'job-attempt-1',
      actorUserId: 7,
      mode: 'agent',
      messages: [{ role: 'user', content: 'do the thing' }],
      executionProfile: 'agent_implement',
      useEngineeringPipeline: false,
    };

    const result = await executeAgentTaskForJob(envelope);

    expect(aiManager.processAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'job-task-1',
      attemptId: 'job-attempt-1',
      mode: 'agent',
      executionProfile: 'agent_implement',
    }));
    expect(result.taskId).toBe('job-task-1');
    expect(result.attemptId).toBe('job-attempt-1');
    expect(result.text).toBe('done');
  });

  it('resolves tool access through the shared resolver (p-102 fix) and wires capability packs + MCP tools into the run', async () => {
    const { aiManager } = await import('../../../../core/ai/AiManager');
    const envelope: AgentTaskJobEnvelope = {
      taskId: 'job-task-2',
      attemptId: 'job-attempt-2',
      actorUserId: 42,
      sessionId: 99,
      mode: 'agent',
      messages: [{ role: 'user', content: 'do the other thing' }],
      executionProfile: 'agent_implement',
      enabledCapabilityPackIds: ['appendo-files'],
      enabledMcpServerIds: ['mcp-1'],
    };

    await executeAgentTaskForJob(envelope);

    expect(resolveAgentRunContext).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 99, enabledCapabilityPackIds: ['appendo-files'], enabledMcpServerIds: ['mcp-1'] }),
      42,
    );

    const call = (aiManager.processAgentRun as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(call.enabledCapabilityPackIds).toEqual(['appendo-files']);
    expect(call.prepareRegistry).toBeTypeOf('function');

    await call.prepareRegistry({});
    expect(registerBuiltinCapabilityPacks).toHaveBeenCalledWith({}, ['appendo-files']);
    expect(registerMcpTools).toHaveBeenCalled();

    expect(disconnectMcpServers).toHaveBeenCalledWith(['mcp-1']);
  });
});
