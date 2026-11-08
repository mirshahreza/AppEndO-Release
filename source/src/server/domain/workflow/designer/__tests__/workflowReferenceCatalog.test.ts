import { describe, expect, it } from 'vitest';
import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../../awm/types';
import { baseModel, endNode, actionNode, unconditionalEdge } from '../../publication/__tests__/fixtures';
import { getAuthorizedWorkflowReferences, searchWorkflowReferences, compileWorkflowReference, descriptorIdentity } from '../workflowReferenceCatalog';

const model = (nodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[], startKey: string, overrides: Partial<WorkflowModel> = {}): WorkflowModel =>
  baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: startKey }, ...overrides });

describe('getAuthorizedWorkflowReferences', () => {
  it('always includes WORKFLOW_INPUT and every declared WORKFLOW_VARIABLE', () => {
    const m = model([endNode('e1')], [], 'e1', { variables: [{ key: 'v1', schema: { type: 'INLINE', schema: {} } }] });
    const refs = getAuthorizedWorkflowReferences(m, { consumerNodeKey: null, isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    expect(refs.some((r) => r.type === 'WORKFLOW_INPUT')).toBe(true);
    expect(refs.some((r) => r.type === 'WORKFLOW_VARIABLE' && r.variableKey === 'v1')).toBe(true);
  });

  it('includes only dominating NODE_OUTPUT candidates for a linear chain', () => {
    const nodes = [actionNode('a1'), actionNode('a2'), endNode('e1')];
    const edges = [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'e1')];
    const m = model(nodes, edges, 'a1');
    const refs = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    const nodeOutputKeys = refs.filter((r) => r.type === 'NODE_OUTPUT').map((r) => (r as { nodeKey: string }).nodeKey);
    expect(nodeOutputKeys.sort()).toEqual(['a1', 'a2']);
  });

  it('excludes a non-dominating sibling branch and excludes the consumer itself unless in its own outputAssignments', () => {
    // a1 -> {b1, b2} (no join, two separate END targets) — b1 does not dominate b2's consumer position.
    const nodes = [actionNode('a1'), actionNode('b1'), actionNode('b2'), endNode('e1'), endNode('e2')];
    const edges = [
      unconditionalEdge('e1', 'a1', 'b1'),
      unconditionalEdge('e2', 'a1', 'b2'),
      unconditionalEdge('e3', 'b1', 'e1'),
      unconditionalEdge('e4', 'b2', 'e2'),
    ];
    const m = model(nodes, edges, 'a1');
    const refsForB2 = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'b2', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    const nodeOutputKeys = refsForB2.filter((r) => r.type === 'NODE_OUTPUT').map((r) => (r as { nodeKey: string }).nodeKey);
    expect(nodeOutputKeys).toEqual(['a1']);
    expect(nodeOutputKeys).not.toContain('b1');
    expect(nodeOutputKeys).not.toContain('b2');

    const selfRefs = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'b2', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: true, isForEachItemContext: false });
    expect(selfRefs.some((r) => r.type === 'NODE_OUTPUT' && r.nodeKey === 'b2')).toBe(true);
  });

  it('degrades to no NODE_OUTPUT candidates (not a throw) when the reachable subgraph is cyclic', () => {
    const nodes = [actionNode('a1'), actionNode('a2')];
    const edges = [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'a1')];
    const m = model(nodes, edges, 'a1');
    const refs = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'a2', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    expect(refs.some((r) => r.type === 'NODE_OUTPUT')).toBe(false);
  });

  it('CURRENT_EVENT only appears in a wait-event context; CURRENT_WORK_ITEM only in a work-item output context', () => {
    const m = model([endNode('e1')], [], 'e1');
    const plain = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    expect(plain.some((r) => r.type === 'CURRENT_EVENT')).toBe(false);
    expect(plain.some((r) => r.type === 'CURRENT_WORK_ITEM')).toBe(false);

    const waitCtx = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: true, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    expect(waitCtx.some((r) => r.type === 'CURRENT_EVENT')).toBe(true);

    const workItemCtx = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: false, isWorkItemOutputContext: true, isOutputAssignmentContext: false, isForEachItemContext: false });
    expect(workItemCtx.filter((r) => r.type === 'CURRENT_WORK_ITEM').map((r) => (r as { projection: string }).projection).sort()).toEqual(['OUTCOME', 'OUTPUT']);
  });

  it('WFV2-22 — NODE_OUTPUT descriptors carry ancestorDistance and are nearest-first', () => {
    const nodes = [actionNode('a1'), actionNode('a2'), actionNode('a3'), endNode('e1')];
    const edges = [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'a3'), unconditionalEdge('e3', 'a3', 'e1')];
    const m = model(nodes, edges, 'a1');
    const refs = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    const nodeOutputs = refs.filter((r) => r.type === 'NODE_OUTPUT') as Array<{ nodeKey: string; ancestorDistance: number }>;
    expect(nodeOutputs.map((r) => r.nodeKey)).toEqual(['a3', 'a2', 'a1']);
    expect(nodeOutputs.map((r) => r.ancestorDistance)).toEqual([1, 2, 3]);
  });

  it('WFV2-2 — CURRENT_ITEM/CURRENT_ITEM_INDEX only appear in a FOR_EACH item context, and compile back to the correct roots', () => {
    const m = model([endNode('e1')], [], 'e1');
    const plain = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    expect(plain.some((r) => r.type === 'CURRENT_ITEM' || r.type === 'CURRENT_ITEM_INDEX')).toBe(false);

    const itemCtx = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: true });
    const itemDescriptor = itemCtx.find((r) => r.type === 'CURRENT_ITEM');
    const indexDescriptor = itemCtx.find((r) => r.type === 'CURRENT_ITEM_INDEX');
    expect(itemDescriptor).toBeDefined();
    expect(indexDescriptor).toBeDefined();
    expect(compileWorkflowReference(itemDescriptor!, ['id'])).toEqual({ root: { type: 'CURRENT_ITEM' }, segments: ['id'] });
    expect(compileWorkflowReference(indexDescriptor!)).toEqual({ root: { type: 'CURRENT_ITEM_INDEX' }, segments: [] });
  });
});

