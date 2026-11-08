import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';

describe('AppTableGrid card export', () => {
  it('preserves presentation in generated TSX without card variant presets', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridId = state.selectedNodeId!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridId,
      key: 'presentation',
      value: 'cards',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('presentation="cards"');
    expect(tsx).not.toContain('cardVariant=');
  });
});
