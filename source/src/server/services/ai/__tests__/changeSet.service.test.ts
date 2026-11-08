import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from '../../../../domain/component-designer/documentSchema';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { ChangeSet } from '../../../../shared/api/contracts/ai/agentTypes';

type AgentApplySnapshotInput = { snapshotsJson: string };

const agentApplyRepositoryMocks = vi.hoisted(() => ({
  insertAgentApplySnapshot: vi.fn<(input: AgentApplySnapshotInput) => Promise<number>>(async () => 101),
  getAgentApplySnapshotById: vi.fn(),
  markAgentApplySnapshotRolledBack: vi.fn(async () => true),
  updateAgentApplySnapshotsJson: vi.fn(async () => true),
}));

vi.mock('../../../domain/ai/agentApplyRepository', () => ({
  insertAgentApplySnapshot: agentApplyRepositoryMocks.insertAgentApplySnapshot,
  getAgentApplySnapshotById: agentApplyRepositoryMocks.getAgentApplySnapshotById,
  getLatestAgentApplySnapshot: vi.fn(),
  markAgentApplySnapshotRolledBack: agentApplyRepositoryMocks.markAgentApplySnapshotRolledBack,
  updateAgentApplySnapshotsJson: agentApplyRepositoryMocks.updateAgentApplySnapshotsJson,
}));

const {
  insertAgentApplySnapshot,
  getAgentApplySnapshotById,
  markAgentApplySnapshotRolledBack,
  updateAgentApplySnapshotsJson,
} = agentApplyRepositoryMocks;

vi.mock('../../jobs/jobServerFunctionExecutor', () => ({
  executeManagedFunctionForJob: vi.fn(async () => ({
    statusCode: 200,
    body: { success: true },
  })),
}));

let tmpDir = '';
let originalCwd = '';

