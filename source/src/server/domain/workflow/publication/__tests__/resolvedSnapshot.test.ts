import { describe, expect, it } from 'vitest';
import type { WorkflowNodeDefinition } from '../../awm/types';
import { buildResolvedSnapshot } from '../resolvedSnapshot';
import { baseModel, endNode } from './fixtures';
import type { ResolvedActionNodeBinding } from '../validationTypes';

describe('buildResolvedSnapshot', () => {
  it('normalizes an omitted DECISION mode to EXACT_ONE (doc 05 section 19 default)', () => {
    const nodes: WorkflowNodeDefinition[] = [{ kind: 'DECISION', key: 'd1' }, endNode('e1')];
    const model = baseModel({ nodes });
    const snapshot = buildResolvedSnapshot(model, []);
    const decision = snapshot.normalizedModel.nodes.find((n) => n.key === 'd1') as Extract<WorkflowNodeDefinition, { kind: 'DECISION' }>;
    expect(decision.mode).toBe('EXACT_ONE');
    expect(JSON.parse(snapshot.definitionJson).nodes.find((n: { key: string }) => n.key === 'd1').mode).toBe('EXACT_ONE');
  });

  it('normalizes an omitted PARALLEL_JOIN cancelRemaining to false', () => {
    const nodes: WorkflowNodeDefinition[] = [{ kind: 'PARALLEL_JOIN', key: 'j1', mode: 'ALL' }, endNode('e1')];
    const model = baseModel({ nodes });
    const snapshot = buildResolvedSnapshot(model, []);
    const join = snapshot.normalizedModel.nodes.find((n) => n.key === 'j1') as Extract<WorkflowNodeDefinition, { kind: 'PARALLEL_JOIN' }>;
    expect(join.cancelRemaining).toBe(false);
  });

  it('produces a deterministic fingerprint for identical models and a different one when content changes', () => {
    const modelA = baseModel({ nodes: [endNode('e1')] });
    const modelB = baseModel({ nodes: [endNode('e1')] });
    const modelC = baseModel({ nodes: [endNode('e2')] });
    const snapA = buildResolvedSnapshot(modelA, []);
    const snapB = buildResolvedSnapshot(modelB, []);
    const snapC = buildResolvedSnapshot(modelC, []);
    expect(snapA.semanticFingerprint).toBe(snapB.semanticFingerprint);
    expect(snapA.semanticFingerprint).not.toBe(snapC.semanticFingerprint);
  });

  it('embeds inputSchema/outputSchema in schemaProjectionsJson', () => {
    const model = baseModel({ inputSchema: { type: 'INLINE', schema: { x: 1 } }, outputSchema: { type: 'INLINE', schema: { y: 2 } } });
    const snapshot = buildResolvedSnapshot(model, []);
    const projections = JSON.parse(snapshot.schemaProjectionsJson);
    expect(projections.inputSchema).toEqual({ type: 'INLINE', schema: { x: 1 } });
    expect(projections.outputSchema).toEqual({ type: 'INLINE', schema: { y: 2 } });
  });

  it('serializes the resolved action bindings passed in', () => {
    const binding: ResolvedActionNodeBinding = {
      nodeKey: 'a1',
      actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'test.action', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
      actionFingerprint: 'fp-abc',
      resolvedRetryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 100, retryOn: [] },
      maximumLogicalInvocationWindowMs: 5000,
      providerOrderPolicyVersion: 'workflow.capability-provider-order/v1',
      pinnedProvider: { providerId: 'core', providerVersion: '1', providerFingerprint: 'fp-abc' },
    };
    const snapshot = buildResolvedSnapshot(baseModel(), [binding]);
    const parsed = JSON.parse(snapshot.actionBindingsJson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ nodeKey: 'a1', actionFingerprint: 'fp-abc' });
  });
});
