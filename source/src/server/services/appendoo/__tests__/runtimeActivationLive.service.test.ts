import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const sampleContext = {
  workspaceId: 'ws-live-1',
  revisionId: 'rev-live-1',
  operationId: 'op-live-1',
  changeSetId: 'cs-live-1',
  changeNode: {
    nodeId: 'node-live-1',
    operationId: 'op-live-1',
    changeSetId: 'cs-live-1',
    operationType: 'CREATE_SERVER_FUNCTION' as const,
    targetRef: { targetKind: 'function' as const, targetId: 'live.exportUsers', ref: 'exportUsers' },
    inputs: {},
    expectedOutputs: ['Export users'],
    dependencies: [],
    requiredCapabilityIds: [],
    workspaceMutationScope: ['appendoo/ws/cs-live-1/**'],
    state: 'PLANNED' as const,
    attempts: 0,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  applicableStandards: [],
  patternVersions: [],
  validatedCapabilities: [],
};

describe('runtimeActivationLive.service', () => {
  let tmpDir = '';
  let origCwd = '';
  let origEnv = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-live-activation-'));
    origCwd = process.cwd();
    origEnv = process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION ?? '';
    process.chdir(tmpDir);
    process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION = '1';
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(origCwd);
    process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION = origEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('persists validated server function artifacts to FunctionFileStore when flag enabled', async () => {
    const { runExecuteScaffold } = await import('../../../../shared/lib/appendoo/builderExecuteScaffold');
    const { workspaceArtifactStore } = await import('../../../../shared/lib/appendoo/workspaceArtifactStore');
    workspaceArtifactStore.resetForTests();

    const execute = runExecuteScaffold(sampleContext);
    expect(execute.ok).toBe(true);

    const { runtimeActivationService } = await import('../runtimeActivation.service');
    const { listManagedFunctionsFromStore } = await import('../../../../core/functions/FunctionFileStore');

    const batch = await runtimeActivationService.activateFromMutationsAsync(execute.mutations);
    expect(batch.failedCount).toBe(0);
    expect(batch.activatedCount).toBeGreaterThan(0);

    const functions = listManagedFunctionsFromStore();
    expect(functions.some((item) => item.id === 'appendoo.exportusers')).toBe(true);
  });
});