describe('ChangeSetService', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-change-set-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('src/shared/ui', { recursive: true });
    fs.mkdirSync('plans/core/todo', { recursive: true });
    insertAgentApplySnapshot.mockClear();
    getAgentApplySnapshotById.mockReset();
    markAgentApplySnapshotRolledBack.mockClear();
    updateAgentApplySnapshotsJson.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('applies and rolls back file patches', async () => {
    const targetPath = 'src/shared/ui/Example.tsx';
    const absolutePath = path.join(tmpDir, targetPath);
    fs.writeFileSync(absolutePath, 'export const before = true;\n', 'utf8');

    const { changeSetService } = await import('../changeSet.service');
    const changeSets: ChangeSet[] = [{
      id: 'cs-file',
      kind: 'file_patch',
      title: 'Update example',
      path: targetPath,
      content: 'export const after = true;\n',
    }];

    const applyResult = await changeSetService.apply({
      proposalId: 'prop-file',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(applyResult.applyId).toBe(101);
    expect(fs.readFileSync(absolutePath, 'utf8')).toBe('export const after = true;\n');

    getAgentApplySnapshotById.mockResolvedValue({
      id: 101,
      rolled_back_at: null,
      change_sets_json: JSON.stringify(changeSets),
      snapshots_json: JSON.stringify([{
        changeSetId: 'cs-file',
        kind: 'file_patch',
        target: targetPath,
        before: { content: 'export const before = true;\n' },
      }]),
    });

    const rollbackResult = await changeSetService.rollback({ applyId: 101 }, 1);
    expect(rollbackResult.rolledBackCount).toBe(1);
    expect(rollbackResult.allRolledBack).toBe(true);
    expect(markAgentApplySnapshotRolledBack).toHaveBeenCalledWith(101, 1);
    expect(fs.readFileSync(absolutePath, 'utf8')).toBe('export const before = true;\n');
  });

  it('rolls back a single change set when changeSetIds is provided', async () => {
    const firstPath = 'src/shared/ui/First.tsx';
    const secondPath = 'src/shared/ui/Second.tsx';
    fs.writeFileSync(path.join(tmpDir, firstPath), 'export const firstBefore = true;\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, secondPath), 'export const secondBefore = true;\n', 'utf8');

    const { changeSetService } = await import('../changeSet.service');
    const changeSets: ChangeSet[] = [
      {
        id: 'cs-first',
        kind: 'file_patch',
        title: 'Update first',
        path: firstPath,
        content: 'export const firstAfter = true;\n',
      },
      {
        id: 'cs-second',
        kind: 'file_patch',
        title: 'Update second',
        path: secondPath,
        content: 'export const secondAfter = true;\n',
      },
    ];

    const applyResult = await changeSetService.apply({
      proposalId: 'prop-partial',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(applyResult.appliedChanges).toHaveLength(2);

    getAgentApplySnapshotById.mockResolvedValue({
      id: applyResult.applyId,
      rolled_back_at: null,
      change_sets_json: JSON.stringify(changeSets),
      snapshots_json: JSON.stringify([
        {
          changeSetId: 'cs-first',
          kind: 'file_patch',
          target: firstPath,
          before: { content: 'export const firstBefore = true;\n' },
        },
        {
          changeSetId: 'cs-second',
          kind: 'file_patch',
          target: secondPath,
          before: { content: 'export const secondBefore = true;\n' },
        },
      ]),
    });

    const rollbackResult = await changeSetService.rollback({
      applyId: applyResult.applyId,
      changeSetIds: ['cs-first'],
    }, 1);

    expect(rollbackResult.rolledBackCount).toBe(1);
    expect(rollbackResult.allRolledBack).toBe(false);
    expect(markAgentApplySnapshotRolledBack).not.toHaveBeenCalled();
    expect(updateAgentApplySnapshotsJson).toHaveBeenCalled();
    expect(fs.readFileSync(path.join(tmpDir, firstPath), 'utf8')).toBe('export const firstBefore = true;\n');
    expect(fs.readFileSync(path.join(tmpDir, secondPath), 'utf8')).toBe('export const secondAfter = true;\n');
    expect(rollbackResult.appliedChanges?.filter((item) => !item.rolledBack)).toHaveLength(1);
  });

  it('rolls back a single diff zone without reverting the whole file', async () => {
    const targetPath = 'src/shared/ui/Zone.tsx';
    const absolutePath = path.join(tmpDir, targetPath);
    const before = 'line1\nline2\nline3\n';
    const after = 'line1\nCHANGED\nline3\n';
    fs.writeFileSync(absolutePath, before, 'utf8');

    const { changeSetService } = await import('../changeSet.service');
    const changeSets: ChangeSet[] = [{
      id: 'cs-zone',
      kind: 'file_patch',
      title: 'Zone patch',
      path: targetPath,
      beforeContent: before,
      content: after,
      diffZones: [{ startLine: 2, endLine: 2 }],
    }];

    const applyResult = await changeSetService.apply({
      proposalId: 'prop-zone',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(fs.readFileSync(absolutePath, 'utf8')).toBe(after);
    expect(applyResult.appliedChanges?.[0]?.diffZones).toEqual([{ startLine: 2, endLine: 2 }]);

    getAgentApplySnapshotById.mockResolvedValue({
      id: applyResult.applyId,
      rolled_back_at: null,
      change_sets_json: JSON.stringify(changeSets),
      snapshots_json: JSON.stringify([{
        changeSetId: 'cs-zone',
        kind: 'file_patch',
        target: targetPath,
        before: { content: before },
      }]),
    });

    const rollbackResult = await changeSetService.rollback({
      applyId: applyResult.applyId,
      diffZoneRollbacks: [{ changeSetId: 'cs-zone', zones: [{ startLine: 2, endLine: 2 }] }],
    }, 1);

    expect(rollbackResult.rolledBackCount).toBe(1);
    expect(rollbackResult.allRolledBack).toBe(true);
    expect(fs.readFileSync(absolutePath, 'utf8')).toBe(before);
    expect(rollbackResult.appliedChanges?.[0]?.rolledBack).toBe(true);
  });

  it('applies and rolls back component layout patches', async () => {
    const { saveDesignerDraft } = await import('../../component-designer/draftCoordinator.service');
    const { getDesignerDraft } = await import('../../../domain/component-designer/drafts');
    const { changeSetService } = await import('../changeSet.service');

    const existing = saveDesignerDraft({
      name: 'Original layout',
      document: createInitialDesignerState().document,
      bindingDefinitions: {
        definitions: {},
        dataSources: {},
        lovs: {},
        storeSegments: {},
      },
      actor: 'tester',
    });

    const updatedDocument = structuredClone(existing.document);
    updatedDocument.name = 'Updated layout';

    const changeSets: ChangeSet[] = [{
      id: 'cs-layout',
      kind: 'component_layout_patch',
      title: 'Update layout',
      layoutId: existing.id,
      patch: {
        name: 'Updated layout',
        folder: existing.folder,
        document: updatedDocument,
        bindingDefinitions: existing.bindingDefinitions,
      },
    }];

    const applyResult = await changeSetService.apply({
      proposalId: 'prop-layout',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(applyResult.designerHandoff).toEqual([{
      layoutId: existing.id,
      name: 'Updated layout',
      componentPath: 'general/updated-layout',
    }]);
    const persisted = getDesignerDraft(existing.id);
    expect(persisted?.name).toBe('Updated layout');
    expect(persisted?.document.schemaVersion).toBe(DESIGNER_DOCUMENT_SCHEMA_VERSION);
    expect(persisted?.document.diagnostics).toEqual([]);
    expect(persisted?.metadata.updatedBy).toBe('ai-agent');

    const snapshotCall = insertAgentApplySnapshot.mock.calls[0]?.[0];
    expect(snapshotCall?.snapshotsJson).toContain('"existed":true');

    getAgentApplySnapshotById.mockResolvedValue({
      id: applyResult.applyId,
      rolled_back_at: null,
      snapshots_json: snapshotCall!.snapshotsJson,
    });

    const rollbackResult = await changeSetService.rollback({ applyId: applyResult.applyId }, 1);
    expect(rollbackResult.rolledBackCount).toBe(1);
    expect(getDesignerDraft(existing.id)?.name).toBe('Original layout');
  });

  it('rejects component layout apply when document has unknown slot id', async () => {
    const { changeSetService } = await import('../changeSet.service');
    const document = createInitialDesignerState('Invalid Slot Layout').document;
    const rootId = document.rootNodeId;
    const nodeId = 'invalid-slot-node';

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
      id: 'cs-invalid-slot',
      kind: 'component_layout_patch',
      title: 'Invalid slot layout',
      layoutId: 'invalid-slot-layout',
      patch: {
        name: 'Invalid Slot Layout',
        folder: 'general',
        document,
        bindingDefinitions: {},
      },
    }];

    await expect(changeSetService.apply({
      proposalId: 'prop-invalid-slot',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('not registered in the platform catalog'),
    });
  });

  it('removes newly created layouts on rollback', async () => {
    const { getDesignerDraft } = await import('../../../domain/component-designer/drafts');
    const { changeSetService } = await import('../changeSet.service');

    const layoutId = 'new-agent-layout';
    const document = createInitialDesignerState().document;
    document.id = layoutId;
    document.name = 'New layout';

    const changeSets: ChangeSet[] = [{
      id: 'cs-new-layout',
      kind: 'component_layout_patch',
      title: 'Create layout',
      layoutId,
      patch: {
        name: 'New layout',
        folder: 'general',
        document,
        bindingDefinitions: {},
      },
    }];

    const applyResult = await changeSetService.apply({
      proposalId: 'prop-new-layout',
      changeSets,
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(getDesignerDraft(layoutId)).not.toBeNull();

    const snapshotCall = insertAgentApplySnapshot.mock.calls.at(-1)?.[0];
    getAgentApplySnapshotById.mockResolvedValue({
      id: applyResult.applyId,
      rolled_back_at: null,
      snapshots_json: snapshotCall!.snapshotsJson,
    });

    await changeSetService.rollback({ applyId: applyResult.applyId }, 1);
    expect(getDesignerDraft(layoutId)).toBeNull();
  });

  it('applies and rolls back function source patches', async () => {
    const { findManagedFunctionById } = await import('../../../domain/functions/functionRepository');
    const { changeSetService } = await import('../changeSet.service');

    const functionId = 'custom.agent-fn';
    const originalSource = `async function handler() {
  res.json({ success: true, value: 'before' });
}
(async () => { await handler(); })();
`;
    const updatedSource = `async function handler() {
  res.json({ success: true, value: 'after' });
}
(async () => { await handler(); })();
`;

    const createChangeSet: ChangeSet = {
      id: 'cs-fn-create',
      kind: 'function_source_patch',
      title: 'Create function',
      functionId,
      patch: {
        name: 'Agent Fn',
        folder: 'custom',
        method: 'GET',
        path: '/api/custom/agent-fn',
        source: originalSource,
      },
    };

    const updateChangeSet: ChangeSet = {
      id: 'cs-fn-update',
      kind: 'function_source_patch',
      title: 'Update function',
      functionId,
      patch: {
        name: 'Agent Fn',
        folder: 'custom',
        method: 'GET',
        path: '/api/custom/agent-fn',
        source: updatedSource,
      },
    };

    const createApply = await changeSetService.apply({
      proposalId: 'prop-fn-create',
      changeSets: [createChangeSet],
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(createApply.verification?.ok).toBe(true);
    expect(createApply.verification?.checks.some((check) => check.id.startsWith('function_source_patch:'))).toBe(true);

    expect((await findManagedFunctionById(functionId))?.code).toBe(originalSource);

    const createSnapshot = insertAgentApplySnapshot.mock.calls.at(-1)?.[0];
    getAgentApplySnapshotById.mockResolvedValue({
      id: createApply.applyId,
      rolled_back_at: null,
      snapshots_json: createSnapshot!.snapshotsJson,
    });

    await changeSetService.rollback({ applyId: createApply.applyId }, 1);
    expect(await findManagedFunctionById(functionId)).toBeNull();

    await changeSetService.apply({
      proposalId: 'prop-fn-seed',
      changeSets: [createChangeSet],
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    const updateApply = await changeSetService.apply({
      proposalId: 'prop-fn-update',
      changeSets: [updateChangeSet],
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect((await findManagedFunctionById(functionId))?.code).toBe(updatedSource);

    const updateSnapshot = insertAgentApplySnapshot.mock.calls.at(-1)?.[0];
    getAgentApplySnapshotById.mockResolvedValue({
      id: updateApply.applyId,
      rolled_back_at: null,
      snapshots_json: updateSnapshot!.snapshotsJson,
    });

    await changeSetService.rollback({ applyId: updateApply.applyId }, 1);
    expect((await findManagedFunctionById(functionId))?.code).toBe(originalSource);
  });

  it('records dismissed pre-apply proposal feedback', async () => {
    const { changeSetService } = await import('../changeSet.service');
    const { clearProposalOutcomeRecords, summarizeProposalOutcomes } = await import(
      '../../../../shared/lib/appendoo/proposalOutcomeTelemetry'
    );

    clearProposalOutcomeRecords();
    const result = changeSetService.recordDismissedProposal({
      proposalId: 'prop-dismiss',
      changeSetCount: 2,
    });

    expect(result.outcome).toBe('dismissed_pre_apply');
    expect(result.proposalId).toBe('prop-dismiss');
    expect(summarizeProposalOutcomes().dismissedPreApply).toBe(1);
  });

  it('p-98: apply-time validation regains propose-time scope checks when a proposal context was captured', async () => {
    const targetPath = 'src/shared/ui/Unrelated.tsx';
    const absolutePath = path.join(tmpDir, targetPath);
    fs.writeFileSync(absolutePath, 'export const before = true;\n', 'utf8');

    const { changeSetService } = await import('../changeSet.service');
    const { putProposalContext } = await import('../../../../core/ai/validation/proposalContextStore');
    const changeSets: ChangeSet[] = [{
      id: 'cs-unrelated',
      kind: 'file_patch',
      title: 'Update unrelated file',
      path: targetPath,
      content: 'export const after = true;\n',
    }];

    // No proposal context captured (e.g. an old proposal, or propose() never called
    // putProposalContext) — behaves exactly as before this fix: no scope narrowing, warnings absent.
    const applyResult = await changeSetService.apply({
      proposalId: 'prop-no-context',
      changeSets,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);
    expect(applyResult.applyId).toBe(101);

    // A proposal context WAS captured at propose time, pointing at a different file than this
    // changeSet touches — apply-time validation must now surface the same "unrelated file"
    // warning propose-time validation would have, instead of silently skipping it.
    putProposalContext('prop-with-context', {
      userIntentPaths: ['src/shared/ui/SomethingElse.tsx'],
    });

    await expect(changeSetService.apply({
      proposalId: 'prop-with-context',
      changeSets,
    }, 1, DEFAULT_AI_AGENT_SETTINGS)).rejects.toThrow('Proposal has warnings');
  });
});
