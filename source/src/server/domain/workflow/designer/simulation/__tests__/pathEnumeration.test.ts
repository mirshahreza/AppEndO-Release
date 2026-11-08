import { describe, expect, it } from 'vitest';
import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../../../awm/types';
import { baseModel, endNode, unconditionalEdge, lit } from '../../../publication/__tests__/fixtures';
import { enumerateTerminalStructuralPaths } from '../pathEnumeration';

const model = (nodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[], startKey: string): WorkflowModel => baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: startKey } });

describe('enumerateTerminalStructuralPaths', () => {
  it('enumerates both branches of a DECISION as two distinct terminal paths', () => {
    const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1' }, endNode('e1'), endNode('e2')];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'true-edge', fromNodeKey: 'd1', toNodeKey: 'e1', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'default-edge', fromNodeKey: 'd1', toNodeKey: 'e2', selector: { type: 'DECISION_DEFAULT' } },
    ];
    const m = model(nodes, edges, 'd1');
    const result = enumerateTerminalStructuralPaths(m, 'd1', 100);
    expect(result.truncated).toBe(false);
    expect(result.paths).toHaveLength(2);
    expect(result.paths.map((p) => p.terminalNodeKey).sort()).toEqual(['e1', 'e2']);
    expect(result.uncoveredEdgeKeys).toEqual([]);
  });

  it('a linear chain produces exactly one path', () => {
    const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1', mode: 'FIRST_MATCH' }, endNode('e1')];
    const edges: WorkflowEdgeDefinition[] = [{ key: 'default-edge', fromNodeKey: 'd1', toNodeKey: 'e1', selector: { type: 'DECISION_DEFAULT' } }];
    const m = model(nodes, edges, 'd1');
    const result = enumerateTerminalStructuralPaths(m, 'd1', 100);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].nodeKeys).toEqual(['d1', 'e1']);
  });

  it('truncates deterministically and reports WF_SIM_PATH_ENUMERATION_TRUNCATED without claiming full coverage', () => {
    // A SWITCH with three cases fans out to three END nodes — cap maxPaths below that.
    const nodes: WorkflowNodeDefinition[] = [{ kind: 'SWITCH', key: 's1', value: lit(1) }, endNode('e1'), endNode('e2'), endNode('e3')];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'case1', fromNodeKey: 's1', toNodeKey: 'e1', selector: { type: 'SWITCH_CASE', value: 1 } },
      { key: 'case2', fromNodeKey: 's1', toNodeKey: 'e2', selector: { type: 'SWITCH_CASE', value: 2 } },
      { key: 'default-edge', fromNodeKey: 's1', toNodeKey: 'e3', selector: { type: 'SWITCH_DEFAULT' } },
    ];
    const m = model(nodes, edges, 's1');
    const result = enumerateTerminalStructuralPaths(m, 's1', 2);
    expect(result.truncated).toBe(true);
    expect(result.truncationCode).toBe('WF_SIM_PATH_ENUMERATION_TRUNCATED');
    expect(result.paths.length).toBeLessThanOrEqual(2);
  });

  it('PARALLEL_SPLIT is one structural step directly to its resolved join, not a branch-combinatoric explosion', () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'PARALLEL_SPLIT', key: 'split' },
      { kind: 'DECISION', key: 'branchA' },
      { kind: 'DECISION', key: 'branchB' },
      { kind: 'PARALLEL_JOIN', key: 'join', mode: 'ALL' },
      endNode('e1'),
    ];
    const edges: WorkflowEdgeDefinition[] = [
      unconditionalEdge('e-split-a', 'split', 'branchA'),
      unconditionalEdge('e-split-b', 'split', 'branchB'),
      { key: 'a-default', fromNodeKey: 'branchA', toNodeKey: 'join', selector: { type: 'DECISION_DEFAULT' } },
      { key: 'b-default', fromNodeKey: 'branchB', toNodeKey: 'join', selector: { type: 'DECISION_DEFAULT' } },
      unconditionalEdge('e-join-end', 'join', 'e1'),
    ];
    const m = model(nodes, edges, 'split');
    const result = enumerateTerminalStructuralPaths(m, 'split', 100);
    expect(result.truncated).toBe(false);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].nodeKeys).toEqual(['split', 'join', 'e1']);
  });
});
