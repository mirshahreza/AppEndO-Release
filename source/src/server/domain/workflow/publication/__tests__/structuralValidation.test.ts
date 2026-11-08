import { describe, expect, it } from 'vitest';
import type { WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../../awm/types';
import { runStructuralValidation } from '../rules/structuralValidation';
import { baseModel, endNode, actionNode, forEachNode, loopNode, subflowNode, unconditionalEdge, errorEdge, cancelRegionEdge, lit } from './fixtures';

const codes = (issues: ReturnType<typeof runStructuralValidation>['issues']) => issues.map((i) => i.code);

describe('runStructuralValidation', () => {
  it('accepts a minimal valid single-node model (start target == the only node, no incoming edges required)', () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const result = runStructuralValidation(model);
    expect(result.issues).toHaveLength(0);
    expect(result.order).toEqual(['end-1']);
  });

  it('flags duplicate node keys and stops before building graph maps', () => {
    const model = baseModel({ nodes: [endNode('dup'), endNode('dup')], start: { type: 'MANUAL_API', targetNodeKey: 'dup' } });
    const result = runStructuralValidation(model);
    expect(codes(result.issues)).toContain('WF_DEF_INVALID_AWM');
    expect(result.order).toBeNull();
  });

  it('flags duplicate edge keys', () => {
    const nodes = [
      { kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' } as WorkflowNodeDefinition,
      endNode('e1'),
      endNode('e2'),
    ];
    const edges: WorkflowEdgeDefinition[] = [
      { key: 'dup-edge', fromNodeKey: 'd1', toNodeKey: 'e1', selector: { type: 'DECISION', condition: lit(true) } },
      { key: 'dup-edge', fromNodeKey: 'd1', toNodeKey: 'e2', selector: { type: 'DECISION_DEFAULT' } },
    ];
    const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
    expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
  });

  it('flags an edge referencing a missing fromNodeKey/toNodeKey', () => {
    const model = baseModel({
      nodes: [endNode('e1')],
      edges: [unconditionalEdge('bad', 'ghost', 'e1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'e1' },
    });
    expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_REFERENCE');
  });

  it('flags a start targetNodeKey that does not exist', () => {
    const model = baseModel({ nodes: [endNode('e1')], start: { type: 'MANUAL_API', targetNodeKey: 'ghost' } });
    expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_REFERENCE');
  });

  it('flags a start target that has an incoming edge (start MUST have no incoming edge)', () => {
    const nodes = [endNode('a'), endNode('b')];
    const edges = [unconditionalEdge('e1', 'a', 'b')];
    // start target is 'b', which has an incoming edge from 'a' -- illegal.
    const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'b' } });
    expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_AWM');
  });

  it('flags a non-start node with zero incoming edges (orphaned node)', () => {
    const nodes = [endNode('start-node'), endNode('orphan')];
    const model = baseModel({ nodes, edges: [], start: { type: 'MANUAL_API', targetNodeKey: 'start-node' } });
    const issues = runStructuralValidation(model).issues;
    expect(issues.some((i) => i.nodeKey === 'orphan' && i.code === 'WF_DEF_INVALID_AWM')).toBe(true);
  });

  describe('edge cardinality per node kind (doc 05 section 25)', () => {
    it('END/FAIL must have zero outgoing edges', () => {
      const nodes = [endNode('a'), endNode('b')];
      const edges = [unconditionalEdge('e1', 'a', 'b')]; // 'a' is END but has an outgoing edge
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'a' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });

    it('ACTION/DELAY/SUBFLOW/PARALLEL_JOIN must have exactly one UNCONDITIONAL outgoing edge', () => {
      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(10) } },
        endNode('e1'),
      ];
      const model = baseModel({ nodes, edges: [], start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });

    describe('WFV2-1 — ACTION ON_ERROR/CATCH edge', () => {
      it('accepts an ACTION node with exactly one UNCONDITIONAL edge and no ON_ERROR edge (unchanged baseline)', () => {
        const nodes = [actionNode('a1'), endNode('ok')];
        const edges = [unconditionalEdge('e1', 'a1', 'ok')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
        expect(runStructuralValidation(model).issues).toHaveLength(0);
      });

      it('accepts an ACTION node with exactly one UNCONDITIONAL edge plus exactly one ON_ERROR edge', () => {
        const nodes = [actionNode('a1'), endNode('ok'), endNode('caught')];
        const edges = [unconditionalEdge('e1', 'a1', 'ok'), errorEdge('e2', 'a1', 'caught')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
        expect(runStructuralValidation(model).issues).toHaveLength(0);
      });

      it('rejects an ACTION node with two ON_ERROR edges', () => {
        const nodes = [actionNode('a1'), endNode('ok'), endNode('caught1'), endNode('caught2')];
        const edges = [unconditionalEdge('e1', 'a1', 'ok'), errorEdge('e2', 'a1', 'caught1'), errorEdge('e3', 'a1', 'caught2')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });

      it('rejects an ACTION node with an ON_ERROR edge but no UNCONDITIONAL edge', () => {
        const nodes = [actionNode('a1'), endNode('caught')];
        const edges = [errorEdge('e1', 'a1', 'caught')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });

      it('ON_ERROR is illegal from a non-ACTION node (e.g. DELAY)', () => {
        const nodes: WorkflowNodeDefinition[] = [
          { kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(10) } },
          endNode('ok'),
          endNode('caught'),
        ];
        const edges = [unconditionalEdge('e1', 'd1', 'ok'), errorEdge('e2', 'd1', 'caught')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });
    });

    describe('WFV2-2 — FOR_EACH edge cardinality (same shape as ACTION)', () => {
      it('accepts a FOR_EACH node with exactly one UNCONDITIONAL edge and an optional ON_ERROR edge', () => {
        const nodes = [forEachNode('f1'), endNode('ok'), endNode('caught')];
        const edges = [unconditionalEdge('e1', 'f1', 'ok'), errorEdge('e2', 'f1', 'caught')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'f1' } });
        expect(runStructuralValidation(model).issues).toHaveLength(0);
      });

      it('rejects a FOR_EACH node missing its UNCONDITIONAL edge', () => {
        const nodes = [forEachNode('f1'), endNode('ok')];
        const model = baseModel({ nodes, edges: [], start: { type: 'MANUAL_API', targetNodeKey: 'f1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });

      it('rejects a FOR_EACH node with two ON_ERROR edges', () => {
        const nodes = [forEachNode('f1'), endNode('ok'), endNode('c1'), endNode('c2')];
        const edges = [unconditionalEdge('e1', 'f1', 'ok'), errorEdge('e2', 'f1', 'c1'), errorEdge('e3', 'f1', 'c2')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'f1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });
    });

    describe('LOOP edge cardinality (same shape as ACTION / FOR_EACH)', () => {
      it('accepts a LOOP node with exactly one UNCONDITIONAL edge and an optional ON_ERROR edge', () => {
        const nodes = [loopNode('l1'), endNode('ok'), endNode('caught')];
        const edges = [unconditionalEdge('e1', 'l1', 'ok'), errorEdge('e2', 'l1', 'caught')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'l1' } });
        expect(runStructuralValidation(model).issues).toHaveLength(0);
      });

      it('rejects a LOOP node missing its UNCONDITIONAL edge', () => {
        const nodes = [loopNode('l1'), endNode('ok')];
        const model = baseModel({ nodes, edges: [], start: { type: 'MANUAL_API', targetNodeKey: 'l1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });

      it('rejects a LOOP node with two ON_ERROR edges', () => {
        const nodes = [loopNode('l1'), endNode('ok'), endNode('c1'), endNode('c2')];
        const edges = [unconditionalEdge('e1', 'l1', 'ok'), errorEdge('e2', 'l1', 'c1'), errorEdge('e3', 'l1', 'c2')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'l1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });
    });

    describe('p-99/WFT-9 — SUBFLOW Cancel Region edge', () => {
      it('accepts a plain SUBFLOW node with exactly one UNCONDITIONAL edge and no cancelEvent (unchanged baseline)', () => {
        const nodes = [subflowNode('s1'), endNode('ok')];
        const edges = [unconditionalEdge('e1', 's1', 'ok')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 's1' } });
        expect(runStructuralValidation(model).issues).toHaveLength(0);
      });

      it('accepts a SUBFLOW node with cancelEvent plus exactly one CANCEL_REGION edge', () => {
        const nodes = [subflowNode('s1', { cancelEvent: { eventName: 'order.cancelled', correlation: lit('x') } }), endNode('ok'), endNode('cancelled')];
        const edges = [unconditionalEdge('e1', 's1', 'ok'), cancelRegionEdge('e2', 's1', 'cancelled')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 's1' } });
        expect(runStructuralValidation(model).issues).toHaveLength(0);
      });

      it('rejects a SUBFLOW node with cancelEvent but no CANCEL_REGION edge', () => {
        const nodes = [subflowNode('s1', { cancelEvent: { eventName: 'order.cancelled', correlation: lit('x') } }), endNode('ok')];
        const edges = [unconditionalEdge('e1', 's1', 'ok')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 's1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });

      it('rejects a CANCEL_REGION edge on a SUBFLOW with no cancelEvent configured', () => {
        const nodes = [subflowNode('s1'), endNode('ok'), endNode('cancelled')];
        const edges = [unconditionalEdge('e1', 's1', 'ok'), cancelRegionEdge('e2', 's1', 'cancelled')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 's1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });

      it('rejects two CANCEL_REGION edges on the same SUBFLOW', () => {
        const nodes = [subflowNode('s1', { cancelEvent: { eventName: 'order.cancelled', correlation: lit('x') } }), endNode('ok'), endNode('c1'), endNode('c2')];
        const edges = [unconditionalEdge('e1', 's1', 'ok'), cancelRegionEdge('e2', 's1', 'c1'), cancelRegionEdge('e3', 's1', 'c2')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 's1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });

      it('CANCEL_REGION is illegal from a non-SUBFLOW node (e.g. ACTION)', () => {
        const nodes = [actionNode('a1'), endNode('ok'), endNode('cancelled')];
        const edges = [unconditionalEdge('e1', 'a1', 'ok'), cancelRegionEdge('e2', 'a1', 'cancelled')];
        const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
        expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
      });
    });

    it('WORK_ITEM edges must exactly match declared allowedOutcomes', () => {
      const nodes: WorkflowNodeDefinition[] = [
        {
          kind: 'WORK_ITEM',
          key: 'wi1',
          workItemType: 'APPROVAL',
          assignment: { strategy: 'USER', userId: 'u1' },
          allowedOutcomes: ['APPROVE', 'REJECT'],
          title: lit('t'),
          input: { type: 'OBJECT', fields: {} },
          outputSchema: { type: 'INLINE', schema: {} },
        },
        endNode('approved'),
      ];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'e1', fromNodeKey: 'wi1', toNodeKey: 'approved', selector: { type: 'WORK_ITEM_OUTCOME', outcomeKey: 'APPROVE' } },
        // missing REJECT edge
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'wi1' } });
      const issues = runStructuralValidation(model).issues;
      expect(issues.some((i) => i.code === 'WF_DEF_INVALID_EDGE_SHAPE' && i.nodeKey === 'wi1')).toBe(true);
    });

    it('WAIT_EVENT with a declared timeout requires exactly one matching WAIT_TIMEOUT edge', () => {
      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'WAIT_EVENT', key: 'w1', eventName: 'evt', correlation: lit(true), timeout: { afterMs: lit(1000), outcomeKey: 'TIMED_OUT' } },
        endNode('a'),
      ];
      const edges: WorkflowEdgeDefinition[] = [unconditionalEdge('e1', 'w1', 'a')]; // missing WAIT_TIMEOUT edge
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'w1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });

    it('DECISION requires at least one condition edge and exactly one DECISION_DEFAULT edge', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' }, endNode('a')];
      const edges: WorkflowEdgeDefinition[] = [unconditionalEdge('bad-type', 'd1', 'a')]; // wrong selector type entirely
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });

    it('SWITCH rejects duplicate case values after canonical normalization', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'SWITCH', key: 's1', value: lit('x') }, endNode('a'), endNode('b')];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'c1', fromNodeKey: 's1', toNodeKey: 'a', selector: { type: 'SWITCH_CASE', value: 1 } },
        { key: 'c2', fromNodeKey: 's1', toNodeKey: 'b', selector: { type: 'SWITCH_CASE', value: 1 } },
        { key: 'c3', fromNodeKey: 's1', toNodeKey: 'a', selector: { type: 'SWITCH_DEFAULT' } },
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 's1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });

    it('PARALLEL_SPLIT requires two or more UNCONDITIONAL outgoing edges', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'PARALLEL_SPLIT', key: 'p1' }, endNode('a')];
      const edges: WorkflowEdgeDefinition[] = [unconditionalEdge('e1', 'p1', 'a')];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'p1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });
  });

  describe('decision semantics (doc 05 section 4, 30)', () => {
    it('FIRST_MATCH requires an explicit priority on every condition edge', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1', mode: 'FIRST_MATCH' }, endNode('a'), endNode('b')];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'c1', fromNodeKey: 'd1', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(true) } }, // no priority
        { key: 'c2', fromNodeKey: 'd1', toNodeKey: 'b', selector: { type: 'DECISION_DEFAULT' } },
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });

    it('FIRST_MATCH requires unique priorities across condition edges', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1', mode: 'FIRST_MATCH' }, endNode('a'), endNode('b'), endNode('c')];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'c1', fromNodeKey: 'd1', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(true), priority: 1 } },
        { key: 'c2', fromNodeKey: 'd1', toNodeKey: 'b', selector: { type: 'DECISION', condition: lit(false), priority: 1 } },
        { key: 'c3', fromNodeKey: 'd1', toNodeKey: 'c', selector: { type: 'DECISION_DEFAULT' } },
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_INVALID_EDGE_SHAPE');
    });

    it('EXACT_ONE flags two condition edges with a canonically identical condition as provably ambiguous', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' }, endNode('a'), endNode('b'), endNode('c')];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'c1', fromNodeKey: 'd1', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'c2', fromNodeKey: 'd1', toNodeKey: 'b', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'c3', fromNodeKey: 'd1', toNodeKey: 'c', selector: { type: 'DECISION_DEFAULT' } },
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      expect(codes(runStructuralValidation(model).issues)).toContain('WF_DEF_AMBIGUOUS_DECISION');
    });

    it('EXACT_ONE accepts distinct condition expressions with no ambiguity', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' }, endNode('a'), endNode('b'), endNode('c')];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'c1', fromNodeKey: 'd1', toNodeKey: 'a', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'c2', fromNodeKey: 'd1', toNodeKey: 'b', selector: { type: 'DECISION', condition: lit(false) } },
        { key: 'c3', fromNodeKey: 'd1', toNodeKey: 'c', selector: { type: 'DECISION_DEFAULT' } },
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      expect(runStructuralValidation(model).issues).toHaveLength(0);
    });
  });

  describe('reachability, cycles and terminal-path existence', () => {
    it('flags a node unreachable from the start target', () => {
      const nodes = [endNode('start'), endNode('unreachable')];
      const model = baseModel({ nodes, edges: [], start: { type: 'MANUAL_API', targetNodeKey: 'start' } });
      // 'unreachable' has no incoming edge either, so both rules will fire on it -- assert the reachability one specifically is present.
      const issues = runStructuralValidation(model).issues;
      expect(issues.some((i) => i.nodeKey === 'unreachable' && i.message.includes('unreachable'))).toBe(true);
    });

    it('detects a cycle in the reachable graph and skips downstream terminal-path checks', () => {
      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' },
        { kind: 'DECISION', key: 'd2', mode: 'EXACT_ONE' },
      ];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'e1', fromNodeKey: 'd1', toNodeKey: 'd2', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'e1-def', fromNodeKey: 'd1', toNodeKey: 'd2', selector: { type: 'DECISION_DEFAULT' } },
        { key: 'e2', fromNodeKey: 'd2', toNodeKey: 'd1', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'e2-def', fromNodeKey: 'd2', toNodeKey: 'd1', selector: { type: 'DECISION_DEFAULT' } },
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      const result = runStructuralValidation(model);
      expect(result.order).toBeNull();
      expect(result.issues.some((i) => i.message.includes('cycle'))).toBe(true);
    });

    it('flags a reachable branch with no structural path to END/FAIL', () => {
      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' },
        endNode('terminates'),
        { kind: 'PARALLEL_JOIN', key: 'dead-end', mode: 'ALL' }, // reachable, acyclic, but has zero outgoing edges and is not END/FAIL
      ];
      const edges: WorkflowEdgeDefinition[] = [
        { key: 'e1', fromNodeKey: 'd1', toNodeKey: 'terminates', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'e2', fromNodeKey: 'd1', toNodeKey: 'dead-end', selector: { type: 'DECISION_DEFAULT' } },
      ];
      const model = baseModel({ nodes, edges, start: { type: 'MANUAL_API', targetNodeKey: 'd1' } });
      const issues = runStructuralValidation(model).issues;
      expect(issues.some((i) => i.nodeKey === 'dead-end' && i.message.includes('no structural path'))).toBe(true);
    });
  });
});
