import { describe, expect, it } from 'vitest';
import { createInitialDesignerState } from '../state';
import { computeDesignerPublishDiff } from '../publishDiff';

describe('computeDesignerPublishDiff', () => {
  it('reports all nodes as added on first publish', () => {
    const state = createInitialDesignerState();
    const diff = computeDesignerPublishDiff(state.document, null);
    expect(diff.nodesAdded).toBeGreaterThan(0);
    expect(diff.nodesRemoved).toBe(0);
  });

  it('reports no changes when documents match', () => {
    const state = createInitialDesignerState();
    const diff = computeDesignerPublishDiff(state.document, state.document);
    expect(diff.nodesAdded).toBe(0);
    expect(diff.nodesRemoved).toBe(0);
    expect(diff.nodesChanged).toBe(0);
    expect(diff.propsChanged).toBe(0);
  });
});
