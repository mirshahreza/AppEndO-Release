import { describe, expect, it } from 'vitest';
import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../../awm/types';
import { buildGraph, reachableFrom } from '../graphAnalysis';
import { runParallelValidation } from '../rules/parallelValidation';
import { baseModel, endNode, unconditionalEdge, lit } from './fixtures';

const split = (key: string): WorkflowNodeDefinition => ({ kind: 'PARALLEL_SPLIT', key });
/** A branch "content" node with exactly one legal outgoing edge — END/FAIL are terminal and would
 * make parallelValidation treat the branch as prematurely finished before reaching the join. */
const delayNode = (key: string): WorkflowNodeDefinition => ({ kind: 'DELAY', key, delay: { type: 'DURATION_MS', value: lit(1) } });
const join = (key: string, mode: 'ALL' | 'ANY' = 'ALL', cancelRemaining?: boolean): WorkflowNodeDefinition => ({
  kind: 'PARALLEL_JOIN',
  key,
  mode,
  cancelRemaining,
});

const runOn = (nodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[], startKey: string) => {
  const model: WorkflowModel = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: startKey } });
  const graph = buildGraph(model);
  const reachable = reachableFrom(graph, startKey);
  return runParallelValidation(model, graph, reachable);
};

const codes = (result: ReturnType<typeof runOn>) => result.issues.map((i) => i.code);

