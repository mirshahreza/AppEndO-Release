import { describe, expect, it, beforeEach } from 'vitest';
import {
  executeRuntimeActivation,
  planRuntimeActivations,
} from '../runtimeActivationScaffold';
import { runExecuteScaffold } from '../builderExecuteScaffold';
import { workspaceArtifactStore } from '../workspaceArtifactStore';

describe('runtimeActivationScaffold', () => {
  beforeEach(() => {
    workspaceArtifactStore.resetForTests();
  });

  it('plans activation targets for server function workspace paths', () => {
    const execute = runExecuteScaffold({
      workspaceId: 'ws-1',
      revisionId: 'rev-1',
      operationId: 'op-1',
      changeSetId: 'cs-1',
      changeNode: {
        nodeId: 'node-1',
        operationId: 'op-1',
        changeSetId: 'cs-1',
        operationType: 'CREATE_SERVER_FUNCTION',
        targetRef: { targetKind: 'function', targetId: 'demo.fn', ref: 'demo.fn' },
        inputs: {},
        expectedOutputs: [],
        dependencies: [],
        requiredCapabilityIds: [],
        workspaceMutationScope: ['appendoo/ws/cs-1/**'],
        state: 'PLANNED',
        attempts: 0,
        createdAt: '2026-07-11T00:00:00.000Z',
        updatedAt: '2026-07-11T00:00:00.000Z',
      },
      applicableStandards: [],
      patternVersions: [],
      validatedCapabilities: [],
    });

    const targets = planRuntimeActivations(execute.mutations);
    expect(targets.some((target) => target.kind === 'server_function')).toBe(true);
    expect(targets[0]?.activationApi).toBe('FunctionFileStore.activateFromWorkspace');
  });

  it('activates known primitive kinds after builder workspace write', () => {
    const execute = runExecuteScaffold({
      workspaceId: 'ws-2',
      revisionId: 'rev-2',
      operationId: 'op-2',
      changeSetId: 'cs-2',
      changeNode: {
        nodeId: 'node-2',
        operationId: 'op-2',
        changeSetId: 'cs-2',
        operationType: 'CREATE_SERVER_FUNCTION',
        targetRef: { targetKind: 'function', targetId: 'demo.fn', ref: 'demo.fn' },
        inputs: {},
        expectedOutputs: [],
        dependencies: [],
        requiredCapabilityIds: [],
        workspaceMutationScope: ['appendoo/ws/cs-2/**'],
        state: 'PLANNED',
        attempts: 0,
        createdAt: '2026-07-11T00:00:00.000Z',
        updatedAt: '2026-07-11T00:00:00.000Z',
      },
      applicableStandards: [],
      patternVersions: [],
      validatedCapabilities: [],
    });

    const result = executeRuntimeActivation(planRuntimeActivations(execute.mutations));
    expect(result.activatedCount).toBeGreaterThan(0);
    expect(result.failedCount).toBe(0);
  });
});