describe('searchWorkflowReferences', () => {
  it('fuzzy subsequence-matches over display labels without changing descriptor identity', () => {
    const m = model([actionNode('InvoiceCheck'), endNode('e1')], [unconditionalEdge('e1', 'InvoiceCheck', 'e1')], 'InvoiceCheck');
    const refs = getAuthorizedWorkflowReferences(m, { consumerNodeKey: 'e1', isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    const found = searchWorkflowReferences(refs, 'invchk');
    expect(found.some((r) => r.type === 'NODE_OUTPUT' && r.nodeKey === 'InvoiceCheck')).toBe(true);
  });

  it('empty query returns the full list unchanged', () => {
    const m = model([endNode('e1')], [], 'e1');
    const refs = getAuthorizedWorkflowReferences(m, { consumerNodeKey: null, isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false });
    expect(searchWorkflowReferences(refs, '')).toHaveLength(refs.length);
  });
});

describe('compileWorkflowReference', () => {
  it('compiles each descriptor type to its exact CanonicalPathRoot with the given segments', () => {
    expect(compileWorkflowReference({ type: 'WORKFLOW_INPUT', label: 'x' }, ['a', 0])).toEqual({ root: { type: 'WORKFLOW_INPUT' }, segments: ['a', 0] });
    expect(compileWorkflowReference({ type: 'WORKFLOW_VARIABLE', variableKey: 'v1', label: 'x' })).toEqual({ root: { type: 'WORKFLOW_VARIABLE', variableKey: 'v1' }, segments: [] });
    expect(compileWorkflowReference({ type: 'NODE_OUTPUT', nodeKey: 'a1', label: 'x', ancestorDistance: 1 }, ['total'])).toEqual({ root: { type: 'NODE_OUTPUT', nodeKey: 'a1' }, segments: ['total'] });
    expect(compileWorkflowReference({ type: 'CURRENT_EVENT', label: 'x' })).toEqual({ root: { type: 'CURRENT_EVENT' }, segments: [] });
    expect(compileWorkflowReference({ type: 'CURRENT_WORK_ITEM', projection: 'OUTCOME', label: 'x' })).toEqual({ root: { type: 'CURRENT_WORK_ITEM', projection: 'OUTCOME' }, segments: [] });
  });

  it('descriptorIdentity is stable and label-independent, preventing duplicate-label ambiguity', () => {
    const a = { type: 'NODE_OUTPUT' as const, nodeKey: 'a1', label: 'Invoice Check', ancestorDistance: 2 };
    const b = { type: 'NODE_OUTPUT' as const, nodeKey: 'a1', label: 'renamed display text', ancestorDistance: 2 };
    expect(descriptorIdentity(a)).toBe(descriptorIdentity(b));
    expect(descriptorIdentity(a)).toBe('NODE_OUTPUT:a1');
  });
});