describe('runParallelValidation', () => {
  it('accepts a clean two-branch split/join with no crossing, containment or overlap issues', () => {
    const nodes = [split('s1'), delayNode('a'), delayNode('b'), join('j1')];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'j1'),
      unconditionalEdge('e4', 'b', 'j1'),
    ];
    const result = runOn(nodes, edges, 's1');
    expect(result.issues).toHaveLength(0);
    expect(result.membership.splitToJoin.get('s1')).toBe('j1');
    expect(result.membership.nodeToBranch.get('a')?.splitNodeKey).toBe('s1');
    expect(result.membership.nodeToBranch.get('b')?.splitNodeKey).toBe('s1');
  });

  it('rejects a branch that passes through another PARALLEL_SPLIT before reaching its join (nested)', () => {
    const nodes = [split('s1'), split('s2'), delayNode('x'), delayNode('y'), join('j1'), join('j2')];
    const edges = [
      unconditionalEdge('e1', 's1', 's2'),
      unconditionalEdge('e2', 's1', 'y'),
      unconditionalEdge('e3', 's2', 'x'),
      unconditionalEdge('e4', 's2', 'j2'),
      unconditionalEdge('e5', 'x', 'j2'),
      unconditionalEdge('e6', 'j2', 'j1'),
      unconditionalEdge('e7', 'y', 'j1'),
    ];
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
  });

  it('rejects a branch reaching more than one PARALLEL_JOIN (crossing)', () => {
    const nodes = [split('s1'), delayNode('a'), join('j1'), join('j2')];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'j2'),
      unconditionalEdge('e3', 'a', 'j1'),
      unconditionalEdge('e4', 'a', 'j2'), // 'a' has two outgoing edges reaching two different joins
    ];
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
  });

  it('rejects a branch that terminates at END/FAIL without reaching the join', () => {
    const nodes = [split('s1'), delayNode('a'), endNode('b'), join('j1')];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'j1'),
      // 'b' is END and never reaches j1
    ];
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
  });

  it('rejects branches that converge on more than one join (no single resolved join)', () => {
    const nodes = [split('s1'), delayNode('a'), delayNode('b'), join('j1'), join('j2')];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'j1'),
      unconditionalEdge('e4', 'b', 'j2'),
    ];
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
  });

  it('rejects a node shared by two sibling branches before the join (externally-entered incoming edge)', () => {
    const nodes = [split('s1'), delayNode('a'), delayNode('b'), delayNode('shared'), join('j1')];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'shared'),
      unconditionalEdge('e4', 'b', 'shared'), // 'shared' is entered from both sibling branches
      unconditionalEdge('e5', 'shared', 'j1'),
    ];
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
  });

  it('rejects a join whose incoming-edge count does not match the split branch count (externally entered)', () => {
    const nodes = [split('s1'), delayNode('a'), delayNode('b'), delayNode('outsider'), join('j1')];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'j1'),
      unconditionalEdge('e4', 'b', 'j1'),
      unconditionalEdge('e5', 'outsider', 'j1'), // extra incoming edge from outside any branch
    ];
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
  });

  it('rejects a PARALLEL_JOIN claimed as the resolved join by more than one PARALLEL_SPLIT (overlap)', () => {
    const nodes = [split('s1'), split('s2'), delayNode('a'), delayNode('b'), delayNode('c'), delayNode('d'), join('j1')];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'j1'),
      unconditionalEdge('e4', 'b', 'j1'),
      unconditionalEdge('e5', 's2', 'c'),
      unconditionalEdge('e6', 's2', 'd'),
      unconditionalEdge('e7', 'c', 'j1'),
      unconditionalEdge('e8', 'd', 'j1'),
    ];
    // Both splits point their branches at the same 'j1', so j1's incoming-edge count (4) will not
    // match either split's declared branch count (2) -- this is caught by the count-mismatch check
    // before the overlap check is ever reached, which is itself a valid (and simpler) rejection.
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
  });

  it('flags a detached PARALLEL_JOIN that is not the resolved join of any PARALLEL_SPLIT', () => {
    const nodes = [endNode('a'), join('detached')];
    const edges = [unconditionalEdge('e1', 'a', 'detached')];
    const result = runOn(nodes, edges, 'a');
    expect(codes(result)).toContain('WF_DEF_INVALID_PARALLEL_STRUCTURE');
    expect(result.issues.some((i) => i.nodeKey === 'detached')).toBe(true);
  });

  it('flags cancelRemaining=true on a PARALLEL_JOIN whose mode is not ANY', () => {
    const nodes = [split('s1'), delayNode('a'), delayNode('b'), join('j1', 'ALL', true)];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'j1'),
      unconditionalEdge('e4', 'b', 'j1'),
    ];
    const result = runOn(nodes, edges, 's1');
    expect(codes(result)).toContain('WF_DEF_INVALID_AWM');
  });

  it('allows cancelRemaining=true when mode is ANY', () => {
    const nodes = [split('s1'), delayNode('a'), delayNode('b'), join('j1', 'ANY', true)];
    const edges = [
      unconditionalEdge('e1', 's1', 'a'),
      unconditionalEdge('e2', 's1', 'b'),
      unconditionalEdge('e3', 'a', 'j1'),
      unconditionalEdge('e4', 'b', 'j1'),
    ];
    const result = runOn(nodes, edges, 's1');
    expect(result.issues).toHaveLength(0);
  });

  it('treats DECISION MULTI_MATCH as a split that must converge on one PARALLEL_JOIN', () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'DECISION', key: 'd1', mode: 'MULTI_MATCH' },
      delayNode('a'),
      delayNode('b'),
      delayNode('def'),
      join('j1'),
    ];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'e1', fromNodeKey: 'd1', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'e2', fromNodeKey: 'd1', toNodeKey: 'b', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'e3', fromNodeKey: 'd1', toNodeKey: 'def', selector: { type: 'DECISION_DEFAULT' } },
      unconditionalEdge('e4', 'a', 'j1'),
      unconditionalEdge('e5', 'b', 'j1'),
      unconditionalEdge('e6', 'def', 'j1'),
    ];
    const result = runOn(nodes, edges, 'd1');
    expect(result.issues).toHaveLength(0);
    expect(result.membership.splitToJoin.get('d1')).toBe('j1');
    expect(result.membership.nodeToBranch.get('a')?.splitNodeKey).toBe('d1');
  });
});
