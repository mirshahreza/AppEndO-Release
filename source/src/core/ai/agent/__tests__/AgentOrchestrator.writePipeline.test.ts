import { describe, expect, it, vi } from 'vitest';
import { AgentOrchestrator } from '../AgentOrchestrator';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { draftComponentLayoutTool } from '../../tools/native/draftComponentLayout';
import { draftFilePatchTool } from '../../tools/native/draftFilePatch';
import { getProjectStandardsTool } from '../../tools/native/getProjectStandards';
import { clearAgentDrafts } from '../../tools/native/agentDraftStore';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { AgentStreamEvent } from '../../../../shared/api/contracts/ai/agentTypes';
import type { IAiProvider } from '../../IAiProvider';

const DEFAULT_MOCK_DECOMPOSITION = JSON.stringify({
  summary: 'Implement the requested change',
  workUnits: ['Retrieve standards', 'Draft changes', 'Validate proposal'],
  assumptions: [],
  openQuestions: [],
});

const createMockProvider = (): IAiProvider => ({
  getProviderName: () => 'mock',
  chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
  chatWithTools: vi.fn()
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
        id: 'call-layout',
        name: 'draft_component_layout',
        args: { name: 'Users CRUD', templateId: 'crud-collection-page' },
      }],
    })
    .mockResolvedValueOnce({ text: 'Draft ready.' })
    .mockResolvedValue({ text: 'Draft ready.' }),
});

const stubReadFileTool = {
  name: 'read_file',
  description: 'read',
  group: 'read' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: async () => ({ ok: true as const, summary: 'read ok' }),
};

describe('AgentOrchestrator write pipeline', () => {
  it('emits proposal and validation_result after draft tools', async () => {
    clearAgentDrafts();

    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards', 'draft', 'read'],
    });
    registry.register(getProjectStandardsTool);
    registry.register(draftComponentLayoutTool);
    registry.register(stubReadFileTool);

    const events: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider: createMockProvider(),
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'Build a users CRUD form' }],
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

    expect(events).toContain('tool_start');
    expect(events).toContain('proposal');
    expect(events).toContain('validation_result');
    expect(result.changeSets?.some((changeSet) => changeSet.kind === 'component_layout_patch')).toBe(true);
    expect(result.proposalId).toBeTruthy();
  });

  it('p-98: never lets a model-authored final reply hide an unresolved validation failure', async () => {
    clearAgentDrafts();

    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards', 'draft', 'read'],
    });
    registry.register(getProjectStandardsTool);
    registry.register(draftFilePatchTool);
    registry.register(stubReadFileTool);

    // Deliberately triggers the proposalValidator.ts secret-pattern check (severity: error) —
    // the mock provider never fixes it on repair, so validation.ok stays false after the repair
    // loop exhausts, exactly like the live-model eval baseline (2026-08-31) observed with a real
    // model: repair attempts ran out, but the model's own final text narrated success anyway.
    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-standards',
            name: 'get_project_standards',
            args: { shard: 'vibe-coding-workflows' },
          }],
        })
        .mockResolvedValueOnce({
          toolCalls: [{
            id: 'call-patch',
            name: 'draft_file_patch',
            args: {
              path: 'src/shared/lib/__eval_scratch_secret_test__.ts',
              content: 'export const apiKey = "abcdefgh12345678";\n',
            },
          }],
        })
        .mockResolvedValueOnce({ text: 'Patched the config file.' })
        .mockResolvedValue({ text: 'Patched the config file.' }),
    };

    const events: AgentStreamEvent[] = [];
    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'Add an API key constant to a shared lib file' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      },
      {
        onEvent: (event) => events.push(event),
      },
    );

    const validationEvent = events.find((event): event is Extract<AgentStreamEvent, { type: 'validation_result' }> => event.type === 'validation_result');
    expect(validationEvent?.ok).toBe(false);
    expect(result.text).toContain('unresolved validation errors');
  });
});
