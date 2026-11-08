import { describe, expect, it, vi } from 'vitest';
import { AgentOrchestrator, hashToolArgs } from '../AgentOrchestrator';
import { assembleAgentContext, MAX_PLAN_DOC_CHARS, truncatePlanDocument, VIBE_RETRIEVAL_DEFAULTS } from '../contextAssembly';
import type { AgentMessage } from '../types';
import type { IAiProvider, ToolDefinition } from '../../IAiProvider';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { getProjectStandardsTool } from '../../tools/native/getProjectStandards';
import { draftComponentLayoutTool } from '../../tools/native/draftComponentLayout';
import { draftServerFunctionTool } from '../../tools/native/draftServerFunction';
import { clearAgentDrafts } from '../../tools/native/agentDraftStore';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';

const DEFAULT_MOCK_DECOMPOSITION = JSON.stringify({
  summary: 'Implement the requested change',
  workUnits: [
    'Retrieve project standards and workflow shards',
    'Search and read relevant code',
    'Draft changes with draft_* tools',
    'Validate proposal',
  ],
  assumptions: [],
  openQuestions: [],
});

const createMockProvider = (responses: Array<{ text?: string; toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }> }>): IAiProvider => ({
  getProviderName: () => 'mock',
  chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
  chatWithTools: vi.fn()
    .mockImplementationOnce(() => Promise.resolve(responses[0]))
    .mockImplementationOnce(() => Promise.resolve(responses[1] ?? responses[0]))
    .mockImplementation(() => Promise.resolve(responses[responses.length - 1])),
});

describe('assembleAgentContext', () => {
  it('keeps the full flat history when no compaction summary exists (p-61 Phase C)', () => {
    const messages: AgentMessage[] = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index}`,
    }));

    const assembled = assembleAgentContext(messages, {
      mode: 'agent',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      contextWorkingTurns: 4,
    });

    expect(assembled.systemPrompt).toContain('get_project_standards');
    expect(assembled.systemPrompt).toContain('read_file');
    // No 16-message slicing: the model keeps its own working memory until real token pressure.
    expect(assembled.workingMessages).toHaveLength(20);
    expect(assembled.workingMessages[0]?.content).toBe('message-0');
    expect(assembled.historySummary).toBeUndefined();
  });

  it('delivers a resolved compaction summary as an in-band system-reminder, not in the system prompt', () => {
    const messages: AgentMessage[] = Array.from({ length: 60 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index}`,
    }));

    const assembled = assembleAgentContext(
      messages,
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        contextWorkingTurns: 4,
      },
      'summary-of-older-turns',
    );

    expect(assembled.historySummary).toBe('summary-of-older-turns');
    // System prompt stays byte-stable across iterations so provider prefix caching works.
    expect(assembled.systemPrompt).not.toContain('summary-of-older-turns');
    expect(assembled.workingMessages[0]?.content).toContain('<system-reminder>');
    expect(assembled.workingMessages[0]?.content).toContain('summary-of-older-turns');
    // Generous verbatim tail floor (24) + the reminder message.
    expect(assembled.workingMessages).toHaveLength(25);
    expect(assembled.workingMessages[1]?.content).toBe('message-36');
  });

  it('truncates oversized plan document in plan mode', () => {
    const longPlan = 'x'.repeat(MAX_PLAN_DOC_CHARS + 3_000);
    const assembled = assembleAgentContext([], {
      mode: 'plan',
      planDocumentContent: longPlan,
      planDocumentPath: 'plans/core/todo/p-99-example.md',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });

    expect(assembled.systemPrompt).toContain('Active session plan document');
    expect(assembled.systemPrompt).not.toContain(longPlan);
    expect(assembled.systemPrompt).toContain('Truncated');
    expect(assembled.systemPrompt).toContain('plans/core/todo/p-99-example.md');
    expect(assembled.systemPrompt.length).toBeLessThan(longPlan.length);
  });

  it('truncates oversized plan document in agent mode (read-only context)', () => {
    const longPlan = 'y'.repeat(MAX_PLAN_DOC_CHARS + 1_500);
    const assembled = assembleAgentContext([], {
      mode: 'agent',
      planDocumentContent: longPlan,
      planDocumentPath: 'plans/packages/pkg-plan.md',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });

    expect(assembled.systemPrompt).toContain('Plan document context (read-only');
    expect(assembled.systemPrompt).not.toContain(longPlan);
    expect(assembled.systemPrompt).toContain('pkg-plan.md');
  });
});

