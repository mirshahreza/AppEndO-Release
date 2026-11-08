import { describe, expect, it } from 'vitest';
import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../../awm/types';
import { buildGraph, reachableFrom, topologicalOrder, computeDominators, dominates } from '../graphAnalysis';

const node = (key: string): WorkflowNodeDefinition => ({ kind: 'END', key, output: { type: 'OBJECT', fields: {} } });
const edge = (key: string, fromNodeKey: string, toNodeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'UNCONDITIONAL' },
});

const modelOf = (nodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[]): WorkflowModel => ({
  schemaVersion: '1',
  key: 'w',
  name: 'w',
  inputSchema: { type: 'INLINE', schema: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  variables: [],
  start: { type: 'MANUAL_API', targetNodeKey: nodes[0]?.key ?? '__none__' },
  nodes,
  edges,
  policies: {
    recoveryDetectionBoundMs: 1,
    limits: {
      maxNodes: 100, maxEdges: 100, maxPayloadBytes: 100000, maxJsonDepth: 20,
      maxExpressionNodes: 500, maxStructuralPathCandidates: 1000, maxDelayMs: 86400000,
      maxWaitTimeoutMs: 86400000, maxWorkItemTitleLength: 200,
    },
  },
});

describe('graphAnalysis', () => {
  it('buildGraph indexes nodes and edges into outgoing/incoming maps', () => {
    const model = modelOf([node('a'), node('b')], [edge('e1', 'a', 'b')]);
    const graph = buildGraph(model);
    expect(graph.outgoing.get('a')).toHaveLength(1);
    expect(graph.incoming.get('b')).toHaveLength(1);
    expect(graph.incoming.get('a')).toHaveLength(0);
  });

  it('reachableFrom performs a BFS following edges only, ignoring unreachable islands', () => {
    const model = modelOf([node('a'), node('b'), node('c'), node('isolated')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]);
    const graph = buildGraph(model);
    const reachable = reachableFrom(graph, 'a');
    expect(reachable).toEqual(new Set(['a', 'b', 'c']));
  });

  it('reachableFrom returns an empty set for an unknown start key', () => {
    const model = modelOf([node('a')], []);
    const graph = buildGraph(model);
    expect(reachableFrom(graph, 'ghost').size).toBe(0);
  });

  it('topologicalOrder returns a valid order for an acyclic reachable subgraph', () => {
    const model = modelOf([node('a'), node('b'), node('c')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]);
    const graph = buildGraph(model);
    const reachable = reachableFrom(graph, 'a');
    const order = topologicalOrder(graph, reachable);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('topologicalOrder returns null when the reachable subgraph contains a cycle', () => {
    const model = modelOf([node('a'), node('b')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]);
    const graph = buildGraph(model);
    const reachable = reachableFrom(graph, 'a');
    expect(topologicalOrder(graph, reachable)).toBeNull();
  });

  it('topologicalOrder breaks ties deterministically by key ordinal', () => {
    const model = modelOf(
      [node('start'), node('z'), node('a'), node('m')],
      [edge('e1', 'start', 'z'), edge('e2', 'start', 'a'), edge('e3', 'start', 'm')],
    );
    const graph = buildGraph(model);
    const reachable = reachableFrom(graph, 'start');
    const order = topologicalOrder(graph, reachable);
    expect(order).toEqual(['start', 'a', 'm', 'z']);
  });

  it('computeDominators: a diamond join is dominated only by the shared ancestor, not either branch', () => {
    // start -> left -> join, start -> right -> join
    const model = modelOf(
      [node('start'), node('left'), node('right'), node('join')],
      [
        edge('e1', 'start', 'left'),
        edge('e2', 'start', 'right'),
        edge('e3', 'left', 'join'),
        edge('e4', 'right', 'join'),
      ],
    );
    const graph = buildGraph(model);
    const reachable = reachableFrom(graph, 'start');
    const order = topologicalOrder(graph, reachable)!;
    const dom = computeDominators(graph, 'start', order);

    expect(dominates(dom, 'start', 'join')).toBe(true);
    expect(dominates(dom, 'left', 'join')).toBe(false);
    expect(dominates(dom, 'right', 'join')).toBe(false);
    expect(dominates(dom, 'start', 'left')).toBe(true);
    expect(dominates(dom, 'right', 'left')).toBe(false);
  });

  it('computeDominators: a linear chain fully dominates downstream', () => {
    const model = modelOf([node('a'), node('b'), node('c')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]);
    const graph = buildGraph(model);
    const reachable = reachableFrom(graph, 'a');
    const order = topologicalOrder(graph, reachable)!;
    const dom = computeDominators(graph, 'a', order);
    expect(dominates(dom, 'a', 'c')).toBe(true);
    expect(dominates(dom, 'b', 'c')).toBe(true);
  });
});
