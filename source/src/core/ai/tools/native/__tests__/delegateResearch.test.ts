import { describe, expect, it, vi } from 'vitest';
import { executeDelegateResearch, delegateResearchTool } from '../delegateResearch';
import { createPhase1ToolRegistry } from '../../ToolRegistry';
import { putAgentDraft, listAgentDrafts, clearAgentDrafts, createDraftId } from '../agentDraftStore';
import { setAgentTodos, listAgentTodos, clearAgentTodos } from '../agentTodoStore';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../../IAiProvider';

const buildMockProvider = (finalText: string): IAiProvider => ({
  getProviderName: () => 'mock',
  chat: vi.fn().mockResolvedValue(finalText),
  chatWithTools: vi.fn().mockResolvedValue({ text: finalText }),
});

vi.mock('../../../AiManager', () => ({
  aiManager: {
    getSettings: () => ({
      enabled: true,
      defaultModelId: 'mock-model',
      agent: DEFAULT_AI_AGENT_SETTINGS,
    }),
    resolveModel: () => ({
      entry: { id: 'mock-model' },
      provider: buildMockProvider('The auth middleware is defined in src/server/middleware/auth.middleware.ts and applied globally in bootstrapFullRuntime.ts.'),
    }),
  },
}));

describe('delegate_research', () => {
  it('returns the nested subagent run\'s final text as findings', async () => {
    const result = await executeDelegateResearch({ task: 'Where is the auth middleware applied?' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.findings).toContain('auth middleware');
    expect(result.summary.length).toBeGreaterThan(0);
    expect(typeof result.data.iterationCount).toBe('number');
  });

  it('requires a non-empty task', async () => {
    const result = await executeDelegateResearch({ task: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('missing_task');
  });

  it('cannot itself delegate further — delegate_research is not visible inside the nested read-only registry', () => {
    const nestedRegistry = createPhase1ToolRegistry('ask', []);
    nestedRegistry.register(delegateResearchTool);
    const names = nestedRegistry.listDefinitions().map((tool) => tool.name);
    expect(names).not.toContain('delegate_research');
  });

  it('does not touch the parent\'s in-flight drafts or todos (nested run never enters agent_implement)', async () => {
    clearAgentDrafts();
    clearAgentTodos();
    putAgentDraft({
      kind: 'file_patch',
      id: createDraftId(),
      path: 'src/parent-in-flight.ts',
      content: 'export const parent = true;\n',
    });
    setAgentTodos([{ id: 't1', title: 'parent todo', status: 'pending' }]);

    const draftCountBefore = listAgentDrafts().length;
    const todoCountBefore = listAgentTodos().length;

    await executeDelegateResearch({ task: 'What does clampPercentage do?' });

    expect(listAgentDrafts().length).toBe(draftCountBefore);
    expect(listAgentTodos().length).toBe(todoCountBefore);

    clearAgentDrafts();
    clearAgentTodos();
  });
});