describe('truncatePlanDocument', () => {
  it('passes through content under the cap', () => {
    const content = '# Plan\n\nShort body.';
    expect(truncatePlanDocument(content)).toEqual({ text: content, truncated: false });
  });

  it('slices and adds pointer when over the cap', () => {
    const content = 'z'.repeat(MAX_PLAN_DOC_CHARS + 500);
    const result = truncatePlanDocument(content, 'plans/core/todo/p-01.md');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThan(content.length);
    expect(result.text).toContain('Truncated');
    expect(result.text).toContain('p-01.md');
  });
});

describe('AgentOrchestrator', () => {
  it('executes get_project_standards and returns final text', async () => {
    const provider = createMockProvider([
      {
        toolCalls: [{ id: 'call-1', name: 'get_project_standards', args: { query: 'grid boolean' } }],
      },
      { text: 'Booleans render as icons only.' },
    ]);

    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards'],
    });
    registry.register(getProjectStandardsTool);

    const events: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'What grid boolean column rule applies?' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        contextWorkingTurns: 8,
      },
      {
        onEvent: (event) => {
          events.push(event.type);
        },
      },
    );

    expect(result.text).toContain('icons');
    expect(result.iterationCount).toBeGreaterThanOrEqual(2);
    expect(events).toContain('tool_start');
    expect(events).toContain('tool_result');
    expect(events).toContain('text_delta');
    expect(result.traces.some((trace) => trace.toolName === 'get_project_standards')).toBe(true);
  });

  it('stops on redundant tool invocations', async () => {
    const repeatedCall = {
      toolCalls: [{ id: 'call-1', name: 'get_project_standards', args: {} }],
    };
    const provider = createMockProvider([repeatedCall, repeatedCall, repeatedCall, repeatedCall]);

    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards'],
    });
    registry.register(getProjectStandardsTool);

    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'loop' }],
      {
        mode: 'agent',
        agentSettings: { ...DEFAULT_AI_AGENT_SETTINGS, maxIterations: 10 },
      },
    );

    expect(result.traces.some((trace) => trace.policyAction === 'stop')).toBe(true);
  });

  it('auto-prunes stale tool observations during long runs', async () => {
    const capturedToolCounts: number[] = [];

    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
      chatWithTools: vi.fn().mockImplementation((messages) => {
        capturedToolCounts.push(messages.filter((message) => message.role === 'tool').length);
        const index = capturedToolCounts.length - 1;
        if (index < 10) {
          return Promise.resolve({
            toolCalls: [{
              id: `call-${index}`,
              name: 'get_project_standards',
              args: { query: `grid-${index}` },
            }],
          });
        }
        return Promise.resolve({ text: 'Done after pruning.' });
      }),
    };

    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards'],
    });
    registry.register(getProjectStandardsTool);

    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    await orchestrator.run(
      [{ role: 'user', content: 'Keep searching standards' }],
      {
        mode: 'agent',
        agentSettings: {
          ...DEFAULT_AI_AGENT_SETTINGS,
          maxIterationsVibe: 12,
          maxToolCallsPerTurn: 1,
          contextToolObservationMaxTurns: 4,
        },
      },
    );

    const maxToolMessages = Math.max(...capturedToolCounts);
    expect(maxToolMessages).toBeLessThanOrEqual(4);
  });

  it('allows draft_* immediately — the retrieve gate is advisory, not blocking (p-61 Phase B)', async () => {
    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-draft-early',
            name: 'draft_component_layout',
            args: { name: 'Users', templateId: 'users' },
          }],
        })
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-standards',
            name: 'get_project_standards',
            args: { shard: 'vibe-coding-workflows' },
          }],
        })
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-read',
            name: 'read_file',
            args: { path: 'src/features/users/UsersPage.tsx' },
          }],
        })
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-draft-late',
            name: 'draft_component_layout',
            args: { name: 'Users', templateId: 'users' },
          }],
        })
        .mockResolvedValue({ text: 'Draft ready.' }),
    };

    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'draft', 'read'] });
    registry.register(getProjectStandardsTool);
    registry.register(draftComponentLayoutTool);
    registry.register({
      name: 'read_file',
      description: 'read',
      group: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ ok: true as const, summary: 'read ok' }),
    });

    const events: string[] = [];
    const blockedSummaries: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'Build users CRUD' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      },
      {
        onEvent: (event) => {
          events.push(event.type);
          if (event.type === 'tool_result' && !event.result.ok) {
            blockedSummaries.push(event.result.summary);
          }
        },
      },
    );

    // No harness-manufactured tool errors: the model's first draft call runs for real.
    expect(blockedSummaries.some((summary) => summary.includes('Retrieve bundle incomplete'))).toBe(false);
    expect(result.traces.find((trace) => trace.toolName === 'draft_component_layout' && trace.ok === true)).toBeTruthy();
    expect(events).toContain('change_plan');
  });

  it('runs zero pre-flight LLM calls — no task-decomposition round-trip (p-61 Phase B)', async () => {
    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn().mockResolvedValue('should never be called'),
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-standards',
            name: 'get_project_standards',
            args: { shard: 'vibe-coding-workflows' },
          }],
        })
        .mockResolvedValue({ text: 'Done.' }),
    };

    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards'] });
    registry.register(getProjectStandardsTool);

    const events: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    await orchestrator.run(
      [{ role: 'user', content: 'Build users CRUD page' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      },
      {
        onEvent: (event) => {
          events.push(event.type);
        },
      },
    );

    expect(events).not.toContain('task_decomposition');
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('runs a first-call draft on a designer page without harness-made errors (p-61 Phase B)', async () => {
    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-draft-early',
            name: 'draft_component_layout',
            args: { name: 'Grid', templateId: 'users' },
          }],
        })
        .mockResolvedValue({ text: 'Done.' }),
    };

    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'draft'] });
    registry.register(getProjectStandardsTool);
    registry.register(draftComponentLayoutTool);

    const blockedSummaries: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'Add a column to the grid' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        pageContext: {
          path: '/client-components',
          pageLabel: 'Designer',
          pageKey: 'client-components',
          layoutId: 'existing-layout-id',
        },
      },
      {
        onEvent: (event) => {
          if (event.type === 'tool_result' && !event.result.ok) {
            blockedSummaries.push(event.result.summary);
          }
        },
      },
    );

    expect(blockedSummaries.some((summary) => summary.includes('Retrieve bundle incomplete'))).toBe(false);
    expect(result.traces.find((trace) => trace.toolName === 'draft_component_layout' && trace.ok === true)).toBeTruthy();
  });

  it('includes utility-guided retrieval defaults in agent context (VC-2.5)', () => {
    const assembled = assembleAgentContext([], {
      mode: 'agent',
      executionProfile: 'agent_implement',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });
    expect(assembled.systemPrompt).toContain(VIBE_RETRIEVAL_DEFAULTS);
    expect(assembled.systemPrompt).toContain('segment H');
  });

  it('uses lookup rules for agent_lookup profile without vibe workflow blocks', () => {
    const assembled = assembleAgentContext(
      [{ role: 'user', content: 'ask: what is the grid standard?' }],
      {
        mode: 'agent',
        executionProfile: 'agent_lookup',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      },
    );
    // p-98 — AGENT_LOOKUP_RULES reworded; "this turn is a question" replaces "lookup-only turn".
    expect(assembled.systemPrompt).toContain('this turn is a question');
    expect(assembled.systemPrompt).not.toContain('Active vibe workflow');
    expect(assembled.systemPrompt).not.toContain('there is no other write path');
  });

  it('a text response ends the loop — no fake-user nudge messages are injected (p-61 Phase B)', async () => {
    clearAgentDrafts();

    const codeDump = [
      '```typescript',
      'const edgeReq = req as EdgeReq;',
      'async function handler() { edgeRes.json({ success: true, data: { sum: 0 } }); }',
      '```',
    ].join('\n');

    const chatWithTools = vi.fn().mockResolvedValue({ text: codeDump });
    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
      chatWithTools,
    };

    const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['standards', 'draft'] });
    registry.register(getProjectStandardsTool);
    registry.register(draftServerFunctionTool);

    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'Create a new function that adds two numbers' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        pageContext: {
          path: '/server-functions',
          pageLabel: 'Server Functions',
          pageKey: 'server-functions',
        },
      },
    );

    // The model's text answer is final: exactly one LLM round-trip, no synthetic user turns
    // pushing it back into the loop.
    expect(chatWithTools).toHaveBeenCalledTimes(1);
    expect(result.text).toBe(codeDump);
    const sentMessages = chatWithTools.mock.calls[0][0] as Array<{ role: string; content: string }>;
    expect(sentMessages.filter((message) => message.role === 'user')).toHaveLength(1);
  });
});

describe('hashToolArgs', () => {
  it('returns stable short hash', () => {
    expect(hashToolArgs({ query: 'grid' })).toHaveLength(16);
    expect(hashToolArgs({ query: 'grid' })).toBe(hashToolArgs({ query: 'grid' }));
  });
});

describe('ToolRegistry', () => {
  it('blocks tools outside allowed groups in agent mode', async () => {
    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['read'],
    });
    registry.register(getProjectStandardsTool);

    const result = await registry.execute('get_project_standards', {}, {});
    expect(result.ok).toBe(false);
    expect(result.error).toBe('tool_not_permitted');
  });
});
