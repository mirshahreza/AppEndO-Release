import { describe, expect, it } from 'vitest';
import { applyDraftOperations } from '../draftOperationApplier';
import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../types';
import type { WorkflowDraftOperation } from '../draftOperations';

const emptyPolicies = {
  recoveryDetectionBoundMs: 1000,
  limits: {
    maxNodes: 100,
    maxEdges: 200,
    maxPayloadBytes: 100000,
    maxJsonDepth: 20,
    maxExpressionNodes: 500,
    maxStructuralPathCandidates: 1000,
    maxDelayMs: 86400000,
    maxWaitTimeoutMs: 86400000,
    maxWorkItemTitleLength: 200,
  },
};

const emptyDraft = (): WorkflowModel => ({
  schemaVersion: '1',
  key: 'test-workflow',
  name: 'Test Workflow',
  inputSchema: { type: 'INLINE', schema: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  variables: [],
  start: { type: 'MANUAL_API', targetNodeKey: '__unset__' },
  nodes: [],
  edges: [],
  policies: emptyPolicies,
});

const endNode = (key: string): WorkflowNodeDefinition => ({
  kind: 'END',
  key,
  output: { type: 'OBJECT', fields: {} },
});

const startNode = (key: string): WorkflowNodeDefinition => ({
  kind: 'DECISION',
  key,
  mode: 'EXACT_ONE',
});

const edge = (key: string, from: string, to: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey: from,
  toNodeKey: to,
  selector: { type: 'DECISION_DEFAULT' },
});

