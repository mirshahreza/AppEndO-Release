import { describe, expect, it, beforeAll, afterEach } from 'vitest';
import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition, ContextAssignment } from '../../../awm/types';
import { baseModel, endNode, actionNode, loopNode, unconditionalEdge, errorEdge, mappingOf, lit, nodeOutput, currentEvent, currentWorkItem, currentItemIndex } from '../../../publication/__tests__/fixtures';
import { __resetActionRegistryForTests } from '../../../actions/registry';
import { registerCoreActionPack } from '../../../actions/corePack';
import { runSimulationFull, runSimulationFromNode, runSimulationSingleNode } from '../simulationEngine';
import { computeMissingFixturePaths } from '../simulationFixtures';
import type { WorkflowSimulationFixtureSet } from '../simulationTypes';
import type { ResolvedActionNodeBinding } from '../../../publication/validationTypes';

const emptyFixtures: WorkflowSimulationFixtureSet = { fixtures: {} };
const noBindings: ResolvedActionNodeBinding[] = [];

const model = (nodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[], startKey: string, overrides: Partial<WorkflowModel> = {}): WorkflowModel =>
  baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: startKey }, ...overrides });

describe('simulationEngine', () => {
  beforeAll(() => {
    registerCoreActionPack();
  });
  afterEach(() => {
    // registerCoreActionPack is idempotent and safe to leave registered across tests in this file;
    // only reset if a test needs a clean registry (none here does).
  });

  it('runSimulationFull walks DECISION -> END and returns SUCCEEDED with mapped output', () => {
    const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' }, endNode('e1'), endNode('e2')];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'true-edge', fromNodeKey: 'd1', toNodeKey: 'e1', selector: { type: 'DECISION', condition: { op: 'EQ', left: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['flag'] } }, right: lit(true) } } },
      { key: 'default-edge', fromNodeKey: 'd1', toNodeKey: 'e2', selector: { type: 'DECISION_DEFAULT' } },
    ];
    const m = model(nodes, edges, 'd1');
    return runSimulationFull(m, noBindings, emptyFixtures, { flag: true }).then((result) => {
      expect(result.outcome).toEqual({ status: 'SUCCEEDED', output: {} });
      expect(result.evidence.some((e) => e.type === 'EDGE_SELECTED' && e.detail.edgeKey === 'true-edge')).toBe(true);
    });
  });

  it('ACTION with an ACTION_RESULT fixture applies outputAssignments and continues', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      actionNode('a1', { outputAssignments: [{ targetVariableKey: 'total', value: nodeOutput('a1', ['sum']) } as ContextAssignment] }),
      endNode('e1'),
    ];
    const edges = [unconditionalEdge('edge1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a1', { variables: [{ key: 'total', schema: { type: 'INLINE', schema: {} } }] });
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { a1: { kind: 'ACTION_RESULT', output: { sum: 42 } } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
    expect(result.evidence.some((e) => e.type === 'ACTION_FIXTURE_APPLIED')).toBe(true);
  });

  it('ACTION with an ACTION_FAILURE fixture fails the instance', async () => {
    const nodes: WorkflowNodeDefinition[] = [actionNode('a1'), endNode('e1')];
    const edges = [unconditionalEdge('edge1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a1');
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { a1: { kind: 'ACTION_FAILURE', errorCode: 'X', errorClass: 'PROVIDER', safeMessage: 'boom' } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.outcome).toEqual({ status: 'FAILED', errorCode: 'X', safeMessage: 'boom' });
  });

  it('ACTION with no fixture and an approved PURE/safe Action executes live', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      actionNode('a1', {
        actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
        input: {
          type: 'OBJECT',
          fields: {
            template: { type: 'EXPRESSION', expression: lit('Hello {{name}}') },
            variables: { type: 'OBJECT', fields: { name: { type: 'EXPRESSION', expression: lit('World') } } },
          },
        },
      }),
      endNode('e1'),
    ];
    const edges = [unconditionalEdge('edge1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a1');
    const result = await runSimulationFull(m, noBindings, emptyFixtures, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
    expect(result.evidence.some((e) => e.type === 'ACTION_LIVE_PURE_EXECUTED')).toBe(true);
  });

  it('ACTION with no fixture and no approved live-execution policy throws WF_SIM_MISSING_FIXTURE', async () => {
    const nodes: WorkflowNodeDefinition[] = [actionNode('a1'), endNode('e1')];
    const edges = [unconditionalEdge('edge1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a1');
    await expect(runSimulationFull(m, noBindings, emptyFixtures, null)).rejects.toMatchObject({ code: 'WF_SIM_MISSING_FIXTURE' });
  });

  it('WAIT_EVENT event-win fixture binds CURRENT_EVENT into outputAssignments and selects the event edge', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'WAIT_EVENT', key: 'w1', eventName: 'evt', correlation: lit('k'), outputAssignments: [{ targetVariableKey: 'received', value: currentEvent(['id']) }] },
      endNode('e1'),
    ];
    const edges = [unconditionalEdge('edge1', 'w1', 'e1')];
    const m = model(nodes, edges, 'w1', { variables: [{ key: 'received', schema: { type: 'INLINE', schema: {} } }] });
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { w1: { kind: 'WAIT_EVENT_RESOLUTION', outcome: 'EVENT', eventPayload: { id: 'evt-1' } } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
  });

  it('WAIT_EVENT timeout fixture selects the WAIT_TIMEOUT edge', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'WAIT_EVENT', key: 'w1', eventName: 'evt', correlation: lit('k'), timeout: { afterMs: lit(1000), outcomeKey: 'TIMED_OUT' } },
      endNode('e1'),
      endNode('e2'),
    ];
    const edges: WorkflowEdgeDefinition[] = [unconditionalEdge('edge1', 'w1', 'e1'), { key: 'edge2', fromNodeKey: 'w1', toNodeKey: 'e2', selector: { type: 'WAIT_TIMEOUT', outcomeKey: 'TIMED_OUT' } }];
    const m = model(nodes, edges, 'w1');
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { w1: { kind: 'WAIT_EVENT_RESOLUTION', outcome: 'TIMEOUT' } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.evidence.some((e) => e.type === 'EDGE_SELECTED' && e.detail.edgeKey === 'edge2')).toBe(true);
  });

  it('WORK_ITEM fixture routes via the matching WORK_ITEM_OUTCOME edge and binds CURRENT_WORK_ITEM', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      {
        kind: 'WORK_ITEM',
        key: 'wi1',
        workItemType: 'APPROVAL',
        assignment: { strategy: 'USER', userId: '1' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve?'),
        input: mappingOf({}),
        outputSchema: { type: 'INLINE', schema: {} },
        outputAssignments: [{ targetVariableKey: 'decision', value: currentWorkItem('OUTCOME') }],
      },
      endNode('approved'),
      endNode('rejected'),
    ];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'approve-edge', fromNodeKey: 'wi1', toNodeKey: 'approved', selector: { type: 'WORK_ITEM_OUTCOME', outcomeKey: 'APPROVE' } },
      { key: 'reject-edge', fromNodeKey: 'wi1', toNodeKey: 'rejected', selector: { type: 'WORK_ITEM_OUTCOME', outcomeKey: 'REJECT' } },
    ];
    const m = model(nodes, edges, 'wi1', { variables: [{ key: 'decision', schema: { type: 'INLINE', schema: {} } }] });
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { wi1: { kind: 'WORK_ITEM_RESOLUTION', outcomeKey: 'APPROVE', output: {} } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.evidence.some((e) => e.type === 'EDGE_SELECTED' && e.detail.edgeKey === 'approve-edge')).toBe(true);
  });

  it('SUBFLOW SUCCEEDED fixture propagates output via NODE_OUTPUT', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'SUBFLOW', key: 's1', workflowDefinitionRef: { workflowDefinitionKey: 'child' }, input: mappingOf({}), outputAssignments: [{ targetVariableKey: 'childResult', value: nodeOutput('s1', ['status']) }] },
      endNode('e1'),
    ];
    const edges = [unconditionalEdge('edge1', 's1', 'e1')];
    const m = model(nodes, edges, 's1', { variables: [{ key: 'childResult', schema: { type: 'INLINE', schema: {} } }] });
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { s1: { kind: 'SUBFLOW_RESOLUTION', status: 'SUCCEEDED', output: { status: 'ok' } } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
  });

  it('SUBFLOW FAILED fixture fails the parent with WF_EXEC_SUBFLOW_FAILED', async () => {
    const nodes: WorkflowNodeDefinition[] = [{ kind: 'SUBFLOW', key: 's1', workflowDefinitionRef: { workflowDefinitionKey: 'child' }, input: mappingOf({}) }, endNode('e1')];
    const edges = [unconditionalEdge('edge1', 's1', 'e1')];
    const m = model(nodes, edges, 's1');
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { s1: { kind: 'SUBFLOW_RESOLUTION', status: 'FAILED', errorCode: 'CHILD_BOOM' } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.outcome).toMatchObject({ status: 'FAILED', errorCode: 'WF_EXEC_SUBFLOW_FAILED' });
  });

  it('PARALLEL_SPLIT (ALL) merges both branches deterministically before continuing past the join', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'PARALLEL_SPLIT', key: 'split' },
      actionNode('branchA', { outputAssignments: [{ targetVariableKey: 'a', value: lit('A') }] }),
      actionNode('branchB', { outputAssignments: [{ targetVariableKey: 'b', value: lit('B') }] }),
      { kind: 'PARALLEL_JOIN', key: 'join', mode: 'ALL' },
      endNode('e1'),
    ];
    const edges: WorkflowEdgeDefinition[] = [
      unconditionalEdge('e-split-a', 'split', 'branchA'),
      unconditionalEdge('e-split-b', 'split', 'branchB'),
      unconditionalEdge('e-a-join', 'branchA', 'join'),
      unconditionalEdge('e-b-join', 'branchB', 'join'),
      unconditionalEdge('e-join-end', 'join', 'e1'),
    ];
    const m = model(nodes, edges, 'split', { variables: [{ key: 'a', schema: { type: 'INLINE', schema: {} } }, { key: 'b', schema: { type: 'INLINE', schema: {} } }] });
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { branchA: { kind: 'ACTION_RESULT', output: {} }, branchB: { kind: 'ACTION_RESULT', output: {} } } };
    const result = await runSimulationFull(m, noBindings, fixtureSet, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
    // Per branch: NODE_ENTERED, ACTION_FIXTURE_APPLIED, NODE_DATA_RECORDED, EDGE_SELECTED — 4 entries x 2 branches.
    expect(result.evidence.filter((e) => e.nodeKey === 'branchA' || e.nodeKey === 'branchB')).toHaveLength(4 * 2);
  });

  it('runSimulationSingleNode ("Run This Node") stops right after the executed node without continuing', async () => {
    const nodes: WorkflowNodeDefinition[] = [actionNode('a1'), endNode('e1')];
    const edges = [unconditionalEdge('edge1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a1');
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { a1: { kind: 'ACTION_RESULT', output: { ok: true } } } };
    const result = await runSimulationSingleNode(m, noBindings, fixtureSet, 'a1', { workflowInput: null, variables: {}, nodeOutputs: {} });
    expect(result.outcome).toEqual({ status: 'STOPPED_AT_NODE', nodeKey: 'e1' });
    expect(result.evidence.some((e) => e.nodeKey === 'e1')).toBe(false);
  });

  it('runSimulationFromNode starts mid-graph using the caller-supplied context', async () => {
    const nodes: WorkflowNodeDefinition[] = [actionNode('a0'), actionNode('a1'), endNode('e1')];
    const edges = [unconditionalEdge('e0', 'a0', 'a1'), unconditionalEdge('e1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a0');
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { a1: { kind: 'ACTION_RESULT', output: {} } } };
    const result = await runSimulationFromNode(m, noBindings, fixtureSet, 'a1', { workflowInput: null, variables: {}, nodeOutputs: {} });
    expect(result.outcome.status).toBe('SUCCEEDED');
    expect(result.evidence.some((e) => e.nodeKey === 'a0')).toBe(false);
  });

  it('LOOP with a PURE Action runs while CURRENT_ITEM_INDEX is below the bound and records LOOP_EXECUTED', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      loopNode('l1', {
        condition: { op: 'LT', left: currentItemIndex(), right: lit(3) },
        maxIterations: 10,
        actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
        input: {
          type: 'OBJECT',
          fields: {
            template: { type: 'EXPRESSION', expression: lit('n={{i}}') },
            variables: { type: 'OBJECT', fields: { i: { type: 'EXPRESSION', expression: currentItemIndex() } } },
          },
        },
      }),
      endNode('e1'),
    ];
    const m = model(nodes, [unconditionalEdge('e', 'l1', 'e1')], 'l1');
    const result = await runSimulationFull(m, noBindings, emptyFixtures, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
    const executed = result.evidence.find((e) => e.type === 'LOOP_EXECUTED');
    expect(executed?.detail).toMatchObject({ iterations: 3 });
  });

  it('LOOP that hits maxIterations while the condition is still true fails with WF_EXEC_LOOP_LIMIT_EXCEEDED', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      loopNode('l1', {
        condition: lit(true),
        maxIterations: 2,
        actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
        input: {
          type: 'OBJECT',
          fields: {
            template: { type: 'EXPRESSION', expression: lit('x') },
            variables: { type: 'OBJECT', fields: {} },
          },
        },
      }),
      endNode('e1'),
    ];
    const m = model(nodes, [unconditionalEdge('e', 'l1', 'e1')], 'l1');
    const result = await runSimulationFull(m, noBindings, emptyFixtures, null);
    expect(result.outcome).toMatchObject({ status: 'FAILED', errorCode: 'WF_EXEC_LOOP_LIMIT_EXCEEDED' });
  });

  it('LOOP ON_ERROR catches a live PURE Action failure and continues on the catch edge', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      loopNode('l1', {
        condition: { op: 'LT', left: currentItemIndex(), right: lit(1) },
        actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
      }),
      endNode('ok'),
      endNode('caught'),
    ];
    const m = model(nodes, [unconditionalEdge('e-ok', 'l1', 'ok'), errorEdge('e-catch', 'l1', 'caught')], 'l1');
    const result = await runSimulationFull(m, noBindings, emptyFixtures, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
    expect(result.evidence.some((e) => e.type === 'EDGE_SELECTED' && e.detail.edgeKey === 'e-catch')).toBe(true);
  });

  it('MULTI_MATCH walks every true branch then the join (inclusive gateway)', async () => {
    const delay = (key: string): WorkflowNodeDefinition => ({
      kind: 'DELAY',
      key,
      delay: { type: 'DURATION_MS', value: lit(10) },
    });
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'DECISION', key: 'd1', mode: 'MULTI_MATCH' },
      delay('a'),
      delay('b'),
      delay('def'),
      { kind: 'PARALLEL_JOIN', key: 'j1', mode: 'ALL' },
      endNode('done'),
    ];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'e-a', fromNodeKey: 'd1', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'e-b', fromNodeKey: 'd1', toNodeKey: 'b', selector: { type: 'DECISION', condition: lit(false) } },
      { key: 'e-def', fromNodeKey: 'd1', toNodeKey: 'def', selector: { type: 'DECISION_DEFAULT' } },
      unconditionalEdge('e-a-j', 'a', 'j1'),
      unconditionalEdge('e-b-j', 'b', 'j1'),
      unconditionalEdge('e-def-j', 'def', 'j1'),
      unconditionalEdge('e-j-done', 'j1', 'done'),
    ];
    const m = model(nodes, edges, 'd1');
    const result = await runSimulationFull(m, noBindings, emptyFixtures, null);
    expect(result.outcome.status).toBe('SUCCEEDED');
    expect(result.evidence.some((e) => e.type === 'EDGE_SELECTED' && e.detail.selectionMode === 'MULTI_MATCH')).toBe(true);
    expect(result.evidence.some((e) => e.nodeKey === 'a')).toBe(true);
    expect(result.evidence.some((e) => e.nodeKey === 'b')).toBe(false);
    expect(result.evidence.some((e) => e.nodeKey === 'j1')).toBe(true);
  });
});

describe('computeMissingFixturePaths', () => {
  it('reports every fixture-requiring reachable node with no fixture and no PURE/safe exemption', () => {
    const nodes: WorkflowNodeDefinition[] = [actionNode('a1'), endNode('e1')];
    const edges = [unconditionalEdge('edge1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a1');
    const missing = computeMissingFixturePaths(m, noBindings, emptyFixtures, 'a1');
    expect(missing).toEqual([{ nodeKey: 'a1', resolvedActionRef: undefined }]);
  });

  it('excludes a node once a fixture is supplied', () => {
    const nodes: WorkflowNodeDefinition[] = [actionNode('a1'), endNode('e1')];
    const edges = [unconditionalEdge('edge1', 'a1', 'e1')];
    const m = model(nodes, edges, 'a1');
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: { a1: { kind: 'ACTION_RESULT', output: {} } } };
    expect(computeMissingFixturePaths(m, noBindings, fixtureSet, 'a1')).toEqual([]);
  });
});
