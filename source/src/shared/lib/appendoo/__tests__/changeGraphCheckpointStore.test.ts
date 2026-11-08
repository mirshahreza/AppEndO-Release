import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildChangeGraphCheckpoint,
  changeGraphCheckpointStore,
} from '../changeGraphCheckpointStore';
import {
  resumeChangeGraphExecution,
  transitionNodeState,
} from '../changeGraphScheduler';
import type { ChangeNode } from '../../../api/contracts/appendoo/changeGraph.types';

const baseNode = (
  nodeId: string,
  targetKind: ChangeNode['targetRef']['targetKind'],
  operationType: ChangeNode['operationType'] = 'CREATE_ENTITY',
): ChangeNode => ({
  nodeId,
  operationId: `op:${nodeId}`,
  changeSetId: 'cs-checkpoint-1',
  operationType,
  targetRef: { targetKind, targetId: nodeId, ref: nodeId },
  inputs: {},
  expectedOutputs: [],
  dependencies: [],
  requiredCapabilityIds: [],
  workspaceMutationScope: ['appendoo/ws/cs-checkpoint-1/**'],
  state: 'PLANNED',
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
});

describe('changeGraphCheckpointStore', () => {
  beforeEach(() => {
    changeGraphCheckpointStore.resetForTests();
  });

  it('persists and reads scheduler checkpoints', () => {
    const checkpoint = buildChangeGraphCheckpoint({
      changeGraphId: 'cg:checkpoint:1',
      changeSetId: 'cs-checkpoint-1',
      nodes: [baseNode('node-a', 'entity')],
      results: [{ nodeId: 'node-a', ok: true, state: 'VERIFIED' }],
      summary: {
        readyCount: 0,
        builtCount: 1,
        verifiedCount: 1,
        failedCount: 0,
        retriedCount: 0,
        parallelPeakCount: 1,
      },
    });

    changeGraphCheckpointStore.save(checkpoint);
    expect(changeGraphCheckpointStore.read('cg:checkpoint:1')?.checkpointId).toBe(checkpoint.checkpointId);
  });

  it('resumes graph execution from checkpoint without re-running verified nodes', () => {
    const graph = {
      changeGraphId: 'cg:checkpoint:resume',
      changeSetId: 'cs-checkpoint-1',
      applicationScopeRef: 'platform:studio',
      revision: 1,
      nodes: [
        {
          ...baseNode('node-a', 'entity'),
          state: 'VERIFIED',
        },
        transitionNodeState(
          {
            ...baseNode('node-b', 'function', 'CREATE_SERVER_FUNCTION'),
            dependencies: ['node-a'],
          },
          'READY',
        ),
      ],
      compiledAt: '2026-07-11T00:00:00.000Z',
      compilerVersion: '1.0.0',
    };

    changeGraphCheckpointStore.save(buildChangeGraphCheckpoint({
      changeGraphId: graph.changeGraphId,
      changeSetId: graph.changeSetId,
      nodes: graph.nodes,
      results: [{ nodeId: 'node-a', ok: true, state: 'VERIFIED' }],
      summary: {
        readyCount: 1,
        builtCount: 1,
        verifiedCount: 1,
        failedCount: 0,
        retriedCount: 0,
        parallelPeakCount: 1,
      },
    }));

    const executedNodeIds: string[] = [];
    const resumed = resumeChangeGraphExecution(
      graph,
      (node) => {
        executedNodeIds.push(node.nodeId);
        return { ok: true };
      },
      (result) => result.ok,
    );

    expect(executedNodeIds).toEqual(['node-b']);
    expect(resumed.summary.verifiedCount).toBe(2);
  });
});
