import { describe, expect, it } from 'vitest';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { resolveDesignerNodeOptionItemViews } from '../designerOptionItems';
import { createInitialDesignerState, designerReducer } from '../state';
import { createDesignerPreviewBindingBridge } from '../designerPreviewResolvers';

describe('designer dropdown option items', () => {
  it('resolves static option items for dropdown nodes without binding', () => {
    const initial = createInitialDesignerState();
    const withDropdown = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withDropdown.selectedNodeId!;
    const state = designerReducer(withDropdown, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'alpha', textValue: 'Alpha item' },
        { id: 'beta', textValue: 'Beta item' },
      ]),
    });

    const node = state.document.nodes[nodeId];
    const items = resolveDesignerNodeOptionItemViews(
      node,
      createDesignerPreviewBindingBridge({
        previewResults: {},
        designerStore: {},
        dataContext: {},
      }),
    );

    expect(items).toEqual([
      { value: 'alpha', label: 'Alpha item' },
      { value: 'beta', label: 'Beta item' },
    ]);
  });

  it('falls back to static items when binding resolves to an unresolved placeholder', () => {
    const initial = createInitialDesignerState();
    const withDropdown = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withDropdown.selectedNodeId!;
    let state = designerReducer(withDropdown, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([{ id: 'only', textValue: 'Only item' }]),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('items'),
      definition: createPropertyBindingDefinition('items', 'form.options'),
    });

    const node = state.document.nodes[nodeId];
    const items = resolveDesignerNodeOptionItemViews(
      node,
      createDesignerPreviewBindingBridge({
        previewResults: {},
        designerStore: {},
        dataContext: {},
      }),
    );

    expect(items).toEqual([{ value: 'only', label: 'Only item' }]);
  });
});
