/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { createDesignerPreviewBindingBridge } from '../designerPreviewResolvers';
import { createInitialDesignerState, designerReducer } from '../state';
import { useDesignerOptionItems } from '../useDesignerOptionItems';

describe('useDesignerOptionItems', () => {
  it('maps preview-bound select items without throwing', async () => {
    const initial = createInitialDesignerState();
    const withSelect = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withSelect.selectedNodeId!;
    const state = designerReducer(withSelect, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('items'),
      definition: createPropertyBindingDefinition('items', 'lovData_topic_code'),
    });

    const node = state.document.nodes[nodeId]!;
    const previewBindings = createDesignerPreviewBindingBridge({
      previewResults: {
        [`node:${nodeId}:prop:items`]: [
          { id: '104.1', textValue: 'Support' },
          { id: '104.2', textValue: 'Sales' },
        ],
      },
      designerStore: {},
      dataContext: {},
    });

    const { result } = renderHook(() => useDesignerOptionItems(node, { previewBindings }));

    await waitFor(() => {
      expect(result.current.items).toEqual([
        { value: '104.1', label: 'Support' },
        { value: '104.2', label: 'Sales' },
      ]);
    });
    expect(result.current.isLoading).toBe(false);
  });
});
