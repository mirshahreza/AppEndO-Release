import { describe, expect, it, beforeEach } from 'vitest';
import { runExecuteScaffold } from '../builderExecuteScaffold';
import { activateServerFunctionFromWorkspace } from '../runtimeActivationAdapters';
import { planRuntimeActivations } from '../runtimeActivationScaffold';
import { workspaceArtifactStore } from '../workspaceArtifactStore';

const sampleContext = {
  workspaceId: 'ws-adapt-1',
  revisionId: 'rev-adapt-1',
  operationId: 'op-adapt-1',
  changeSetId: 'cs-adapt-1',
  changeNode: {
    nodeId: 'node-adapt-1',
    operationId: 'op-adapt-1',
    changeSetId: 'cs-adapt-1',
    operationType: 'CREATE_SERVER_FUNCTION' as const,
    targetRef: { targetKind: 'function' as const, targetId: 'demo.exportUsers', ref: 'exportUsers' },
    inputs: {},
    expectedOutputs: ['Export users'],
    dependencies: [],
    requiredCapabilityIds: [],
    workspaceMutationScope: ['appendoo/ws/cs-adapt-1/**'],
    state: 'PLANNED' as const,
    attempts: 0,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  applicableStandards: [],
  patternVersions: [],
  validatedCapabilities: [],
};

describe('runtimeActivationAdapters', () => {
  beforeEach(() => {
    workspaceArtifactStore.resetForTests();
  });

  it('activates server function when workspace source and metadata exist', () => {
    const execute = runExecuteScaffold(sampleContext);
    expect(execute.ok).toBe(true);

    const targets = planRuntimeActivations(execute.mutations);
    const sourceTarget = targets.find((target) => target.workspacePath.endsWith('.ts'));
    expect(sourceTarget).toBeTruthy();

    const record = activateServerFunctionFromWorkspace(sourceTarget!);
    expect(record.status).toBe('ACTIVATED');
    expect(record.activationRef).toBe('appendoo.exportusers');
  });
});
