/**
 * E2E WF-1 — server function draft → proposal → validate → apply → postApplyVerify.
 * @deprecated AE-22.5 — legacy VibeHarness path; migrate to engineeringPipelineService.runScaffold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertV1LegacyE2eSuiteAllowed } from '../../../../shared/lib/appendoo/appendooV1E2eMigration';
import { AgentOrchestrator } from '../../../../core/ai/agent/AgentOrchestrator';
import { ToolRegistry } from '../../../../core/ai/tools/ToolRegistry';
import { draftServerFunctionTool } from '../../../../core/ai/tools/native/draftServerFunction';
import { clearAgentDrafts } from '../../../../core/ai/tools/native/agentDraftStore';
import { buildChangeSetsFromDrafts } from '../../../../core/ai/validation/changeSetBuilder';
import { validateProposal } from '../../../../core/ai/validation/proposalValidator';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../../../core/ai/IAiProvider';
import type { ChangeSet } from '../../../../shared/api/contracts/ai/agentTypes';

const insertAgentApplySnapshot = vi.fn(async () => 401);
const getAgentApplySnapshotById = vi.fn();

vi.mock('../../../domain/ai/agentApplyRepository', () => ({
  insertAgentApplySnapshot: (...args: unknown[]) => insertAgentApplySnapshot(...args),
  getAgentApplySnapshotById: (...args: unknown[]) => getAgentApplySnapshotById(...args),
  getLatestAgentApplySnapshot: vi.fn(),
  markAgentApplySnapshotRolledBack: vi.fn(async () => true),
}));

vi.mock('../../jobs/jobServerFunctionExecutor', () => ({
  executeManagedFunctionForJob: vi.fn(async () => ({
    statusCode: 200,
    body: { success: true },
  })),
}));

const SERVER_FN_SOURCE = `async function handler() {
  res.json({ success: true, items: [] });
}
(async () => { await handler(); })();
`;

const mockRetrieveStandardsTool = {
  name: 'get_project_standards',
  description: 'Mock retrieve gate for WF-1 E2E.',
  group: 'standards' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: vi.fn().mockResolvedValue({ ok: true, summary: 'Retrieved vibe-server-function shard.' }),
};

const stubReadFileTool = {
  name: 'read_file',
  description: 'Mock read for retrieve bundle.',
  group: 'read' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: vi.fn().mockResolvedValue({ ok: true, summary: 'Read template file.' }),
};

const stubTestServerFunctionTool = {
  name: 'test_server_function',
  description: 'Mock test for verify gate.',
  group: 'server-functions' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: vi.fn().mockResolvedValue({ ok: true, summary: 'Function test passed.' }),
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
        args: { shard: 'vibe-server-function' },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-read',
        name: 'read_file',
        args: { path: 'workspace/server-functions/custom/custom.list-items.ts' },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-sf',
        name: 'draft_server_function',
        args: {
          name: 'List Items',
          folder: 'custom',
          source: SERVER_FN_SOURCE,
        },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-test',
        name: 'test_server_function',
        args: { functionId: 'custom.list-items' },
      }],
    })
    .mockResolvedValueOnce({ text: 'Server function draft is ready for review.' })
    .mockResolvedValue({ text: 'Server function draft is ready for review.' }),
});

let tmpDir = '';
let originalCwd = '';

describe('E2E WF-1 server function', () => {
  beforeEach(() => {
    assertV1LegacyE2eSuiteAllowed('e2eVibeServerFunctionWf1');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-wf1-sf-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    clearAgentDrafts();
    insertAgentApplySnapshot.mockClear();
    getAgentApplySnapshotById.mockReset();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearAgentDrafts();
  });

  it('agent run → draft_server_function → proposal → apply → function on disk + verify', async () => {
    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards', 'draft', 'read'],
    });
    registry.register(mockRetrieveStandardsTool);
    registry.register(draftServerFunctionTool);
    registry.register(stubReadFileTool);
    registry.register(stubTestServerFunctionTool);

    const eventTypes: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider: createMockProvider(),
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const pageContext = {
      path: '/server-functions',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
    };

    const runResult = await orchestrator.run(
      [{ role: 'user', content: 'Add a list items API' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        pageContext,
      },
      {
        onEvent: (event) => {
          eventTypes.push(event.type);
        },
      },
    );

    expect(eventTypes).toContain('proposal');
    expect(eventTypes).toContain('validation_result');
    expect(runResult.traces.some((trace) => trace.toolName === 'draft_server_function')).toBe(true);
    expect(runResult.changeSets?.some((cs) => cs.kind === 'function_source_patch')).toBe(true);

    const changeSets = buildChangeSetsFromDrafts();
    const validation = validateProposal(changeSets, {
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });
    expect(validation.violations.filter((v) => v.severity === 'error')).toHaveLength(0);

    const fnChangeSet = changeSets.find(
      (cs): cs is Extract<ChangeSet, { kind: 'function_source_patch' }> => cs.kind === 'function_source_patch',
    );
    expect(fnChangeSet?.functionId).toBe('custom.list-items');

    const managedFunctionId = 'custom.list-items';
    const applyChangeSets: ChangeSet[] = [{
      ...fnChangeSet!,
      patch: {
        ...(fnChangeSet!.patch as Record<string, unknown>),
        name: 'List Items',
        folder: 'custom',
        method: 'GET',
        path: '/api/custom/list-items',
        source: SERVER_FN_SOURCE,
      },
    }];

    const { changeSetService } = await import('../changeSet.service');
    const applyResult = await changeSetService.apply({
      proposalId: runResult.proposalId ?? 'wf1-prop',
      changeSets: applyChangeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(applyResult.appliedCount).toBe(1);
    expect(applyResult.verification?.ok).toBe(true);
    expect(applyResult.verification?.checks.some((c) => c.id.includes('function_source_patch'))).toBe(true);

    const { findManagedFunctionById } = await import('../../../domain/functions/functionRepository');
    const persisted = await findManagedFunctionById(managedFunctionId);
    expect(persisted?.code).toBe(SERVER_FN_SOURCE);
  });

  it('rejects apply when writeRequiresConfirm is false', async () => {
    const changeSets: ChangeSet[] = [{
      id: 'cs-wf1-no-confirm',
      kind: 'function_source_patch',
      title: 'Create function',
      functionId: 'wf1-no-confirm',
      patch: {
        name: 'No Confirm Fn',
        folder: 'custom',
        method: 'GET',
        path: '/api/custom/wf1-no-confirm',
        source: SERVER_FN_SOURCE,
      },
    }];

    const { changeSetService } = await import('../changeSet.service');
    await expect(changeSetService.apply({
      proposalId: 'wf1-no-confirm-prop',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, {
      ...DEFAULT_AI_AGENT_SETTINGS,
      writeRequiresConfirm: false,
    })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('explicit confirm'),
    });
  });
});
