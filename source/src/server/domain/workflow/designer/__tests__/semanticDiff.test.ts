import { describe, expect, it } from 'vitest';
import type { WorkflowModel } from '../../awm/types';
import { baseModel, endNode, actionNode, unconditionalEdge, mappingOf, nodeOutput } from '../../publication/__tests__/fixtures';
import { computeSemanticDiff } from '../semanticDiff';

const modelOf = (overrides: Partial<WorkflowModel> = {}): WorkflowModel => baseModel({ nodes: [endNode('e1')], start: { type: 'MANUAL_API', targetNodeKey: 'e1' }, ...overrides });

describe('computeSemanticDiff', () => {
  it('previous === null reports everything as ADDED and identical=false', () => {
    const next = modelOf();
    const result = computeSemanticDiff(null, next);
    expect(result.previousFingerprint).toBeNull();
    expect(result.identical).toBe(false);
    expect(result.nodes).toEqual([{ kind: 'ADDED', nodeKey: 'e1', nodeKind: 'END', actionBindingChanged: false }]);
  });

  it('two structurally identical models diff to identical=true with no entries', () => {
    const a = modelOf();
    const b = modelOf();
    const result = computeSemanticDiff(a, b);
    expect(result.identical).toBe(true);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(Object.values(result.workflowLevel).every((v) => v === false)).toBe(true);
  });

  it('detects an ADDED node, a REMOVED node and an unchanged shared node in one diff', () => {
    const a = modelOf({ nodes: [endNode('e1'), actionNode('a1')] });
    const b = modelOf({ nodes: [endNode('e1'), actionNode('a2')] });
    const result = computeSemanticDiff(a, b);
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        { kind: 'ADDED', nodeKey: 'a2', nodeKind: 'ACTION', actionBindingChanged: false },
        { kind: 'REMOVED', nodeKey: 'a1', nodeKind: 'ACTION', actionBindingChanged: false },
      ]),
    );
    expect(result.nodes.some((n) => n.nodeKey === 'e1')).toBe(false);
  });

  it('flags actionBindingChanged and lists the node in bindingImpactNodeKeys when only the ACTION ref changes', () => {
    const a = modelOf({ nodes: [endNode('e1'), actionNode('a1', { actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'k', actionVersion: '1' }, providerId: 'p', providerVersion: '1' } })] });
    const b = modelOf({ nodes: [endNode('e1'), actionNode('a1', { actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'k', actionVersion: '2' }, providerId: 'p', providerVersion: '1' } })] });
    const result = computeSemanticDiff(a, b);
    const entry = result.nodes.find((n) => n.nodeKey === 'a1')!;
    expect(entry.kind).toBe('MODIFIED');
    expect(entry.actionBindingChanged).toBe(true);
    expect(result.bindingImpactNodeKeys).toEqual(['a1']);
  });

  it('does not flag actionBindingChanged when only a non-binding field (e.g. input mapping) changes', () => {
    const a = modelOf({ nodes: [endNode('e1'), actionNode('a1', { input: mappingOf({ v: nodeOutput('a1') }) })] });
    const b = modelOf({ nodes: [endNode('e1'), actionNode('a1', { input: mappingOf({ v: nodeOutput('a1', ['x']) }) })] });
    const result = computeSemanticDiff(a, b);
    const entry = result.nodes.find((n) => n.nodeKey === 'a1')!;
    expect(entry.kind).toBe('MODIFIED');
    expect(entry.actionBindingChanged).toBe(false);
    expect(result.bindingImpactNodeKeys).toEqual([]);
  });

  it('diffs edges by key (ADDED/REMOVED/MODIFIED)', () => {
    const a = modelOf({ nodes: [actionNode('a1'), endNode('e1')], edges: [unconditionalEdge('edge1', 'a1', 'e1')], start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
    const b = modelOf({ nodes: [actionNode('a1'), endNode('e1'), endNode('e2')], edges: [unconditionalEdge('edge1', 'a1', 'e2')], start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
    const result = computeSemanticDiff(a, b);
    expect(result.edges).toEqual([{ kind: 'MODIFIED', edgeKey: 'edge1', fromNodeKey: 'a1', toNodeKey: 'e2' }]);
  });

  it('workflowLevel.startChanged is true only when the start target/type differs', () => {
    const a = modelOf({ nodes: [endNode('e1'), endNode('e2')], start: { type: 'MANUAL_API', targetNodeKey: 'e1' } });
    const b = modelOf({ nodes: [endNode('e1'), endNode('e2')], start: { type: 'MANUAL_API', targetNodeKey: 'e2' } });
    const result = computeSemanticDiff(a, b);
    expect(result.workflowLevel.startChanged).toBe(true);
    expect(result.workflowLevel.variablesChanged).toBe(false);
  });

  it('is insensitive to omitted-default normalization (a normalized-equal DECISION mode diffs to identical)', () => {
    const withDefaultOmitted = modelOf({ nodes: [{ kind: 'DECISION', key: 'd1' }, endNode('e1')], edges: [unconditionalEdge('edge1', 'd1', 'e1')], start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
    const withDefaultExplicit = modelOf({ nodes: [{ kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' }, endNode('e1')], edges: [unconditionalEdge('edge1', 'd1', 'e1')], start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
    const result = computeSemanticDiff(withDefaultOmitted, withDefaultExplicit);
    expect(result.identical).toBe(true);
  });
});
