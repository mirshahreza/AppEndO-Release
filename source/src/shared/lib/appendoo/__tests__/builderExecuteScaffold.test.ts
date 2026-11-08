import { describe, expect, it } from 'vitest';
import { resolveWorkspaceMutationPath, runExecuteScaffold } from '../builderExecuteScaffold';

const sampleNode = {
  nodeId: 'node-exec-1',
  operationId: 'op-exec-1',
  changeSetId: 'cs-exec-1',
  operationType: 'CREATE_PAGE' as const,
  targetRef: { targetKind: 'page' as const, targetId: 'demo-page', ref: 'demo-page' },
  inputs: {},
  expectedOutputs: [],
  dependencies: [],
  requiredCapabilityIds: [],
  workspaceMutationScope: ['appendoo/ws/cs-exec-1/**'],
  state: 'PLANNED' as const,
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

describe('builderExecuteScaffold', () => {
  it('resolves workspace mutation path under change set scope', () => {
    expect(resolveWorkspaceMutationPath(sampleNode)).toBe(
      'appendoo/ws/cs-exec-1/workspace/designer/drafts/demo-page/draft.json',
    );
  });

  it('records execute mutations in workspace scope', () => {
    const path = resolveWorkspaceMutationPath(sampleNode);
    const result = runExecuteScaffold({
      workspaceId: 'ws-1',
      revisionId: 'rev-1',
      operationId: 'op-exec-1',
      changeSetId: 'cs-exec-1',
      changeNode: sampleNode,
      applicableStandards: [],
      patternVersions: [],
      validatedCapabilities: [],
    }, [path]);

    expect(result.ok).toBe(true);
    expect(result.phase).toBe('execute');
    expect(result.mutations[0]?.path).toBe(path);
  });
});
