import { describe, expect, it } from 'vitest';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import { buildClientComponentAiSnapshot } from '../lib/clientComponentAiSnapshot';

describe('buildClientComponentAiSnapshot', () => {
  it('includes the canvas document, selected node, and layout id', () => {
    const state = createInitialDesignerState('probe');
    const snapshot = JSON.parse(buildClientComponentAiSnapshot({
      name: 'probe',
      layoutId: 'draft-1',
      selectedNodeId: state.document.rootNodeId,
      readOnly: false,
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    }));

    expect(snapshot.name).toBe('probe');
    expect(snapshot.layoutId).toBe('draft-1');
    expect(snapshot.selectedNodeId).toBe(state.document.rootNodeId);
    expect(snapshot.nodeCount).toBeGreaterThan(0);
    expect(snapshot.document.rootNodeId).toBe(state.document.rootNodeId);
    expect(snapshot.selectedNode.id).toBe(state.document.rootNodeId);
  });
});
