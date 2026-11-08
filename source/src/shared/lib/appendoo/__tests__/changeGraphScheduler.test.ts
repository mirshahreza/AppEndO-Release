import { describe, expect, it } from 'vitest';
import type { ChangeNode } from '../../../api/contracts/appendoo/changeGraph.types';
import {
  getRunnableNodes,
  getRunnableNodesWithBranchLocks,
  inferChangeNodeDependencies,
  initializeSchedulerGraph,
  retryEligibleFailedNodes,
  scheduleChangeGraphExecution,
} from '../changeGraphScheduler';

const baseNode = (
  nodeId: string,
  targetKind: ChangeNode['targetRef']['targetKind'],
  operationType: ChangeNode['operationType'],
): ChangeNode => ({
  nodeId,
  operationId: `op:${nodeId}`,
  changeSetId: 'cs-sched-1',
  operationType,
  targetRef: { targetKind, targetId: nodeId, ref: nodeId },
  inputs: {},
  expectedOutputs: [],
  dependencies: [],
  requiredCapabilityIds: [],
  workspaceMutationScope: ['appendoo/ws/cs-sched-1/**'],
  state: 'PLANNED',
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
});

describe('changeGraphScheduler', () => {
  it('infers entity before server function dependencies', () => {
    const nodes = inferChangeNodeDependencies([
      baseNode('node-fn', 'function', 'CREATE_SERVER_FUNCTION'),
      baseNode('node-entity', 'entity', 'CREATE_ENTITY'),
    ]);

    const fnNode = nodes.find((node) => node.nodeId === 'node-fn');
    expect(fnNode?.dependencies).toContain('node-entity');
  });

  it('runs READY nodes and marks them VERIFIED', () => {
    const graph = initializeSchedulerGraph({
      changeGraphId: 'cg:sched:1',
      changeSetId: 'cs-sched-1',
      applicationScopeRef: 'platform:studio',
      revision: 1,
      nodes: inferChangeNodeDependencies([
        baseNode('node-entity', 'entity', 'CREATE_ENTITY'),
        baseNode('node-fn', 'function', 'CREATE_SERVER_FUNCTION'),
      ]),
      compiledAt: '2026-07-11T00:00:00.000Z',
      compilerVersion: '1.0.0',
    });

    expect(getRunnableNodes(graph.nodes).map((node) => node.nodeId)).toEqual(['node-entity']);

    const scheduled = scheduleChangeGraphExecution(
      graph,
      () => ({ ok: true }),
      (result) => result.ok,
    );

    expect(scheduled.summary.verifiedCount).toBe(2);
    expect(scheduled.graph.nodes.every((node) => node.state === 'VERIFIED')).toBe(true);
  });

  it('retries retryable FAILED nodes up to max attempts', () => {
    const graph = initializeSchedulerGraph({
      changeGraphId: 'cg:sched:retry',
      changeSetId: 'cs-sched-retry',
      applicationScopeRef: 'platform:studio',
      revision: 1,
      nodes: [baseNode('node-only', 'entity', 'CREATE_ENTITY')],
      compiledAt: '2026-07-11T00:00:00.000Z',
      compilerVersion: '1.0.0',
    });

    let attempts = 0;
    const scheduled = scheduleChangeGraphExecution(
      graph,
      () => {
        attempts += 1;
        return { ok: attempts >= 2 };
      },
      (result) => result.ok,
      { maxAttempts: 2 },
    );

    expect(attempts).toBe(2);
    expect(scheduled.summary.verifiedCount).toBe(1);
    expect(scheduled.summary.retriedCount).toBe(1);
  });

  it('runs independent branches in parallel batches', () => {
    const graph = initializeSchedulerGraph({
      changeGraphId: 'cg:sched:parallel',
      changeSetId: 'cs-sched-parallel',
      applicationScopeRef: 'platform:studio',
      revision: 1,
      nodes: [
        baseNode('node-entity-a', 'entity', 'CREATE_ENTITY'),
        baseNode('node-entity-b', 'entity', 'CREATE_ENTITY'),
      ],
      compiledAt: '2026-07-11T00:00:00.000Z',
      compilerVersion: '1.0.0',
    });

    const scheduled = scheduleChangeGraphExecution(
      graph,
      () => ({ ok: true }),
      (result) => result.ok,
    );

    expect(scheduled.summary.parallelPeakCount).toBe(2);
    expect(scheduled.summary.verifiedCount).toBe(2);
  });

  it('respects branch locks for runnable node selection', () => {
    const nodes = inferChangeNodeDependencies([
      baseNode('node-entity', 'entity', 'CREATE_ENTITY'),
      baseNode('node-fn', 'function', 'CREATE_SERVER_FUNCTION'),
    ]);
    const readyGraph = initializeSchedulerGraph({
      changeGraphId: 'cg:sched:lock',
      changeSetId: 'cs-sched-lock',
      applicationScopeRef: 'platform:studio',
      revision: 1,
      nodes,
      compiledAt: '2026-07-11T00:00:00.000Z',
      compilerVersion: '1.0.0',
    });

    const entityNode = readyGraph.nodes.find((node) => node.nodeId === 'node-entity');
    expect(entityNode).toBeTruthy();

    const locked = getRunnableNodesWithBranchLocks(readyGraph.nodes, new Set(['node-entity']));
    expect(locked.map((node) => node.nodeId)).toEqual([]);

    const retried = retryEligibleFailedNodes([
      {
        ...entityNode!,
        state: 'FAILED',
        attempts: 1,
        failure: {
          code: 'BUILDER_EXECUTE_FAILED',
          message: 'temporary',
          retryable: true,
          at: '2026-07-11T00:00:00.000Z',
        },
      },
    ]);

    expect(retried[0]?.state).toBe('READY');
  });
});
