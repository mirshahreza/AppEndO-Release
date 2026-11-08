import { describe, expect, it } from 'vitest';
import type { CanonicalMapping, WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../../awm/types';
import { buildGraph, reachableFrom, topologicalOrder } from '../graphAnalysis';
import { runExpressionValidation, runVariableWriteConflictValidation, runPureFunctionAvailabilityValidation } from '../rules/expressionValidation';
import type { ParallelRegionMembership } from '../rules/parallelValidation';
import { baseModel, endNode, actionNode, forEachNode, loopNode, unconditionalEdge, lit, nodeOutput, currentEvent, currentWorkItem, currentItem, currentItemIndex, mappingOf } from './fixtures';

const analyze = (nodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[], startKey: string) => {
  const model: WorkflowModel = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: startKey } });
  const graph = buildGraph(model);
  const reachable = reachableFrom(graph, startKey);
  const order = topologicalOrder(graph, reachable)!;
  return { model, graph, order };
};

const codes = (issues: ReturnType<typeof runExpressionValidation>) => issues.map((i) => i.code);

describe('runExpressionValidation', () => {
  it('flags an expression exceeding the configured maxExpressionNodes', () => {
    // LITERAL(true) is 1 expression node; wrapping it in NOT makes 2 -- exceeds a budget of 1.
    const nodes: WorkflowNodeDefinition[] = [actionNode('a1', { input: mappingOf({ v: { op: 'NOT', value: lit(true) } }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const strictModel: WorkflowModel = { ...model, policies: { ...model.policies, limits: { ...model.policies.limits, maxExpressionNodes: 1 } } };
    const issues = runExpressionValidation(strictModel, graph, order);
    expect(codes(issues)).toContain('WF_DEF_INVALID_AWM');
  });

  it('CURRENT_EVENT is illegal outside a WAIT_EVENT/EVENT-start context', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: currentEvent() }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_EVENT'))).toBe(true);
  });

  it('CURRENT_EVENT is legal within a WAIT_EVENT node correlation', () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'WAIT_EVENT', key: 'w1', eventName: 'evt', correlation: currentEvent(['id']) },
      endNode('e1'),
    ];
    const edges = [unconditionalEdge('e', 'w1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'w1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_EVENT'))).toBe(false);
  });

  it('CURRENT_WORK_ITEM is illegal outside a WORK_ITEM node outputAssignments context', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: currentWorkItem('OUTCOME') }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_WORK_ITEM'))).toBe(true);
  });

  it('CURRENT_WORK_ITEM is legal within a WORK_ITEM node\'s own outputAssignments', () => {
    const nodes: WorkflowNodeDefinition[] = [
      {
        kind: 'WORK_ITEM',
        key: 'wi1',
        workItemType: 'APPROVAL',
        assignment: { strategy: 'USER', userId: 'u1' },
        allowedOutcomes: ['DONE'],
        title: lit('t'),
        input: mappingOf({}),
        outputSchema: { type: 'INLINE', schema: {} },
        outputAssignments: [{ targetVariableKey: 'result', value: currentWorkItem('OUTCOME') }],
      },
      endNode('e1'),
    ];
    const edges = [
      { key: 'e', fromNodeKey: 'wi1', toNodeKey: 'e1', selector: { type: 'WORK_ITEM_OUTCOME', outcomeKey: 'DONE' } } as WorkflowEdgeDefinition,
    ];
    const { model, graph, order } = analyze(nodes, edges, 'wi1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_WORK_ITEM'))).toBe(false);
  });

  it('CURRENT_ITEM is illegal outside a FOR_EACH node\'s own input mapping', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: currentItem() }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_ITEM'))).toBe(true);
  });

  it('CURRENT_ITEM_INDEX is illegal outside a FOR_EACH node\'s own input mapping', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: currentItemIndex() }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_ITEM_INDEX'))).toBe(true);
  });

  it('CURRENT_ITEM/CURRENT_ITEM_INDEX are legal within a FOR_EACH node\'s own input mapping', () => {
    const nodes = [forEachNode('f1', { input: mappingOf({ v: currentItem(['id']), i: currentItemIndex() }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'f1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'f1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_ITEM'))).toBe(false);
  });

  it('CURRENT_ITEM is illegal within a FOR_EACH node\'s own items expression (no item is bound yet)', () => {
    const nodes = [forEachNode('f1', { items: currentItem() }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'f1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'f1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('CURRENT_ITEM'))).toBe(true);
  });

  it('CURRENT_ITEM/CURRENT_ITEM_INDEX are legal in a LOOP condition and per-iteration input, but not in LOOP config', () => {
    const legal = [
      loopNode('l1', {
        condition: { op: 'LT', left: currentItemIndex(), right: lit(3) },
        input: mappingOf({ v: currentItem(['text']), i: currentItemIndex() }),
      }),
      endNode('e1'),
    ];
    const legalAnalyzed = analyze(legal, [unconditionalEdge('e', 'l1', 'e1')], 'l1');
    const legalIssues = runExpressionValidation(legalAnalyzed.model, legalAnalyzed.graph, legalAnalyzed.order);
    expect(legalIssues.some((i) => i.message.includes('CURRENT_ITEM'))).toBe(false);

    const illegalConfig: CanonicalMapping = mappingOf({ v: currentItem() });
    const illegal = [
      { ...loopNode('l1', { condition: lit(true) }), config: illegalConfig },
      endNode('e1'),
    ];
    const illegalAnalyzed = analyze(illegal, [unconditionalEdge('e', 'l1', 'e1')], 'l1');
    const illegalIssues = runExpressionValidation(illegalAnalyzed.model, illegalAnalyzed.graph, illegalAnalyzed.order);
    expect(illegalIssues.some((i) => i.message.includes('CURRENT_ITEM'))).toBe(true);
  });

  it('NODE_OUTPUT referencing an unknown node is a reference error', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: nodeOutput('ghost') }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    expect(codes(runExpressionValidation(model, graph, order))).toContain('WF_DEF_INVALID_REFERENCE');
  });

  it('NODE_OUTPUT self-reference outside outputAssignments is illegal (node has not completed yet)', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: nodeOutput('a1') }) }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('cannot reference its own NODE_OUTPUT'))).toBe(true);
  });

  it('NODE_OUTPUT self-reference IS legal within the node\'s own outputAssignments', () => {
    const nodes = [actionNode('a1', { outputAssignments: [{ targetVariableKey: 'x', value: nodeOutput('a1', ['field']) }] }), endNode('e1')];
    const edges = [unconditionalEdge('e', 'a1', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('cannot reference its own NODE_OUTPUT'))).toBe(false);
  });

  it('NODE_OUTPUT referencing a linear-chain ancestor (dominator) is legal', () => {
    const nodes = [actionNode('a1'), actionNode('a2', { input: mappingOf({ v: nodeOutput('a1') }) }), endNode('e1')];
    const edges = [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'e1')];
    const { model, graph, order } = analyze(nodes, edges, 'a1');
    const issues = runExpressionValidation(model, graph, order);
    expect(codes(issues)).not.toContain('WF_DEF_INVALID_REFERENCE');
  });

  it('NODE_OUTPUT referencing a reachable-but-non-dominating node (alternate diamond branch) is illegal', () => {
    // start -> left -> join, start -> right -> join; 'join' consumes NODE_OUTPUT('left'), but 'left'
    // does not dominate 'join' because the 'right' path reaches it without passing through 'left'.
    const nodes = [
      { kind: 'DECISION', key: 'start', mode: 'EXACT_ONE' } as WorkflowNodeDefinition,
      actionNode('left'),
      actionNode('right'),
      actionNode('join', { input: mappingOf({ v: nodeOutput('left') }) }),
    ];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'e1', fromNodeKey: 'start', toNodeKey: 'left', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'e2', fromNodeKey: 'start', toNodeKey: 'right', selector: { type: 'DECISION_DEFAULT' } },
      unconditionalEdge('e3', 'left', 'join'),
      unconditionalEdge('e4', 'right', 'join'),
    ];
    const { model, graph, order } = analyze(nodes, edges, 'start');
    const issues = runExpressionValidation(model, graph, order);
    expect(issues.some((i) => i.message.includes('not structurally proven to complete'))).toBe(true);
  });
});