describe('applyDraftOperations', () => {
  it('applies ADD_NODE + CHANGE_START to build a minimal valid graph', () => {
    const draft = emptyDraft();
    const ops: WorkflowDraftOperation[] = [
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: startNode('decision-1') },
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: endNode('end-1') },
      { operationSchemaVersion: '1', type: 'ADD_EDGE', edge: edge('e1', 'decision-1', 'end-1') },
      { operationSchemaVersion: '1', type: 'CHANGE_START', start: { type: 'MANUAL_API', targetNodeKey: 'decision-1' } },
    ];
    const result = applyDraftOperations(draft, ops);
    expect(result.candidate.nodes).toHaveLength(2);
    expect(result.candidate.edges).toHaveLength(1);
    expect(result.candidate.start).toEqual({ type: 'MANUAL_API', targetNodeKey: 'decision-1' });
    expect(result.affectedNodeKeys.sort()).toEqual(['decision-1', 'end-1']);
    expect(result.affectedEdgeKeys).toEqual(['e1']);
    expect(result.workflowLevelChanged).toBe(true);
  });

  it('rejects ADD_NODE with a duplicate key', () => {
    const draft = emptyDraft();
    draft.nodes.push(endNode('dup'));
    expect(() =>
      applyDraftOperations(draft, [{ operationSchemaVersion: '1', type: 'ADD_NODE', node: endNode('dup') }]),
    ).toThrow(/already exists/);
  });

  it('rejects MODIFY_NODE that renames the key', () => {
    const draft = emptyDraft();
    draft.nodes.push(endNode('n1'));
    expect(() =>
      applyDraftOperations(draft, [
        { operationSchemaVersion: '1', type: 'MODIFY_NODE', nodeKey: 'n1', replacement: endNode('n2') },
      ]),
    ).toThrow(/cannot rename/);
  });

  it('rejects MODIFY_NODE targeting a non-existent key', () => {
    const draft = emptyDraft();
    expect(() =>
      applyDraftOperations(draft, [
        { operationSchemaVersion: '1', type: 'MODIFY_NODE', nodeKey: 'missing', replacement: endNode('missing') },
      ]),
    ).toThrow(/does not exist/);
  });

  it('REMOVE_NODE does not cascade: a dangling edge reference fails the whole batch atomically', () => {
    const draft = emptyDraft();
    draft.nodes.push(startNode('d1'), endNode('e1'));
    draft.edges.push(edge('edge-1', 'd1', 'e1'));
    draft.start = { type: 'MANUAL_API', targetNodeKey: 'd1' };

    expect(() =>
      applyDraftOperations(draft, [{ operationSchemaVersion: '1', type: 'REMOVE_NODE', nodeKey: 'e1' }]),
    ).toThrow(/missing toNodeKey/);

    // No partial candidate authority: re-running the same draft object (never mutated) still parses as before.
    expect(draft.nodes).toHaveLength(2);
  });

  it('REMOVE_NODE succeeds when the operation list also removes the referencing edge', () => {
    const draft = emptyDraft();
    draft.nodes.push(startNode('d1'), endNode('e1'), endNode('e2'));
    draft.edges.push(edge('edge-1', 'd1', 'e1'));
    draft.start = { type: 'MANUAL_API', targetNodeKey: 'd1' };

    const result = applyDraftOperations(draft, [
      { operationSchemaVersion: '1', type: 'REMOVE_EDGE', edgeKey: 'edge-1' },
      { operationSchemaVersion: '1', type: 'REMOVE_NODE', nodeKey: 'e1' },
      { operationSchemaVersion: '1', type: 'ADD_EDGE', edge: edge('edge-2', 'd1', 'e2') },
    ]);
    expect(result.candidate.nodes.map((n) => n.key)).toEqual(['d1', 'e2']);
    expect(result.candidate.edges.map((e) => e.key)).toEqual(['edge-2']);
  });

  it('rejects a start targetNodeKey that does not exist after the full operation list applies', () => {
    const draft = emptyDraft();
    expect(() =>
      applyDraftOperations(draft, [
        { operationSchemaVersion: '1', type: 'CHANGE_START', start: { type: 'MANUAL_API', targetNodeKey: 'ghost' } },
      ]),
    ).toThrow(/Start targetNodeKey/);
  });

  it('normalizes omitted DECISION mode to EXACT_ONE and PARALLEL_JOIN cancelRemaining to false', () => {
    const draft = emptyDraft();
    const decisionNoMode: WorkflowNodeDefinition = { kind: 'DECISION', key: 'd1' };
    const joinNoCancel: WorkflowNodeDefinition = { kind: 'PARALLEL_JOIN', key: 'j1', mode: 'ANY' };
    const result = applyDraftOperations(draft, [
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: decisionNoMode },
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: joinNoCancel },
      { operationSchemaVersion: '1', type: 'CHANGE_START', start: { type: 'MANUAL_API', targetNodeKey: 'd1' } },
    ]);
    const decision = result.candidate.nodes.find((n) => n.key === 'd1');
    const join = result.candidate.nodes.find((n) => n.key === 'j1');
    expect(decision).toMatchObject({ mode: 'EXACT_ONE' });
    expect(join).toMatchObject({ cancelRemaining: false });
  });

  it('rejects an operation with an unregistered discriminant/unknown field', () => {
    const draft = emptyDraft();
    const badOp = { operationSchemaVersion: '1', type: 'ADD_NODE', node: endNode('n1'), sneaky: 'field' };
    expect(() => applyDraftOperations(draft, [badOp as unknown as WorkflowDraftOperation])).toThrow();
  });

  it('never mutates the input draft object on success (pure function)', () => {
    const draft = emptyDraft();
    const snapshot = JSON.stringify(draft);
    applyDraftOperations(draft, [
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: endNode('n1') },
      { operationSchemaVersion: '1', type: 'CHANGE_START', start: { type: 'MANUAL_API', targetNodeKey: 'n1' } },
    ]);
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it('never mutates the input draft object on failure either (no partial candidate authority)', () => {
    const draft = emptyDraft();
    draft.nodes.push(endNode('n1'));
    const snapshot = JSON.stringify(draft);
    expect(() =>
      applyDraftOperations(draft, [{ operationSchemaVersion: '1', type: 'ADD_NODE', node: endNode('n1') }]),
    ).toThrow();
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it('applies operations strictly in list order (later ADD_EDGE depends on earlier ADD_NODE)', () => {
    const draft = emptyDraft();
    const result = applyDraftOperations(draft, [
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: startNode('d1') },
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: endNode('e1') },
      { operationSchemaVersion: '1', type: 'ADD_EDGE', edge: edge('edge-1', 'd1', 'e1') },
      { operationSchemaVersion: '1', type: 'CHANGE_START', start: { type: 'MANUAL_API', targetNodeKey: 'd1' } },
    ]);
    expect(result.candidate.edges).toHaveLength(1);
  });
});
