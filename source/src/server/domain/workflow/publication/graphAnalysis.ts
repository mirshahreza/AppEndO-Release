import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../awm/types';

/**
 * Shared pure graph-shape helpers for publication validation (doc 05 sections 13, 22, 25, 26, 32).
 * No persistence, no Action registry — this module only reasons about the AWM node/edge graph.
 * Callers are expected to have already confirmed nodes/edges have unique keys (structuralRules.ts)
 * before relying on the maps built here.
 */

export type WorkflowGraph = {
  model: WorkflowModel;
  nodeByKey: Map<string, WorkflowNodeDefinition>;
  outgoing: Map<string, WorkflowEdgeDefinition[]>;
  incoming: Map<string, WorkflowEdgeDefinition[]>;
  order: string[];
};

export function buildGraph(model: WorkflowModel): WorkflowGraph {
  const nodeByKey = new Map<string, WorkflowNodeDefinition>();
  for (const node of model.nodes) nodeByKey.set(node.key, node);

  const outgoing = new Map<string, WorkflowEdgeDefinition[]>();
  const incoming = new Map<string, WorkflowEdgeDefinition[]>();
  for (const node of model.nodes) {
    outgoing.set(node.key, []);
    incoming.set(node.key, []);
  }
  for (const edge of model.edges) {
    if (outgoing.has(edge.fromNodeKey)) outgoing.get(edge.fromNodeKey)!.push(edge);
    if (incoming.has(edge.toNodeKey)) incoming.get(edge.toNodeKey)!.push(edge);
  }
  return { model, nodeByKey, outgoing, incoming, order: model.nodes.map((n) => n.key) };
}

/** BFS reachable node keys from the start target, following graph edges only (Start itself has no edge). */
export function reachableFrom(graph: WorkflowGraph, startKey: string): Set<string> {
  const seen = new Set<string>();
  if (!graph.nodeByKey.has(startKey)) return seen;
  const queue = [startKey];
  seen.add(startKey);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.outgoing.get(current) ?? []) {
      if (!seen.has(edge.toNodeKey) && graph.nodeByKey.has(edge.toNodeKey)) {
        seen.add(edge.toNodeKey);
        queue.push(edge.toNodeKey);
      }
    }
  }
  return seen;
}

/** Kahn's algorithm restricted to reachable nodes; returns null when a cycle exists among them. */
export function topologicalOrder(graph: WorkflowGraph, reachable: Set<string>): string[] | null {
  const indegree = new Map<string, number>();
  for (const key of reachable) indegree.set(key, 0);
  for (const key of reachable) {
    for (const edge of graph.outgoing.get(key) ?? []) {
      if (reachable.has(edge.toNodeKey)) {
        indegree.set(edge.toNodeKey, (indegree.get(edge.toNodeKey) ?? 0) + 1);
      }
    }
  }
  const queue: string[] = [];
  for (const [key, deg] of indegree) if (deg === 0) queue.push(key);
  queue.sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const nextBatch: string[] = [];
    for (const edge of graph.outgoing.get(current) ?? []) {
      if (!reachable.has(edge.toNodeKey)) continue;
      const remaining = (indegree.get(edge.toNodeKey) ?? 0) - 1;
      indegree.set(edge.toNodeKey, remaining);
      if (remaining === 0) nextBatch.push(edge.toNodeKey);
    }
    nextBatch.sort();
    queue.push(...nextBatch);
  }
  return order.length === reachable.size ? order : null;
}

/**
 * Iterative dataflow dominator computation (Cooper/Harvey/Kennedy), restricted to the reachable
 * acyclic subgraph. `order` MUST be a valid topological order of `reachable` (start first). Used
 * by expressionRules.ts to enforce doc 05 section 26's NODE_OUTPUT structural-dominance rule:
 * `NODE_OUTPUT(nodeKey)` is legal at a consumer only when nodeKey dominates the consumer.
 */
export function computeDominators(graph: WorkflowGraph, startKey: string, order: string[]): Map<string, Set<string>> {
  const indexOf = new Map<string, number>(order.map((key, index) => [key, index]));
  const dom = new Map<string, Set<string>>();
  const all = new Set(order);
  for (const key of order) dom.set(key, key === startKey ? new Set([startKey]) : new Set(all));

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of order) {
      if (key === startKey) continue;
      const preds = (graph.incoming.get(key) ?? []).map((e) => e.fromNodeKey).filter((p) => indexOf.has(p));
      if (preds.length === 0) continue;
      let intersection: Set<string> | null = null;
      for (const pred of preds) {
        const predDom = dom.get(pred)!;
        if (intersection === null) {
          intersection = new Set(predDom);
        } else {
          for (const value of Array.from(intersection)) {
            if (!predDom.has(value)) intersection.delete(value);
          }
        }
      }
      const next = intersection ?? new Set<string>();
      next.add(key);
      const current = dom.get(key)!;
      if (next.size !== current.size || Array.from(next).some((v) => !current.has(v))) {
        dom.set(key, next);
        changed = true;
      }
    }
  }
  return dom;
}

export function dominates(dom: Map<string, Set<string>>, candidateAncestor: string, consumer: string): boolean {
  return dom.get(consumer)?.has(candidateAncestor) ?? false;
}
