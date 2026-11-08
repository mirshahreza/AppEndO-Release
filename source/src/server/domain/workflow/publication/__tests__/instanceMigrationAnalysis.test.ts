import { describe, expect, it } from 'vitest';
import { analyzeInstanceMigration } from '../instanceMigrationService';
import { baseModel, endNode, actionNode, unconditionalEdge } from './fixtures';

/**
 * p-99/WFT-8 — pure unit coverage for the "safe subset" migration analyzer. No DB: this is exactly
 * the logic the user asked to keep conservative (a blocked instance is left alone, never a
 * best-effort/partial migration), so every blocking condition and the forward-reachability closure
 * itself needs direct, fast coverage independent of the real-DB wiring test.
 */
describe('analyzeInstanceMigration', () => {
  const model = () =>
    baseModel({
      nodes: [actionNode('a1'), actionNode('a2'), endNode('end-1')],
      edges: [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });

  it('is safe when old and new models are byte-identical', () => {
    const oldModel = model();
    const newModel = model();
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: true });
  });

  it('blocks on any variables change, regardless of node graph', () => {
    const oldModel = model();
    const newModel = { ...model(), variables: [{ key: 'x', schema: { type: 'INLINE' as const, schema: {} } }] };
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: false, reason: { code: 'VARIABLES_CHANGED' } });
  });

  it('blocks on any policies change, regardless of node graph', () => {
    const oldModel = model();
    const newModel = model();
    newModel.policies = { ...newModel.policies, recoveryDetectionBoundMs: 999 };
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: false, reason: { code: 'POLICIES_CHANGED' } });
  });

  it('blocks when the currently-active node itself changed', () => {
    const oldModel = model();
    const newModel = model();
    newModel.nodes = newModel.nodes.map((n) => (n.key === 'a1' ? actionNode('a1', { retryPolicy: { maxAttempts: 5, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }) : n));
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: false, reason: { code: 'NODE_CHANGED', nodeKey: 'a1' } });
  });

  it('blocks when a node reachable downstream of the active node changed (not just the current node)', () => {
    const oldModel = model();
    const newModel = model();
    newModel.nodes = newModel.nodes.map((n) => (n.key === 'a2' ? actionNode('a2', { retryPolicy: { maxAttempts: 5, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }) : n));
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: false, reason: { code: 'NODE_CHANGED', nodeKey: 'a2' } });
  });

  it('blocks when a node reachable downstream was removed', () => {
    const oldModel = model();
    const newModel = model();
    newModel.nodes = newModel.nodes.filter((n) => n.key !== 'end-1');
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: false, reason: { code: 'NODE_REMOVED', nodeKey: 'end-1' } });
  });

  it('blocks when the active node\'s outgoing edges changed', () => {
    const oldModel = model();
    const newModel = model();
    newModel.edges = [unconditionalEdge('e1', 'a1', 'end-1'), unconditionalEdge('e2', 'a2', 'end-1')];
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: false, reason: { code: 'EDGES_CHANGED', nodeKey: 'a1' } });
  });

  it('stays safe when a change is entirely unreachable from the active node', () => {
    const oldModel = baseModel({
      nodes: [actionNode('a1'), endNode('end-1'), actionNode('unrelated')],
      edges: [unconditionalEdge('e1', 'a1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });
    const newModel = { ...oldModel, nodes: oldModel.nodes.map((n) => (n.key === 'unrelated' ? actionNode('unrelated', { retryPolicy: { maxAttempts: 9, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }) : n)) };
    expect(analyzeInstanceMigration(oldModel, newModel, ['a1'])).toEqual({ safe: true });
  });
});
