import { describe, expect, it } from 'vitest';
import {
  resolveBuilderPrimitivePaths,
  resolveBuilderTypeForOperation,
  resolveWorkspaceMutationPath,
} from '../builderPrimitivePaths';

const baseNode = {
  nodeId: 'node-prim-1',
  operationId: 'op-prim-1',
  changeSetId: 'cs-prim-1',
  targetRef: { targetKind: 'function' as const, targetId: 'demo.exportUsers', ref: 'demo.exportUsers' },
  inputs: {},
  expectedOutputs: [],
  dependencies: [],
  requiredCapabilityIds: [],
  workspaceMutationScope: ['appendoo/ws/cs-prim-1/**'],
  state: 'PLANNED' as const,
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

describe('builderPrimitivePaths', () => {
  it('maps server function operations to workspace/server-functions/custom paths', () => {
    const paths = resolveBuilderPrimitivePaths({
      ...baseNode,
      operationType: 'CREATE_SERVER_FUNCTION',
    });

    expect(paths).toEqual([
      'appendoo/ws/cs-prim-1/workspace/server-functions/custom/demo.exportUsers.ts',
      'appendoo/ws/cs-prim-1/workspace/server-functions/custom/demo.exportUsers.metadata.json',
    ]);
    expect(resolveBuilderTypeForOperation('CREATE_SERVER_FUNCTION')).toBe('ServerFunctionBuilder');
  });

  it('maps page operations to designer draft paths', () => {
    const path = resolveWorkspaceMutationPath({
      ...baseNode,
      operationType: 'CREATE_PAGE',
      targetRef: { targetKind: 'page', targetId: 'users-page', ref: 'users-page' },
    });

    expect(path).toBe('appendoo/ws/cs-prim-1/workspace/designer/drafts/users-page/draft.json');
    expect(resolveBuilderTypeForOperation('CREATE_PAGE')).toBe('PageComponentBuilder');
  });

  it('maps route operations to platform-registry paths', () => {
    const paths = resolveBuilderPrimitivePaths({
      ...baseNode,
      operationType: 'CREATE_ROUTE',
      targetRef: { targetKind: 'route', targetId: 'studio/users', ref: 'studio/users' },
    });

    expect(paths[0]).toBe('appendoo/ws/cs-prim-1/workspace/platform-registry/routes/studio-users.json');
  });

  it('never resolves paths under active application roots', () => {
    const paths = resolveBuilderPrimitivePaths({
      ...baseNode,
      operationType: 'MODIFY_COMPONENT',
      targetRef: { targetKind: 'component', targetId: 'users-grid', ref: 'users-grid' },
    });

    for (const mutationPath of paths) {
      expect(mutationPath.startsWith('appendoo/ws/cs-prim-1/')).toBe(true);
      expect(mutationPath.includes('src/features/')).toBe(false);
      expect(mutationPath.includes('src/server/')).toBe(false);
    }
  });
});
