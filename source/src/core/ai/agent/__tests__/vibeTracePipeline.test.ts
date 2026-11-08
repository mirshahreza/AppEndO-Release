import { describe, expect, it, vi } from 'vitest';
import { AgentOrchestrator } from '../AgentOrchestrator';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { draftServerFunctionTool } from '../../tools/native/draftServerFunction';
import { getProjectStandardsTool } from '../../tools/native/getProjectStandards';
import { clearAgentDrafts, putAgentDraft } from '../../tools/native/agentDraftStore';
import { buildChangeSetsFromDrafts } from '../../validation/changeSetBuilder';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../IAiProvider';

const stubReadFileTool = {
  name: 'read_file',
  description: 'read',
  group: 'read' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: async () => ({ ok: true as const, summary: 'read ok' }),
};

const stubTestServerFunctionTool = {
  name: 'test_server_function',
  description: 'test',
  group: 'edge' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: async () => ({ ok: true as const, summary: 'test ok' }),
};

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
        args: { path: 'workspace/server-functions/custom/general.list-users.ts' },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-sf',
        name: 'draft_server_function',
        args: {
          name: 'List Users',
          source: 'export async function handler() { return { ok: true }; }',
        },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-test',
        name: 'test_server_function',
        args: { functionId: 'general.list-users' },
      }],
    })
    .mockResolvedValueOnce({ text: 'Server function draft ready.' })
    .mockResolvedValue({ text: 'Server function draft ready.' }),
});

describe('vibe trace pipeline (VC-1.6b regression)', () => {
  it('draft_server_function → proposal → validation_result with tool traces', async () => {
    clearAgentDrafts();

    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards', 'draft', 'read', 'edge'],
    });
    registry.register(getProjectStandardsTool);
    registry.register(draftServerFunctionTool);
    registry.register(stubReadFileTool);
    registry.register(stubTestServerFunctionTool);

    const events: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider: createMockProvider(),
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const result = await orchestrator.run(
      [{ role: 'user', content: 'Add a list users API' }],
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
    expect(result.proposalId).toBeTruthy();
    expect(result.changeSets?.some((changeSet) => changeSet.kind === 'function_source_patch')).toBe(true);
    expect(result.traces.some((trace) => trace.toolName === 'draft_server_function')).toBe(true);
  });

  it('server_function draft maps to function_source_patch for apply/verify path', () => {
    clearAgentDrafts();

    const draft = putAgentDraft({
      kind: 'server_function',
      id: 'draft-ping',
      functionId: 'ping',
      name: 'Ping',
      source: 'export async function handler() { return { pong: true }; }',
    });

    const changeSets = buildChangeSetsFromDrafts([draft.id]);
    expect(changeSets[0]?.kind).toBe('function_source_patch');
    expect(changeSets[0]?.functionId).toBe('general.ping');
  });
});
