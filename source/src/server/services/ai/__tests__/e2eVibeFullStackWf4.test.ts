/**
 * E2E WF-4 — sequential WF-1 (server function) + WF-2 (component layout) → apply → designer handoff.
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
import { draftComponentLayoutTool } from '../../../../core/ai/tools/native/draftComponentLayout';
import { clearAgentDrafts } from '../../../../core/ai/tools/native/agentDraftStore';
import { buildChangeSetsFromDrafts } from '../../../../core/ai/validation/changeSetBuilder';
import { validateProposal } from '../../../../core/ai/validation/proposalValidator';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from '../../../../domain/component-designer/documentSchema';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../../../core/ai/IAiProvider';
import type { ChangeSet } from '../../../../shared/api/contracts/ai/agentTypes';

const insertAgentApplySnapshot = vi.fn(async () => 501);
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
  res.json({ success: true, data: [] });
}
(async () => { await handler(); })();
`;

const mockRetrieveStandardsTool = {
  name: 'get_project_standards',
  description: 'Mock retrieve gate for WF-4 E2E.',
  group: 'standards' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: vi.fn().mockResolvedValue({ ok: true, summary: 'Retrieved vibe-coding-workflows shard.' }),
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
  group: 'edge' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: vi.fn().mockResolvedValue({ ok: true, summary: 'Function test passed.' }),
};

const DEFAULT_MOCK_DECOMPOSITION = JSON.stringify({
  summary: 'Implement the requested change',
  workUnits: ['Retrieve standards', 'Draft changes', 'Validate proposal'],
  assumptions: [],
  openQuestions: [],
});

const createWf1Provider = (): IAiProvider => ({
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
        args: { path: 'workspace/server-functions/custom/items.items-api.ts' },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-sf',
        name: 'draft_server_function',
        args: {
          name: 'Items API',
          folder: 'items',
          source: SERVER_FN_SOURCE,
        },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-test',
        name: 'test_server_function',
        args: { functionId: 'items.items-api' },
      }],
    })
    .mockResolvedValueOnce({ text: 'Server function draft ready.' })
    .mockResolvedValue({ text: 'Server function draft ready.' }),
});

const createWf2Provider = (): IAiProvider => ({
  getProviderName: () => 'mock',
  chat: vi.fn().mockResolvedValue(DEFAULT_MOCK_DECOMPOSITION),
  chatWithTools: vi.fn()
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-standards',
        name: 'get_project_standards',
        args: { shard: 'vibe-crud' },
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
        id: 'call-crud',
        name: 'draft_component_layout',
        args: { name: 'Users Create/Edit', templateId: 'users-crud' },
      }],
    })
    .mockResolvedValueOnce({ text: 'CRUD layout draft ready.' })
    .mockResolvedValue({ text: 'CRUD layout draft ready.' }),
});

let tmpDir = '';
let originalCwd = '';

describe('E2E WF-4 full-stack sequential', () => {
  beforeEach(() => {
    assertV1LegacyE2eSuiteAllowed('e2eVibeFullStackWf4');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-wf4-fullstack-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.resetModules();
    clearAgentDrafts();
    insertAgentApplySnapshot.mockClear();
    getAgentApplySnapshotById.mockReset();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
    clearAgentDrafts();
  });

  it('WF-1 apply then WF-2 apply → designer handoff with validation clean', async () => {
    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards', 'draft', 'read', 'edge'],
    });
    registry.register(mockRetrieveStandardsTool);
    registry.register(draftServerFunctionTool);
    registry.register(draftComponentLayoutTool);
    registry.register(stubReadFileTool);
    registry.register(stubTestServerFunctionTool);

    const orchestrator = new AgentOrchestrator({
      provider: createWf1Provider(),
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const wf1Events: string[] = [];
    const wf1Run = await orchestrator.run(
      [{ role: 'user', content: 'Add items API backend' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
        pageContext: {
          path: '/server-functions',
          pageLabel: 'Server Functions',
          pageKey: 'server-functions',
        },
      },
      {
        onEvent: (event) => {
          wf1Events.push(event.type);
        },
      },
    );

    expect(wf1Events).toContain('proposal');
    expect(wf1Events).toContain('validation_result');
    expect(wf1Run.changeSets?.some((cs) => cs.kind === 'function_source_patch')).toBe(true);

    const fnChangeSets = buildChangeSetsFromDrafts();
    expect(validateProposal(fnChangeSets, { agentSettings: DEFAULT_AI_AGENT_SETTINGS })
      .violations.filter((v) => v.severity === 'error')).toHaveLength(0);

    const fnChangeSet = fnChangeSets.find(
      (cs): cs is Extract<ChangeSet, { kind: 'function_source_patch' }> => cs.kind === 'function_source_patch',
    );
    expect(fnChangeSet).toBeTruthy();

    const managedFunctionId = 'items.items-api';
    const { changeSetService } = await import('../changeSet.service');

    const fnApply = await changeSetService.apply({
      proposalId: wf1Run.proposalId ?? 'wf4-fn-prop',
      changeSets: [{
        ...fnChangeSet!,
        functionId: managedFunctionId,
        patch: {
          ...(fnChangeSet!.patch as Record<string, unknown>),
          name: 'Items API',
          folder: 'items',
          method: 'GET',
          path: '/api/items/items-api',
          source: SERVER_FN_SOURCE,
        },
      }],
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(fnApply.appliedCount).toBe(1);
    expect(fnApply.verification?.ok).toBe(true);

    clearAgentDrafts();

    const wf2Orchestrator = new AgentOrchestrator({
      provider: createWf2Provider(),
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const wf2Events: string[] = [];
    const wf2Run = await wf2Orchestrator.run(
      [{ role: 'user', content: 'Build Items CRUD UI bound to the API' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      },
      {
        onEvent: (event) => {
          wf2Events.push(event.type);
        },
      },
    );

    expect(wf2Events).toContain('proposal');
    expect(wf2Events).toContain('validation_result');
    expect(wf2Run.traces.some((trace) => trace.toolName === 'draft_component_layout')).toBe(true);

    const layoutChangeSets = buildChangeSetsFromDrafts();
    expect(validateProposal(layoutChangeSets, { agentSettings: DEFAULT_AI_AGENT_SETTINGS })
      .violations.filter((v) => v.severity === 'error')).toHaveLength(0);

    const layoutChangeSet = layoutChangeSets.find(
      (cs): cs is Extract<ChangeSet, { kind: 'component_layout_patch' }> => cs.kind === 'component_layout_patch',
    );
    expect(layoutChangeSet).toBeTruthy();

    const document = createInitialDesignerState().document;
    document.name = 'Users Create/Edit';

    const layoutApply = await changeSetService.apply({
      proposalId: wf2Run.proposalId ?? 'wf4-layout-prop',
      changeSets: [{
        ...layoutChangeSet!,
        patch: {
          ...(layoutChangeSet!.patch as Record<string, unknown>),
          name: 'Users Create/Edit',
          folder: 'general',
          document,
          bindingDefinitions: {},
        },
      }],
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(layoutApply.appliedCount).toBe(1);
    expect(layoutApply.designerHandoff?.[0]?.name).toBe('Users Create/Edit');

    const { getDesignerDraft } = await import('../../../domain/component-designer/drafts');
    const { findManagedFunctionById } = await import('../../../domain/functions/functionRepository');

    const layoutId = layoutApply.designerHandoff![0]!.layoutId;
    const persistedLayout = getDesignerDraft(layoutId);
    expect(persistedLayout?.name).toBe('Users Create/Edit');
    expect(persistedLayout?.document.schemaVersion).toBe(DESIGNER_DOCUMENT_SCHEMA_VERSION);
    expect(persistedLayout?.metadata.updatedBy).toBe('ai-agent');

    const persistedFn = await findManagedFunctionById(managedFunctionId);
    expect(persistedFn?.code).toBe(SERVER_FN_SOURCE);
  });

  it('rejects apply when writeRequiresConfirm is false', async () => {
    const changeSets: ChangeSet[] = [{
      id: 'cs-wf4-no-confirm',
      kind: 'component_layout_patch',
      title: 'Layout',
      layoutId: 'wf4-layout',
      patch: {
        name: 'WF4 Layout',
        folder: 'general',
        document: createInitialDesignerState('WF4 Layout').document,
        bindingDefinitions: {},
      },
    }];

    const { changeSetService } = await import('../changeSet.service');
    await expect(changeSetService.apply({
      proposalId: 'wf4-no-confirm',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, {
      ...DEFAULT_AI_AGENT_SETTINGS,
      writeRequiresConfirm: false,
    })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
