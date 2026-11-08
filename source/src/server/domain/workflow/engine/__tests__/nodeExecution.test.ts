import { describe, expect, it } from 'vitest';
import { evaluateDecisionNode, evaluateSwitchNode, evaluateEndNode, evaluateFailNode, applyOutputAssignments, outgoingEdgesOf } from '../nodeExecution';
import type { EvaluationContext } from '../expressionEvaluator';
import type { CanonicalExpression, DecisionNodeDefinition, EndNodeDefinition, FailNodeDefinition, SwitchNodeDefinition, WorkflowEdgeDefinition, WorkflowModel } from '../../awm/types';

const lit = (value: unknown): CanonicalExpression => ({ op: 'LITERAL', value: value as never });
const inputPath = (segments: (string | number)[]): CanonicalExpression => ({ op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments } });

const baseContext: EvaluationContext = {
  workflowInput: { total: 145_000_000 },
  variables: {},
  nodeOutputs: {},
  currentNodeInput: null,
};

describe('evaluateDecisionNode', () => {
  const node: DecisionNodeDefinition = { kind: 'DECISION', key: 'd1' };
  const edges: WorkflowEdgeDefinition[] = [
    { key: 'e-high', fromNodeKey: 'd1', toNodeKey: 'high', selector: { type: 'DECISION', condition: { op: 'GTE', left: inputPath(['total']), right: lit(100_000_000) } } },
    { key: 'e-default', fromNodeKey: 'd1', toNodeKey: 'low', selector: { type: 'DECISION_DEFAULT' } },
  ];

  it('EXACT_ONE selects the unique true edge', () => {
    const decision = evaluateDecisionNode(node, edges, baseContext);
    expect(decision).toEqual({ kind: 'SELECT_EDGE', edgeKey: 'e-high', nodeOutput: null });
  });

  it('EXACT_ONE selects DECISION_DEFAULT when zero conditions are true', () => {
    const lowContext: EvaluationContext = { ...baseContext, workflowInput: { total: 1 } };
    const decision = evaluateDecisionNode(node, edges, lowContext);
    expect(decision).toEqual({ kind: 'SELECT_EDGE', edgeKey: 'e-default', nodeOutput: null });
  });

  it('EXACT_ONE fails with WF_EXEC_AMBIGUOUS_DECISION when more than one condition is true', () => {
    const ambiguousEdges: WorkflowEdgeDefinition[] = [
      ...edges,
      { key: 'e-also-high', fromNodeKey: 'd1', toNodeKey: 'also', selector: { type: 'DECISION', condition: { op: 'GTE', left: inputPath(['total']), right: lit(1) } } },
    ];
    expect(() => evaluateDecisionNode(node, ambiguousEdges, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_AMBIGUOUS_DECISION' }));
  });

  it('throws WF_EXEC_ENGINE_INVARIANT when no DECISION_DEFAULT edge exists', () => {
    expect(() => evaluateDecisionNode(node, [edges[0]], baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_ENGINE_INVARIANT' }));
  });

  it('FIRST_MATCH evaluates ascending priority and stops at the first true edge', () => {
    const fmNode: DecisionNodeDefinition = { kind: 'DECISION', key: 'd2', mode: 'FIRST_MATCH' };
    const fmEdges: WorkflowEdgeDefinition[] = [
      { key: 'e-p2', fromNodeKey: 'd2', toNodeKey: 'b', selector: { type: 'DECISION', priority: 2, condition: lit(true) } },
      { key: 'e-p1', fromNodeKey: 'd2', toNodeKey: 'a', selector: { type: 'DECISION', priority: 1, condition: lit(true) } },
      { key: 'e-def', fromNodeKey: 'd2', toNodeKey: 'c', selector: { type: 'DECISION_DEFAULT' } },
    ];
    expect(evaluateDecisionNode(fmNode, fmEdges, baseContext)).toEqual({ kind: 'SELECT_EDGE', edgeKey: 'e-p1', nodeOutput: null });
  });

  it('MULTI_MATCH returns START_PARALLEL for every true condition edge', () => {
    const mmNode: DecisionNodeDefinition = { kind: 'DECISION', key: 'd3', mode: 'MULTI_MATCH' };
    const mmEdges: WorkflowEdgeDefinition[] = [
      { key: 'e-a', fromNodeKey: 'd3', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'e-b', fromNodeKey: 'd3', toNodeKey: 'b', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'e-c', fromNodeKey: 'd3', toNodeKey: 'c', selector: { type: 'DECISION', condition: lit(false) } },
      { key: 'e-def', fromNodeKey: 'd3', toNodeKey: 'd', selector: { type: 'DECISION_DEFAULT' } },
    ];
    expect(evaluateDecisionNode(mmNode, mmEdges, baseContext)).toEqual({
      kind: 'START_PARALLEL',
      splitNodeKey: 'd3',
      branches: [
        { edgeKey: 'e-a', branchTokenDescriptor: 'e-a' },
        { edgeKey: 'e-b', branchTokenDescriptor: 'e-b' },
      ],
    });
  });

  it('MULTI_MATCH takes only DECISION_DEFAULT when no condition is true', () => {
    const mmNode: DecisionNodeDefinition = { kind: 'DECISION', key: 'd4', mode: 'MULTI_MATCH' };
    const mmEdges: WorkflowEdgeDefinition[] = [
      { key: 'e-a', fromNodeKey: 'd4', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(false) } },
      { key: 'e-def', fromNodeKey: 'd4', toNodeKey: 'd', selector: { type: 'DECISION_DEFAULT' } },
    ];
    expect(evaluateDecisionNode(mmNode, mmEdges, baseContext)).toEqual({
      kind: 'START_PARALLEL',
      splitNodeKey: 'd4',
      branches: [{ edgeKey: 'e-def', branchTokenDescriptor: 'e-def' }],
    });
  });
});

describe('evaluateSwitchNode', () => {
  const node: SwitchNodeDefinition = { kind: 'SWITCH', key: 's1', value: inputPath(['total']) };
  const edges: WorkflowEdgeDefinition[] = [
    { key: 'e-1', fromNodeKey: 's1', toNodeKey: 'n1', selector: { type: 'SWITCH_CASE', value: 145_000_000 } },
    { key: 'e-def', fromNodeKey: 's1', toNodeKey: 'n2', selector: { type: 'SWITCH_DEFAULT' } },
  ];

  it('selects the matching case using typed equality', () => {
    expect(evaluateSwitchNode(node, edges, baseContext)).toEqual({ kind: 'SELECT_EDGE', edgeKey: 'e-1', nodeOutput: null });
  });

  it('selects the default when no case matches', () => {
    const other: EvaluationContext = { ...baseContext, workflowInput: { total: 1 } };
    expect(evaluateSwitchNode(node, edges, other)).toEqual({ kind: 'SELECT_EDGE', edgeKey: 'e-def', nodeOutput: null });
  });
});

describe('evaluateEndNode / evaluateFailNode', () => {
  it('END maps output and returns COMPLETE_INSTANCE', () => {
    const node: EndNodeDefinition = { kind: 'END', key: 'end-1', output: { type: 'OBJECT', fields: { total: { type: 'EXPRESSION', expression: inputPath(['total']) } } } };
    expect(evaluateEndNode(node, baseContext)).toEqual({ kind: 'COMPLETE_INSTANCE', output: { total: 145_000_000 } });
  });

  it('FAIL maps errorCode/safeMessage/details and returns FAIL_INSTANCE', () => {
    const node: FailNodeDefinition = { kind: 'FAIL', key: 'fail-1', errorCode: lit('WF_TEST_FAILURE'), safeMessage: lit('Test failed') };
    expect(evaluateFailNode(node, baseContext)).toEqual({ kind: 'FAIL_INSTANCE', errorCode: 'WF_TEST_FAILURE', safeMessage: 'Test failed', classifiedDetails: undefined });
  });

  it('FAIL rejects a non-string errorCode', () => {
    const node: FailNodeDefinition = { kind: 'FAIL', key: 'fail-1', errorCode: lit(42), safeMessage: lit('x') };
    expect(() => evaluateFailNode(node, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });
});

describe('applyOutputAssignments', () => {
  it('evaluates against pre-completion context plus this node output, sequentially', () => {
    const assignments = [
      { targetVariableKey: 'v1', value: { op: 'PATH', path: { root: { type: 'NODE_OUTPUT' as const, nodeKey: 'action-1' }, segments: ['text'] } } as CanonicalExpression },
      { targetVariableKey: 'v2', value: { op: 'PATH', path: { root: { type: 'WORKFLOW_VARIABLE' as const, variableKey: 'v1' }, segments: [] } } as CanonicalExpression },
    ];
    const result = applyOutputAssignments(assignments, baseContext, 'action-1', { text: 'hello' });
    expect(result).toEqual({ v1: 'hello', v2: 'hello' });
  });

  it('returns a copy of base variables when there are no assignments', () => {
    const withVars: EvaluationContext = { ...baseContext, variables: { existing: 1 } };
    expect(applyOutputAssignments(undefined, withVars, 'n', null)).toEqual({ existing: 1 });
  });
});

describe('outgoingEdgesOf', () => {
  it('filters edges by fromNodeKey', () => {
    const model = { edges: [{ key: 'a', fromNodeKey: 'x', toNodeKey: 'y', selector: { type: 'UNCONDITIONAL' } }, { key: 'b', fromNodeKey: 'z', toNodeKey: 'y', selector: { type: 'UNCONDITIONAL' } }] } as unknown as WorkflowModel;
    expect(outgoingEdgesOf(model, 'x').map((e) => e.key)).toEqual(['a']);
  });
});
