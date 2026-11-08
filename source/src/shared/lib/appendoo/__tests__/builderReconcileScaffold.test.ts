import { describe, expect, it } from 'vitest';
import { runReconcileScaffold, runRollbackScaffold } from '../builderReconcileScaffold';
import { runExecuteScaffold } from '../builderExecuteScaffold';

const sampleNode = {
  nodeId: 'node-rec-1',
  operationId: 'op-rec-1',
  changeSetId: 'cs-rec-1',
  operationType: 'CREATE_PAGE' as const,
  targetRef: { targetKind: 'page' as const, targetId: 'demo-page', ref: 'demo-page' },
  inputs: {},
  expectedOutputs: [],
  dependencies: [],
  requiredCapabilityIds: [],
  workspaceMutationScope: ['appendoo/ws/cs-rec-1/**'],
  state: 'PLANNED' as const,
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

const sampleContext = {
  workspaceId: 'ws-rec-1',
  revisionId: 'rev-rec-1',
  operationId: 'op-rec-1',
  changeSetId: 'cs-rec-1',
  changeNode: sampleNode,
  applicableStandards: [],
  patternVersions: [],
  validatedCapabilities: [],
};

describe('builderReconcileScaffold', () => {
  it('reconciles execute mutations without drift', () => {
    const path = 'appendoo/ws/cs-rec-1/demo-page.artifact.ts';
    const execute = runExecuteScaffold(sampleContext, [path]);
    const reconcile = runReconcileScaffold(sampleContext, execute.mutations);

    expect(reconcile.ok).toBe(true);
    expect(reconcile.driftDetected).toBe(false);
  });

  it('rolls back using execute rollbackData revision', () => {
    const rollback = runRollbackScaffold(sampleContext, sampleNode, {
      revisionId: 'rev-rec-1',
    });

    expect(rollback.ok).toBe(true);
    expect(rollback.restoredArtifacts[0]?.path).toContain('demo-page.rollback.ts');
  });
});
