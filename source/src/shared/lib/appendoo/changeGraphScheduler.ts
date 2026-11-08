import type {
  ChangeGraph,
  ChangeNode,
  ChangeNodeState,
} from '../../api/contracts/appendoo/changeGraph.types';
import {
  buildChangeGraphCheckpoint,
  changeGraphCheckpointStore,
} from './changeGraphCheckpointStore';
import { assertValidChangeNodeTransition } from './changeGraphStateMachine';

const nowIso = (): string => new Date().toISOString();

/** Dependency priority — lower runs first (Phase 14). */
const TARGET_KIND_ORDER: Record<ChangeNode['targetRef']['targetKind'], number> = {
  entity: 10,
  relation: 20,
  migration: 25,
  function: 30,
  component: 40,
  page: 50,
  route: 60,
  permission: 70,
  workflow: 75,
  package: 80,
  configuration: 90,
};

export const inferChangeNodeDependencies = (nodes: ChangeNode[]): ChangeNode[] => {
  const sorted = [...nodes].sort((left, right) => (
    TARGET_KIND_ORDER[left.targetRef.targetKind] - TARGET_KIND_ORDER[right.targetRef.targetKind]
  ));

  return sorted.map((node, index) => {
    const predecessors = sorted
      .slice(0, index)
      .filter((candidate) => (
        TARGET_KIND_ORDER[candidate.targetRef.targetKind] < TARGET_KIND_ORDER[node.targetRef.targetKind]
      ))
      .map((candidate) => candidate.nodeId);

    const dependencies = node.dependencies.length > 0 ? node.dependencies : predecessors;
    return {
      ...node,
      dependencies,
    };
  });
};

export const initializeSchedulerGraph = (graph: ChangeGraph): ChangeGraph => {
  const nodes = inferChangeNodeDependencies(graph.nodes).map((node) => ({
    ...node,
    state: node.dependencies.length === 0 ? 'READY' as ChangeNodeState : 'PLANNED' as ChangeNodeState,
    updatedAt: nowIso(),
  }));

  return { ...graph, nodes };
};

const isDependencyVerified = (node: ChangeNode, nodesById: Map<string, ChangeNode>): boolean => (
  node.dependencies.every((dependencyId) => nodesById.get(dependencyId)?.state === 'VERIFIED')
);

export const getRunnableNodes = (nodes: ChangeNode[]): ChangeNode[] => {
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  return nodes.filter((node) => node.state === 'READY' && isDependencyVerified(node, nodesById));
};

export const markNodesReady = (nodes: ChangeNode[]): ChangeNode[] => {
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));

  return nodes.map((node) => {
    if (node.state !== 'PLANNED') return node;
    if (!isDependencyVerified(node, nodesById)) return node;
    return {
      ...node,
      state: 'READY',
      updatedAt: nowIso(),
    };
  });
};

export const transitionNodeState = (
  node: ChangeNode,
  state: ChangeNodeState,
  patch: Partial<ChangeNode> = {},
): ChangeNode => {
  const transition = assertValidChangeNodeTransition(node.state, state);
  if (!transition.ok) {
    throw new Error(transition.reason);
  }

  return {
    ...node,
    ...patch,
    state,
    updatedAt: nowIso(),
  };
};

export type ScheduledNodeExecutionResult = {
  nodeId: string;
  ok: boolean;
  state: ChangeNodeState;
};

export type ChangeGraphSchedulerSummary = {
  readyCount: number;
  builtCount: number;
  verifiedCount: number;
  failedCount: number;
  retriedCount: number;
  parallelPeakCount: number;
};

export const DEFAULT_MAX_NODE_RETRY_ATTEMPTS = 2;

export const summarizeSchedulerGraph = (nodes: ChangeNode[]): ChangeGraphSchedulerSummary => ({
  readyCount: nodes.filter((node) => node.state === 'READY').length,
  builtCount: nodes.filter((node) => node.state === 'BUILT' || node.state === 'VERIFYING' || node.state === 'VERIFIED').length,
  verifiedCount: nodes.filter((node) => node.state === 'VERIFIED').length,
  failedCount: nodes.filter((node) => node.state === 'FAILED').length,
  retriedCount: nodes.filter((node) => node.attempts > 1).length,
  parallelPeakCount: 0,
});

/** AE-7.4 — re-queue retryable FAILED nodes when attempts remain. */
export const retryEligibleFailedNodes = (
  nodes: ChangeNode[],
  maxAttempts: number = DEFAULT_MAX_NODE_RETRY_ATTEMPTS,
): ChangeNode[] => (
  nodes.map((node) => {
    if (node.state !== 'FAILED') return node;
    if (!node.failure?.retryable) return node;
    if (node.attempts >= maxAttempts) return node;

    return {
      ...node,
      state: 'READY',
      failure: undefined,
      updatedAt: nowIso(),
    };
  })
);

