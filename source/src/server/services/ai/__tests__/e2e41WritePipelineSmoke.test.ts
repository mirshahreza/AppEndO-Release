/**
 * E2E-4.1 — automated smoke for Agent CRUD write → confirm → Designer save chain.
 * Replaces manual-only QA with unit/integration coverage of the documented steps.
 * @deprecated AE-22.5 — legacy VibeHarness path; migrate to engineeringPipelineService.runScaffold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertV1LegacyE2eSuiteAllowed } from '../../../../shared/lib/appendoo/appendooV1E2eMigration';
import { AgentOrchestrator } from '../../../../core/ai/agent/AgentOrchestrator';
import { ToolRegistry } from '../../../../core/ai/tools/ToolRegistry';
import { draftComponentLayoutTool } from '../../../../core/ai/tools/native/draftComponentLayout';
import { clearAgentDrafts } from '../../../../core/ai/tools/native/agentDraftStore';
import { buildChangeSetsFromDrafts } from '../../../../core/ai/validation/changeSetBuilder';
import { validateProposal } from '../../../../core/ai/validation/proposalValidator';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from '../../../../domain/component-designer/documentSchema';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { IAiProvider } from '../../../../core/ai/IAiProvider';
import type { ChangeSet } from '../../../../shared/api/contracts/ai/agentTypes';

const insertAgentApplySnapshot = vi.fn(async () => 201);
const getAgentApplySnapshotById = vi.fn();
const markAgentApplySnapshotRolledBack = vi.fn(async () => true);
const updateAgentApplySnapshotsJson = vi.fn(async () => undefined);

vi.mock('../../../domain/ai/agentApplyRepository', () => ({
  insertAgentApplySnapshot: (...args: unknown[]) => insertAgentApplySnapshot(...args),
  getAgentApplySnapshotById: (...args: unknown[]) => getAgentApplySnapshotById(...args),
  getLatestAgentApplySnapshot: vi.fn(),
  markAgentApplySnapshotRolledBack: (...args: unknown[]) => markAgentApplySnapshotRolledBack(...args),
  updateAgentApplySnapshotsJson: (...args: unknown[]) => updateAgentApplySnapshotsJson(...args),
}));

const stubReadFileTool = {
  name: 'read_file',
  description: 'Mock read for retrieve bundle.',
  group: 'read' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: vi.fn().mockResolvedValue({ ok: true, summary: 'Read template file.' }),
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
        args: { path: 'src/features/users/UsersPage.tsx' },
      }],
    })
    .mockResolvedValueOnce({
      toolCalls: [{
        id: 'call-crud-layout',
        name: 'draft_component_layout',
        args: { name: 'Users Create/Edit', templateId: 'users-crud' },
      }],
    })
    .mockResolvedValueOnce({ text: 'Create/Edit CRUD form draft is ready for review.' })
    .mockResolvedValue({ text: 'Create/Edit CRUD form draft is ready for review.' }),
});

const mockRetrieveStandardsTool = {
  name: 'get_project_standards',
  description: 'Mock retrieve gate for E2E smoke (tmp cwd has no docs shard).',
  group: 'standards' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: vi.fn().mockResolvedValue({ ok: true, summary: 'Retrieved vibe-coding-workflows shard.' }),
};

let tmpDir = '';
let originalCwd = '';

describe('E2E-4.1 write pipeline smoke', () => {
  beforeEach(() => {
    assertV1LegacyE2eSuiteAllowed('e2e41WritePipelineSmoke');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e41-designer-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.resetModules();
    clearAgentDrafts();
    insertAgentApplySnapshot.mockClear();
    getAgentApplySnapshotById.mockReset();
    markAgentApplySnapshotRolledBack.mockClear();
    updateAgentApplySnapshotsJson.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
    clearAgentDrafts();
  });

  it('covers steps 1–5: agent run → draft → validation → apply → designer handoff', async () => {
    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards', 'draft', 'read'],
    });
    registry.register(mockRetrieveStandardsTool);
    registry.register(draftComponentLayoutTool);
    registry.register(stubReadFileTool);

    const eventTypes: string[] = [];
    const orchestrator = new AgentOrchestrator({
      provider: createMockProvider(),
      modelId: 'gemini-2-5-flash',
      toolRegistry: registry,
    });

    const runResult = await orchestrator.run(
      [{ role: 'user', content: 'Build a Create/Edit CRUD form with standard fields' }],
      {
        mode: 'agent',
        agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      },
      {
        onEvent: (event) => {
          eventTypes.push(event.type);
        },
      },
    );

    expect(eventTypes).toContain('tool_start');
    expect(eventTypes).toContain('proposal');
    expect(eventTypes).toContain('validation_result');
    expect(runResult.changeSets?.some((cs) => cs.kind === 'component_layout_patch')).toBe(true);

    const changeSets = buildChangeSetsFromDrafts();
    expect(changeSets.length).toBeGreaterThan(0);

    const validation = validateProposal(changeSets, {
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });
    expect(validation.violations.filter((v) => v.severity === 'error')).toHaveLength(0);

    const layoutChangeSet = changeSets.find(
      (cs): cs is Extract<ChangeSet, { kind: 'component_layout_patch' }> => cs.kind === 'component_layout_patch',
    );
    expect(layoutChangeSet).toBeTruthy();

    const document = createInitialDesignerState().document;
    document.name = 'Users Create/Edit';

    const applyChangeSets: ChangeSet[] = [{
      ...layoutChangeSet!,
      patch: {
        ...(layoutChangeSet!.patch as Record<string, unknown>),
        name: 'Users Create/Edit',
        folder: 'general',
        document,
        bindingDefinitions: {},
      },
    }];

    const { changeSetService } = await import('../changeSet.service');
    const applyResult = await changeSetService.apply({
      proposalId: runResult.proposalId ?? 'e2e41-prop',
      changeSets: applyChangeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(applyResult.appliedCount).toBe(1);
    expect(applyResult.designerHandoff?.[0]?.name).toBe('Users Create/Edit');

    const { getDesignerDraft } = await import('../../../domain/component-designer/drafts');
    const layoutId = applyResult.designerHandoff![0]!.layoutId;
    const persisted = getDesignerDraft(layoutId);
    expect(persisted?.name).toBe('Users Create/Edit');
    expect(persisted?.document.schemaVersion).toBe(DESIGNER_DOCUMENT_SCHEMA_VERSION);
    expect(persisted?.document.diagnostics).toEqual([]);
    expect(persisted?.metadata.updatedBy).toBe('ai-agent');
  });

  it('rejects agent apply when layout document references an unknown slot id', async () => {
    const { changeSetService } = await import('../changeSet.service');
    const document = createInitialDesignerState('Bad Agent Layout').document;
    const rootId = document.rootNodeId;
    const nodeId = 'bad-slot-node';

    document.nodes = {
      ...document.nodes,
      [rootId]: {
        ...document.nodes[rootId],
        children: [nodeId],
      },
      [nodeId]: {
        id: nodeId,
        type: 'system-slot',
        parentId: rootId,
        order: 0,
        props: { slotId: 'unknown.slot.id' },
        layout: {},
        binding: {},
        children: [],
      },
    };

    const changeSets: ChangeSet[] = [{
      id: 'cs-e2e41-bad-slot',
      kind: 'component_layout_patch',
      title: 'Invalid slot layout',
      layoutId: 'bad-agent-layout',
      patch: {
        name: 'Bad Agent Layout',
        folder: 'general',
        document,
        bindingDefinitions: {},
      },
    }];

    await expect(changeSetService.apply({
      proposalId: 'e2e41-bad-slot',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('not registered in the platform catalog'),
    });
  });

  it('covers step 6: undo last apply rolls back layout patch', async () => {
    const { saveDesignerDraft } = await import('../../component-designer/draftCoordinator.service');
    const { getDesignerDraft } = await import('../../../domain/component-designer/drafts');
    const { changeSetService } = await import('../changeSet.service');

    const existing = saveDesignerDraft({
      name: 'Before E2E rollback',
      document: createInitialDesignerState().document,
      bindingDefinitions: {},
      actor: 'tester',
    });

    const updatedDocument = structuredClone(existing.document);
    updatedDocument.name = 'After agent apply';

    const changeSets: ChangeSet[] = [{
      id: 'cs-e2e41-layout',
      kind: 'component_layout_patch',
      title: 'Update CRUD layout',
      layoutId: existing.id,
      patch: {
        name: 'After agent apply',
        folder: existing.folder,
        document: updatedDocument,
        bindingDefinitions: existing.bindingDefinitions,
      },
    }];

    const applyResult = await changeSetService.apply({
      proposalId: 'e2e41-rollback',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(getDesignerDraft(existing.id)?.name).toBe('After agent apply');

    const snapshotCall = insertAgentApplySnapshot.mock.calls.at(-1)?.[0];
    getAgentApplySnapshotById.mockResolvedValue({
      id: applyResult.applyId,
      rolled_back_at: null,
      snapshots_json: snapshotCall?.snapshotsJson,
    });

    const rollbackResult = await changeSetService.rollback({ applyId: applyResult.applyId }, 1);
    expect(rollbackResult.rolledBackCount).toBe(1);
    expect(getDesignerDraft(existing.id)?.name).toBe('Before E2E rollback');
  });
});
