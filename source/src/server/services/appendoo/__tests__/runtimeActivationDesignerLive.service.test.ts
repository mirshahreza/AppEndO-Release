import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const sampleContext = {
  workspaceId: 'ws-designer-live-1',
  revisionId: 'rev-designer-live-1',
  operationId: 'op-designer-live-1',
  changeSetId: 'cs-designer-live-1',
  changeNode: {
    nodeId: 'node-designer-live-1',
    operationId: 'op-designer-live-1',
    changeSetId: 'cs-designer-live-1',
    operationType: 'CREATE_PAGE' as const,
    targetRef: { targetKind: 'page' as const, targetId: 'appendoo-users-page', ref: 'users-page' },
    inputs: {},
    expectedOutputs: ['Users page'],
    dependencies: [],
    requiredCapabilityIds: [],
    workspaceMutationScope: ['appendoo/ws/cs-designer-live-1/**'],
    state: 'PLANNED' as const,
    attempts: 0,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  applicableStandards: [],
  patternVersions: [],
  validatedCapabilities: [],
};

describe('runtimeActivationDesignerLive.service', () => {
  let tmpDir = '';
  let origCwd = '';
  let origEnv = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-designer-live-'));
    origCwd = process.cwd();
    origEnv = process.env.APPENDOO_LIVE_DESIGNER_PUBLISH ?? '';
    process.chdir(tmpDir);
    process.env.APPENDOO_LIVE_DESIGNER_PUBLISH = '1';
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(origCwd);
    process.env.APPENDOO_LIVE_DESIGNER_PUBLISH = origEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('publishes validated designer draft artifacts when flag enabled', async () => {
    const { runExecuteScaffold } = await import('../../../../shared/lib/appendoo/builderExecuteScaffold');
    const { workspaceArtifactStore } = await import('../../../../shared/lib/appendoo/workspaceArtifactStore');
    workspaceArtifactStore.resetForTests();

    const execute = runExecuteScaffold(sampleContext);
    expect(execute.ok).toBe(true);

    const { runtimeActivationService } = await import('../runtimeActivation.service');
    const { getDesignerPublishState } = await import('../../component-designer/publishCoordinator.service');

    const batch = await runtimeActivationService.activateFromMutationsAsync(execute.mutations);
    expect(batch.failedCount).toBe(0);

    const activatedDraft = batch.records.find(
      (record) => record.kind === 'designer_draft' && record.status === 'ACTIVATED' && record.workspacePath.endsWith('/draft.json'),
    );
    expect(activatedDraft?.activationRef).toBeTruthy();

    const publishState = getDesignerPublishState(activatedDraft!.activationRef!);
    expect(publishState.lifecycle).toBe('published');
    expect(publishState.publishedVersion).toBe(1);
  });

  it('publishes canonical server-function UI when workspace draft slug matches a managed function', async () => {
    const { runExecuteScaffold } = await import('../../../../shared/lib/appendoo/builderExecuteScaffold');
    const { workspaceArtifactStore } = await import('../../../../shared/lib/appendoo/workspaceArtifactStore');
    const { readDraftRecord } = await import('../../../domain/component-designer/draftIo');
    workspaceArtifactStore.resetForTests();

    const serverFunctionContext = {
      ...sampleContext,
      changeNode: {
        ...sampleContext.changeNode,
        targetRef: {
          targetKind: 'page' as const,
          targetId: 'math-sum-two-numbers-calculator',
          ref: 'math-sum-two-numbers-calculator',
        },
        inputs: {
          evidenceIds: ['function:math.sum-two-numbers'],
        },
        expectedOutputs: ['UI for sum-two-numbers'],
      },
    };

    const execute = runExecuteScaffold(serverFunctionContext);
    expect(execute.ok).toBe(true);

    const { runtimeActivationService } = await import('../runtimeActivation.service');
    const batch = await runtimeActivationService.activateFromMutationsAsync(execute.mutations);
    expect(batch.failedCount).toBe(0);

    const activatedDraft = batch.records.find(
      (record) => record.kind === 'designer_draft' && record.status === 'ACTIVATED',
    );
    expect(activatedDraft?.activationRef).toBe('math-sum-two-numbers-calculator');

    const draft = readDraftRecord('math-sum-two-numbers-calculator');
    expect(draft?.name).toBe('UI for sum-two-numbers');
    const paletteIds = Object.values(draft?.document.nodes ?? {}).map(
      (node) => node.props?._designerPaletteItemId,
    );
    expect(paletteIds).toContain('html.form');
    expect(paletteIds).toContain('heroui.number-input');
  });
});