/** AE-7.4 — branch lock key from root dependency chain (parallel isolation). */
export const resolveChangeNodeBranchId = (
  node: ChangeNode,
  nodesById: Map<string, ChangeNode>,
): string => {
  let current = node;
  const visited = new Set<string>();

  while (current.dependencies.length > 0) {
    if (visited.has(current.nodeId)) break;
    visited.add(current.nodeId);
    const rootDependency = current.dependencies[0];
    const parent = nodesById.get(rootDependency);
    if (!parent) break;
    current = parent;
  }

  return current.nodeId;
};

export const getRunnableNodesWithBranchLocks = (
  nodes: ChangeNode[],
  lockedBranchIds: Set<string> = new Set(),
): ChangeNode[] => {
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  const runnable = getRunnableNodes(nodes);

  return runnable.filter((node) => !lockedBranchIds.has(resolveChangeNodeBranchId(node, nodesById)));
};

/** AE-7.3/7.4 — run READY nodes with retry, parallel batches and branch locks. */
export const scheduleChangeGraphExecution = <T>(
  graph: ChangeGraph,
  executeNode: (node: ChangeNode) => T,
  isSuccess: (result: T) => boolean,
  options?: {
    maxAttempts?: number;
    initialNodes?: ChangeNode[];
    resumeResults?: ScheduledNodeExecutionResult[];
    persistCheckpoint?: boolean;
  },
): {
  graph: ChangeGraph;
  results: ScheduledNodeExecutionResult[];
  summary: ChangeGraphSchedulerSummary;
  checkpointId?: string;
} => {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_NODE_RETRY_ATTEMPTS;
  let nodes = options?.initialNodes ?? initializeSchedulerGraph(graph).nodes;
  const results: ScheduledNodeExecutionResult[] = [...(options?.resumeResults ?? [])];
  let parallelPeakCount = 0;
  const activeBranchLocks = new Set<string>();

  let guard = 0;
  while (guard < nodes.length * 6) {
    guard += 1;
    nodes = markNodesReady(nodes);
    nodes = retryEligibleFailedNodes(nodes, maxAttempts);
    const runnable = getRunnableNodesWithBranchLocks(nodes, activeBranchLocks);
    if (runnable.length === 0) break;

    parallelPeakCount = Math.max(parallelPeakCount, runnable.length);
    const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));

    for (const node of runnable) {
      const branchId = resolveChangeNodeBranchId(node, nodesById);
      activeBranchLocks.add(branchId);

      const buildingIndex = nodes.findIndex((item) => item.nodeId === node.nodeId);
      nodes[buildingIndex] = transitionNodeState(nodes[buildingIndex], 'BUILDING');

      const execution = executeNode(nodes[buildingIndex]);
      const ok = isSuccess(execution);

      nodes[buildingIndex] = transitionNodeState(
        nodes[buildingIndex],
        ok ? 'BUILT' : 'FAILED',
        {
          attempts: nodes[buildingIndex].attempts + 1,
          failure: ok
            ? undefined
            : {
              code: 'BUILDER_EXECUTE_FAILED',
              message: `Builder execute failed for ${node.nodeId}.`,
              retryable: true,
              at: nowIso(),
            },
        },
      );

      if (ok) {
        nodes[buildingIndex] = transitionNodeState(nodes[buildingIndex], 'VERIFYING');
        nodes[buildingIndex] = transitionNodeState(nodes[buildingIndex], 'VERIFIED', {
          result: {
            summary: `Verified ${node.operationType}`,
            fingerprint: node.operationId,
          },
        });
      }

      results.push({
        nodeId: node.nodeId,
        ok,
        state: nodes[buildingIndex].state,
      });

      activeBranchLocks.delete(branchId);
    }

    if (options?.persistCheckpoint !== false) {
      const summary = summarizeSchedulerGraph(nodes);
      changeGraphCheckpointStore.save(buildChangeGraphCheckpoint({
        changeGraphId: graph.changeGraphId,
        changeSetId: graph.changeSetId,
        nodes,
        results,
        summary: {
          ...summary,
          parallelPeakCount,
        },
      }));
    }
  }

  const summary = summarizeSchedulerGraph(nodes);
  const checkpoint = changeGraphCheckpointStore.read(graph.changeGraphId);

  return {
    graph: { ...graph, nodes },
    results,
    summary: {
      ...summary,
      parallelPeakCount,
    },
    checkpointId: checkpoint?.checkpointId,
  };
};

/** AE-7.5 — resume graph execution from last persisted checkpoint. */
export const resumeChangeGraphExecution = <T>(
  graph: ChangeGraph,
  executeNode: (node: ChangeNode) => T,
  isSuccess: (result: T) => boolean,
  options?: { maxAttempts?: number },
): ReturnType<typeof scheduleChangeGraphExecution<T>> => {
  const checkpoint = changeGraphCheckpointStore.read(graph.changeGraphId);
  if (!checkpoint) {
    return scheduleChangeGraphExecution(graph, executeNode, isSuccess, options);
  }

  return scheduleChangeGraphExecution(graph, executeNode, isSuccess, {
    ...options,
    initialNodes: checkpoint.nodes,
    resumeResults: checkpoint.results,
  });
};
