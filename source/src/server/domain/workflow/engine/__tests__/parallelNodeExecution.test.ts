import { describe, expect, it } from 'vitest';
import { evaluateParallelSplitNode, evaluateParallelJoinNode } from '../nodeExecution';
import { resolveSplitJoin, resolveJoinTargetInfo } from '../parallelResolution';
import { baseModel, parallelSplitNode, parallelJoinNode, endNode, unconditionalEdge } from './fixtures';
import type { WorkflowEdgeDefinition } from '../../awm/types';

describe('evaluateParallelSplitNode', () => {
  it('returns START_PARALLEL with one branch per UNCONDITIONAL outgoing edge', () => {
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'e1', fromNodeKey: 's1', toNodeKey: 'a', selector: { type: 'UNCONDITIONAL' } },
      { key: 'e2', fromNodeKey: 's1', toNodeKey: 'b', selector: { type: 'UNCONDITIONAL' } },
    ];
    const decision = evaluateParallelSplitNode({ kind: 'PARALLEL_SPLIT', key: 's1' }, edges);
    expect(decision).toEqual({
      kind: 'START_PARALLEL',
      splitNodeKey: 's1',
      branches: [
        { edgeKey: 'e1', branchTokenDescriptor: 'e1' },
        { edgeKey: 'e2', branchTokenDescriptor: 'e2' },
      ],
    });
  });

  it('throws WF_EXEC_ENGINE_INVARIANT with fewer than two UNCONDITIONAL edges', () => {
    const edges: WorkflowEdgeDefinition[] = [{ key: 'e1', fromNodeKey: 's1', toNodeKey: 'a', selector: { type: 'UNCONDITIONAL' } }];
    expect(() => evaluateParallelSplitNode({ kind: 'PARALLEL_SPLIT', key: 's1' }, edges)).toThrow(expect.objectContaining({ code: 'WF_EXEC_ENGINE_INVARIANT' }));
  });
});

describe('evaluateParallelJoinNode', () => {
  it('selects the single UNCONDITIONAL outgoing edge with null output', () => {
    const edges: WorkflowEdgeDefinition[] = [{ key: 'e-join-out', fromNodeKey: 'j1', toNodeKey: 'end-1', selector: { type: 'UNCONDITIONAL' } }];
    const decision = evaluateParallelJoinNode({ kind: 'PARALLEL_JOIN', key: 'j1', mode: 'ALL' }, edges);
    expect(decision).toEqual({ kind: 'SELECT_EDGE', edgeKey: 'e-join-out', nodeOutput: null });
  });

  it('throws WF_EXEC_ENGINE_INVARIANT with no UNCONDITIONAL outgoing edge', () => {
    expect(() => evaluateParallelJoinNode({ kind: 'PARALLEL_JOIN', key: 'j1', mode: 'ALL' }, [])).toThrow(expect.objectContaining({ code: 'WF_EXEC_ENGINE_INVARIANT' }));
  });
});

describe('resolveSplitJoin / resolveJoinTargetInfo', () => {
  // Minimal valid single-level parallel region (doc 05 section 32): both branches are a single
  // ACTION-shaped placeholder node (DECISION reused as a cheap stand-in) reaching the same join.
  const model = baseModel({
    nodes: [parallelSplitNode('split1'), { kind: 'DECISION', key: 'a' }, { kind: 'DECISION', key: 'b' }, parallelJoinNode('join1', 'ANY', true), endNode('end-1')],
    edges: [
      unconditionalEdge('e-split-a', 'split1', 'a'),
      unconditionalEdge('e-split-b', 'split1', 'b'),
      { key: 'e-a-join', fromNodeKey: 'a', toNodeKey: 'join1', selector: { type: 'DECISION_DEFAULT' } },
      { key: 'e-b-join', fromNodeKey: 'b', toNodeKey: 'join1', selector: { type: 'DECISION_DEFAULT' } },
      unconditionalEdge('e-join-end', 'join1', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
  });

  it('resolveSplitJoin finds the resolved join for a valid single-level region', () => {
    expect(resolveSplitJoin(model, 'split1')).toBe('join1');
  });

  it('resolveSplitJoin throws WF_EXEC_ENGINE_INVARIANT for a split with no resolved join', () => {
    const brokenModel = baseModel({ nodes: [parallelSplitNode('split1'), endNode('end-1')], edges: [unconditionalEdge('e1', 'split1', 'end-1'), unconditionalEdge('e2', 'split1', 'end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'split1' } });
    expect(() => resolveSplitJoin(brokenModel, 'split1')).toThrow(expect.objectContaining({ code: 'WF_EXEC_ENGINE_INVARIANT' }));
  });

  it('resolveJoinTargetInfo reports non-join targets correctly', () => {
    expect(resolveJoinTargetInfo(model, 'a')).toEqual({ targetIsJoin: false });
  });

  it('resolveJoinTargetInfo reports join targets with mode/cancelRemaining', () => {
    expect(resolveJoinTargetInfo(model, 'join1')).toEqual({ targetIsJoin: true, join: { mode: 'ANY', cancelRemaining: true } });
  });

  it('resolveJoinTargetInfo defaults cancelRemaining to false when omitted', () => {
    const modelWithAll = baseModel({ ...model, nodes: model.nodes.map((n) => (n.key === 'join1' ? { kind: 'PARALLEL_JOIN' as const, key: 'join1', mode: 'ALL' as const } : n)) });
    expect(resolveJoinTargetInfo(modelWithAll, 'join1')).toEqual({ targetIsJoin: true, join: { mode: 'ALL', cancelRemaining: false } });
  });
});