describe('runVariableWriteConflictValidation', () => {
  it('flags two sibling-branch nodes assigning the same workflow variable concurrently', () => {
    const membership: ParallelRegionMembership = {
      nodeToBranch: new Map([
        ['a', { splitNodeKey: 's1', branchEdgeKey: 'branch-a' }],
        ['b', { splitNodeKey: 's1', branchEdgeKey: 'branch-b' }],
      ]),
      splitToJoin: new Map([['s1', 'j1']]),
    };
    const nodes = [
      actionNode('a', { outputAssignments: [{ targetVariableKey: 'shared', value: lit(1) }] }),
      actionNode('b', { outputAssignments: [{ targetVariableKey: 'shared', value: lit(2) }] }),
    ];
    const model = baseModel({ nodes });
    const issues = runVariableWriteConflictValidation(model, membership);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('WF_DEF_INVALID_AWM');
    expect(issues[0].details).toMatchObject({ variableKey: 'shared' });
  });

  it('does not flag two sequential (non-concurrent) nodes assigning the same variable', () => {
    const nodes = [
      actionNode('a', { outputAssignments: [{ targetVariableKey: 'shared', value: lit(1) }] }),
      actionNode('b', { outputAssignments: [{ targetVariableKey: 'shared', value: lit(2) }] }),
    ];
    const model = baseModel({ nodes });
    const membership: ParallelRegionMembership = { nodeToBranch: new Map(), splitToJoin: new Map() };
    expect(runVariableWriteConflictValidation(model, membership)).toHaveLength(0);
  });

  it('does not flag two different-split-owned nodes writing the same variable (not siblings)', () => {
    const membership: ParallelRegionMembership = {
      nodeToBranch: new Map([
        ['a', { splitNodeKey: 's1', branchEdgeKey: 'b1' }],
        ['b', { splitNodeKey: 's2', branchEdgeKey: 'b2' }],
      ]),
      splitToJoin: new Map([['s1', 'j1'], ['s2', 'j2']]),
    };
    const nodes = [
      actionNode('a', { outputAssignments: [{ targetVariableKey: 'shared', value: lit(1) }] }),
      actionNode('b', { outputAssignments: [{ targetVariableKey: 'shared', value: lit(2) }] }),
    ];
    const model = baseModel({ nodes });
    expect(runVariableWriteConflictValidation(model, membership)).toHaveLength(0);
  });
});

