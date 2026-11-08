import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILDER_REGISTRY } from '../../../api/contracts/appendoo/builderProtocol.types';
import {
  createBuilderContextScaffold,
  resolveBuilderForOperation,
  validateBuilderMutationPaths,
} from '../builderProtocolScaffold';

const sampleNode = {
  nodeId: 'node-1',
  operationId: 'op-1',
  changeSetId: 'cs-1',
  operationType: 'CREATE_SERVER_FUNCTION' as const,
  targetRef: { targetKind: 'function' as const, targetId: 'demo.fn' },
  inputs: {},
  expectedOutputs: [],
  dependencies: [],
  requiredCapabilityIds: [],
  workspaceMutationScope: ['appendoo/ws/cs-1/**'],
  state: 'PLANNED' as const,
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

describe('builderProtocolScaffold', () => {
  it('resolves ServerFunctionBuilder for server function operations', () => {
    const entry = resolveBuilderForOperation({
      operationType: 'CREATE_SERVER_FUNCTION',
    });
    expect(entry?.builderType).toBe('ServerFunctionBuilder');
  });

  it('keeps WorkflowBuilder disabled without workflow capability', () => {
    const entry = resolveBuilderForOperation({
      operationType: 'CREATE_WORKFLOW',
    });
    expect(entry).toBeNull();

    const enabled = resolveBuilderForOperation(
      { operationType: 'CREATE_WORKFLOW', enabledCapabilities: ['workflow'] },
      DEFAULT_BUILDER_REGISTRY.map((item) => (
        item.builderType === 'WorkflowBuilder' ? { ...item, enabled: true } : item
      )),
    );
    expect(enabled?.builderType).toBe('WorkflowBuilder');
  });

  it('creates builder context scaffold', () => {
    const context = createBuilderContextScaffold({
      workspaceId: 'ws-1',
      revisionId: 'rev-1',
      changeSetId: 'cs-1',
      changeNode: sampleNode,
    });

    expect(context.workspaceId).toBe('ws-1');
    expect(context.operationId).toBe('op-1');
    expect(context.changeNode.nodeId).toBe('node-1');
  });

  it('rejects active-root mutation paths during validate', () => {
    const result = validateBuilderMutationPaths([
      'appendoo/ws/cs-1/demo.ts',
      'src/server/routes/users.routes.ts',
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('Active-root mutation rejected'))).toBe(true);
  });
});
