import type { WorkflowModel } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import { buildGraph, type WorkflowGraph } from '../../publication/graphAnalysis';
import { resolveSplitJoin } from '../../engine/parallelResolution';

/**
 * Terminal structural-path coverage — doc 05 section 18, doc 11 sections 6 and 23. Enumerates
 * every distinct structural path (a sequence of edges, not evaluated conditions — a validated
 * model's edges are already exhaustively typed by kind, so "every path" means every combination of
 * outgoing-edge choices at DECISION/SWITCH nodes) from a start node to a terminal END/FAIL node.
 * PARALLEL_SPLIT is treated as one single structural step to its resolved join (doc 05 section 32:
 * V1 parallel topology is single-level and every required branch always executes, so branching
 * combinatorics do not apply there the way they do at DECISION/SWITCH). Truncates deterministically
 * at `maxPaths` and reports `WF_SIM_PATH_ENUMERATION_TRUNCATED` — a truncated run can never claim
 * full terminal-path coverage (doc 11 section 23).
 */

export type StructuralPath = { nodeKeys: string[]; edgeKeys: string[]; terminalNodeKey: string; terminalKind: 'END' | 'FAIL' };

export type PathCoverageResult = {
  paths: StructuralPath[];
  truncated: boolean;
  /** Present only when `truncated` — doc 11 section 23: "any truncated run carries WF_SIM_PATH_ENUMERATION_TRUNCATED". A partial `paths` list is still returned so a UI panel can show it, clearly banner-marked as not a full-coverage claim. */
  truncationCode?: typeof WORKFLOW_ERROR_REGISTRY.PATH_ENUMERATION_TRUNCATED;
  uncoveredEdgeKeys: string[];
};

function nextSteps(graph: WorkflowGraph, model: WorkflowModel, nodeKey: string): Array<{ edgeKey: string | null; toNodeKey: string }> {
  const node = graph.nodeByKey.get(nodeKey);
  if (!node) return [];
  if (node.kind === 'PARALLEL_SPLIT' || (node.kind === 'DECISION' && node.mode === 'MULTI_MATCH')) {
    // Single structural step directly to the resolved join — see module doc comment.
    const joinNodeKey = resolveSplitJoin(model, nodeKey);
    return [{ edgeKey: null, toNodeKey: joinNodeKey }];
  }
  return (graph.outgoing.get(nodeKey) ?? []).map((edge) => ({ edgeKey: edge.key, toNodeKey: edge.toNodeKey }));
}

export function enumerateTerminalStructuralPaths(model: WorkflowModel, startNodeKey: string, maxPaths: number): PathCoverageResult {
  const graph = buildGraph(model);
  const paths: StructuralPath[] = [];
  const coveredEdgeKeys = new Set<string>();
  let truncated = false;

  const stack: Array<{ nodeKey: string; nodeKeys: string[]; edgeKeys: string[] }> = [{ nodeKey: startNodeKey, nodeKeys: [startNodeKey], edgeKeys: [] }];

  while (stack.length > 0) {
    if (paths.length >= maxPaths) {
      truncated = true;
      break;
    }
    const current = stack.pop()!;
    const node = graph.nodeByKey.get(current.nodeKey);
    if (!node) continue;

    if (node.kind === 'END' || node.kind === 'FAIL') {
      paths.push({ nodeKeys: current.nodeKeys, edgeKeys: current.edgeKeys, terminalNodeKey: node.key, terminalKind: node.kind });
      for (const edgeKey of current.edgeKeys) coveredEdgeKeys.add(edgeKey);
      continue;
    }

    const steps = nextSteps(graph, model, current.nodeKey);
    // Deterministic order: declared edge order (already the graph's own edge array order).
    for (const step of [...steps].reverse()) {
      if (current.nodeKeys.includes(step.toNodeKey) && node.kind !== 'PARALLEL_JOIN') {
        // A validated (acyclic) model cannot legitimately revisit a node outside a join-merge —
        // defensively skip rather than loop forever.
        continue;
      }
      stack.push({
        nodeKey: step.toNodeKey,
        nodeKeys: [...current.nodeKeys, step.toNodeKey],
        edgeKeys: step.edgeKey ? [...current.edgeKeys, step.edgeKey] : current.edgeKeys,
      });
    }
  }

  const allEdgeKeys = model.edges.map((e) => e.key);
  const uncoveredEdgeKeys = allEdgeKeys.filter((k) => !coveredEdgeKeys.has(k));

  return { paths, truncated, truncationCode: truncated ? WORKFLOW_ERROR_REGISTRY.PATH_ENUMERATION_TRUNCATED : undefined, uncoveredEdgeKeys };
}
