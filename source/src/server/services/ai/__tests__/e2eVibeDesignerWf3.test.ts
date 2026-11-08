/**
 * E2E WF-3 — modify existing layout via designer_* tools → proposal → apply → Designer handoff.
 * @deprecated AE-22.5 — legacy VibeHarness path; migrate to engineeringPipelineService.runScaffold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertV1LegacyE2eSuiteAllowed } from '../../../../shared/lib/appendoo/appendooV1E2eMigration';
import { clearAgentDrafts } from '../../../../core/ai/tools/native/agentDraftStore';
import { executeDesignerInsertPaletteItem } from '../../../../core/ai/tools/native/designerInsertPaletteItem';
import { executeDesignerSetProp } from '../../../../core/ai/tools/native/designerSetProp';
import { buildChangeSetsFromDrafts } from '../../../../core/ai/validation/changeSetBuilder';
import { validateProposal } from '../../../../core/ai/validation/proposalValidator';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { ChangeSet } from '../../../../shared/api/contracts/ai/agentTypes';

const insertAgentApplySnapshot = vi.fn(async () => 301);
const getAgentApplySnapshotById = vi.fn();

vi.mock('../../../domain/ai/agentApplyRepository', () => ({
  insertAgentApplySnapshot: (...args: unknown[]) => insertAgentApplySnapshot(...args),
  getAgentApplySnapshotById: (...args: unknown[]) => getAgentApplySnapshotById(...args),
  getLatestAgentApplySnapshot: vi.fn(),
  markAgentApplySnapshotRolledBack: vi.fn(async () => true),
}));

const buildDesignerHandoffUrl = (layoutId: string): string => (
  `/client-components?load=${encodeURIComponent(layoutId)}`
);

let tmpDir = '';
let originalCwd = '';

describe('E2E WF-3 designer modify-existing', () => {
  beforeEach(() => {
    assertV1LegacyE2eSuiteAllowed('e2eVibeDesignerWf3');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-wf3-designer-'));
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

  it('pageContext layoutId → designer tools → apply → designer handoff URL', async () => {
    const { saveDesignerDraft } = await import('../../component-designer/draftCoordinator.service');
    const { getDesignerDraft } = await import('../../../domain/component-designer/drafts');

    const existing = saveDesignerDraft({
      name: 'WF3 Existing Grid',
      document: createInitialDesignerState('WF3 Existing Grid').document,
      bindingDefinitions: {},
      actor: 'tester',
    });

    const pageContext = {
      path: '/client-components',
      pageLabel: 'Designer',
      layoutId: existing.id,
      selectedNodeId: existing.document.rootNodeId,
    };

    const insert = await executeDesignerInsertPaletteItem(
      { itemId: 'heroui.button-solid' },
      { mode: 'agent', allowedGroups: ['draft'], pageContext },
    );
    expect(insert.ok).toBe(true);
    if (!insert.ok) return;

    const nodeId = insert.data!.insertedNodeId as string;
    const setProp = await executeDesignerSetProp(
      { propKey: 'text', value: 'Apply filter', draftId: insert.data!.draftId as string },
      {
        mode: 'agent',
        allowedGroups: ['draft'],
        pageContext: { ...pageContext, selectedNodeId: nodeId },
      },
    );
    expect(setProp.ok).toBe(true);
    if (!setProp.ok) return;

    const changeSets = buildChangeSetsFromDrafts([setProp.data!.draftId as string]);
    expect(changeSets.some((cs) => cs.kind === 'component_layout_patch')).toBe(true);

    const validation = validateProposal(changeSets, {
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });
    expect(validation.violations.filter((v) => v.severity === 'error')).toHaveLength(0);

    const layoutChangeSet = changeSets.find(
      (cs): cs is Extract<ChangeSet, { kind: 'component_layout_patch' }> => cs.kind === 'component_layout_patch',
    );
    expect(layoutChangeSet?.layoutId).toBe(existing.id);

    const patch = layoutChangeSet?.patch as Record<string, unknown> | undefined;
    expect(patch?.baseLayoutId).toBe(existing.id);
    expect(patch?.previousDocument).toBeTruthy();

    const { changeSetService } = await import('../changeSet.service');
    const applyResult = await changeSetService.apply({
      proposalId: 'wf3-prop',
      changeSets: [layoutChangeSet!],
      confirmOverrideWarnings: true,
    }, 1, DEFAULT_AI_AGENT_SETTINGS);

    expect(applyResult.appliedCount).toBe(1);
    expect(applyResult.designerHandoff?.[0]?.layoutId).toBe(existing.id);
    expect(applyResult.designerHandoff?.[0]?.name).toBe('WF3 Existing Grid');

    const persisted = getDesignerDraft(existing.id);
    expect(persisted?.name).toBe('WF3 Existing Grid');
    expect(persisted?.metadata.updatedBy).toBe('ai-agent');

    const buttonNode = Object.values(persisted!.document.nodes).find(
      (node) => node.props?.text === 'Apply filter',
    );
    expect(buttonNode).toBeTruthy();
    expect(buttonNode?.type).toBe('link');

    const handoffUrl = buildDesignerHandoffUrl(applyResult.designerHandoff![0]!.layoutId);
    expect(handoffUrl).toBe(`/client-components?load=${encodeURIComponent(existing.id)}`);
  });
});
