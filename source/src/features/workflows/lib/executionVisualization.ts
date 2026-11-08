import type { NodeRuntimeStatus } from '../components/GraphCanvas';
import type { WorkflowExecuteEvidenceEntry, WorkflowNodeInstanceRecord, WorkflowProofEntry } from '../types';

export type EdgeRuntimeStatus = 'idle' | 'active' | 'traversed';

export type ExecutionVisualState = {
  nodeStatusByKey: Record<string, NodeRuntimeStatus>;
  activeEdgeKey?: string;
  traversedEdgeKeys: string[];
};

export const EMPTY_EXECUTION_VISUAL_STATE: ExecutionVisualState = {
  nodeStatusByKey: {},
  traversedEdgeKeys: [],
};

export function buildEdgeStatusByKey(state: ExecutionVisualState): Record<string, EdgeRuntimeStatus> {
  const map: Record<string, EdgeRuntimeStatus> = {};
  for (const edgeKey of state.traversedEdgeKeys) {
    map[edgeKey] = 'traversed';
  }
  if (state.activeEdgeKey) {
    map[state.activeEdgeKey] = 'active';
  }
  return map;
}

function finalizeActiveEdge(state: ExecutionVisualState): void {
  if (!state.activeEdgeKey) return;
  if (!state.traversedEdgeKeys.includes(state.activeEdgeKey)) {
    state.traversedEdgeKeys.push(state.activeEdgeKey);
  }
  state.activeEdgeKey = undefined;
}

function edgeKeyFromDetail(detail: Record<string, unknown>): string | null {
  const edgeKey = detail.edgeKey;
  return typeof edgeKey === 'string' ? edgeKey : null;
}

function edgeKeyFromProofEntry(entry: WorkflowProofEntry): string | null {
  if (entry.traceType !== 'EDGE_SELECTED') return null;
  try {
    const payload = JSON.parse(entry.corePayloadJson) as { edgeKey?: string };
    return typeof payload.edgeKey === 'string' ? payload.edgeKey : null;
  } catch {
    return null;
  }
}

/** Replay simulation evidence up to `endExclusive` for step-by-step canvas animation. */
export function reduceSimulationEvidence(
  evidence: WorkflowExecuteEvidenceEntry[],
  endExclusive: number,
  options?: { markFailedNodeKey?: string | null },
): ExecutionVisualState {
  const state: ExecutionVisualState = {
    nodeStatusByKey: {},
    traversedEdgeKeys: [],
  };

  const limit = Math.min(Math.max(0, endExclusive), evidence.length);
  for (let index = 0; index < limit; index += 1) {
    applySimulationEvidenceEntry(state, evidence[index]);
  }

  if (limit >= evidence.length && options?.markFailedNodeKey) {
    state.nodeStatusByKey[options.markFailedNodeKey] = 'FAILED';
    state.activeEdgeKey = undefined;
  }

  return state;
}

function applySimulationEvidenceEntry(state: ExecutionVisualState, entry: WorkflowExecuteEvidenceEntry): void {
  switch (entry.type) {
    case 'NODE_ENTERED': {
      if (!entry.nodeKey) break;
      finalizeActiveEdge(state);
      state.nodeStatusByKey[entry.nodeKey] = 'RUNNING';
      break;
    }
    case 'EDGE_SELECTED': {
      const edgeKey = edgeKeyFromDetail(entry.detail as Record<string, unknown>);
      if (entry.nodeKey) {
        state.nodeStatusByKey[entry.nodeKey] = 'SUCCEEDED';
      }
      if (edgeKey) {
        state.activeEdgeKey = edgeKey;
      }
      break;
    }
    case 'INSTANCE_SUCCEEDED': {
      if (entry.nodeKey) {
        state.nodeStatusByKey[entry.nodeKey] = 'SUCCEEDED';
      }
      finalizeActiveEdge(state);
      break;
    }
    case 'INSTANCE_FAILED': {
      if (entry.nodeKey) {
        state.nodeStatusByKey[entry.nodeKey] = 'FAILED';
      }
      state.activeEdgeKey = undefined;
      break;
    }
    default:
      break;
  }
}

/** Infer the node that stopped the run when simulation fails without an INSTANCE_FAILED trace. */
export function inferFailedNodeKeyFromEvidence(evidence: WorkflowExecuteEvidenceEntry[]): string | null {
  for (let index = evidence.length - 1; index >= 0; index -= 1) {
    const entry = evidence[index];
    if (entry.type === 'NODE_ENTERED' && entry.nodeKey) {
      return entry.nodeKey;
    }
  }
  return null;
}

export function reduceNodeInstances(nodeInstances: WorkflowNodeInstanceRecord[]): ExecutionVisualState {
  return {
    nodeStatusByKey: Object.fromEntries(
      nodeInstances.map((node) => [node.semanticNodeKey, node.status as NodeRuntimeStatus]),
    ),
    traversedEdgeKeys: [],
  };
}

/** Merge live node statuses with edge traversal from proof traces. */
export function reduceProofAndNodeInstances(
  proof: WorkflowProofEntry[],
  nodeInstances: WorkflowNodeInstanceRecord[],
): ExecutionVisualState {
  const state = reduceNodeInstances(nodeInstances);
  const traversedEdgeKeys: string[] = [];

  for (const entry of proof) {
    const edgeKey = edgeKeyFromProofEntry(entry);
    if (edgeKey && !traversedEdgeKeys.includes(edgeKey)) {
      traversedEdgeKeys.push(edgeKey);
    }
  }

  const runningNode = nodeInstances.find((node) => node.status === 'RUNNING' || node.status === 'READY');
  const lastTraversed = traversedEdgeKeys.at(-1);
  const activeEdgeKey = runningNode && lastTraversed ? lastTraversed : undefined;

  return {
    ...state,
    traversedEdgeKeys: activeEdgeKey ? traversedEdgeKeys.slice(0, -1) : traversedEdgeKeys,
    activeEdgeKey,
  };
}