describe('runPureFunctionAvailabilityValidation', () => {
  it('flags any PURE_FUNCTION usage as a missing canonical platform contract (no registry exists yet)', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: { op: 'PURE_FUNCTION', functionRef: { key: 'string.upper', version: '1' }, args: [] } }) }), endNode('e1')];
    const model = baseModel({ nodes });
    const issues = runPureFunctionAvailabilityValidation(model);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT');
  });

  it('dedupes repeated identical PURE_FUNCTION usage within the same context (field path granularity is per-context, not per-field)', () => {
    const fn = { op: 'PURE_FUNCTION' as const, functionRef: { key: 'string.upper', version: '1' }, args: [] };
    // Both 'v' and 'w' live under the same ACTION node's `input` context/fieldPath, so the
    // dedupe key (fieldPath + function identity) collapses them to a single reported issue.
    const nodes = [actionNode('a1', { input: mappingOf({ v: fn, w: fn }) })];
    const model = baseModel({ nodes });
    expect(runPureFunctionAvailabilityValidation(model)).toHaveLength(1);
  });

  it('reports separately when the same function is used in two different node contexts', () => {
    const fn = { op: 'PURE_FUNCTION' as const, functionRef: { key: 'string.upper', version: '1' }, args: [] };
    const nodes = [actionNode('a1', { input: mappingOf({ v: fn }) }), actionNode('a2', { input: mappingOf({ v: fn }) })];
    const model = baseModel({ nodes });
    expect(runPureFunctionAvailabilityValidation(model)).toHaveLength(2);
  });

  it('returns no issues when no PURE_FUNCTION expression is used', () => {
    const nodes = [actionNode('a1', { input: mappingOf({ v: lit(1) }) })];
    const model = baseModel({ nodes });
    expect(runPureFunctionAvailabilityValidation(model)).toHaveLength(0);
  });
});
