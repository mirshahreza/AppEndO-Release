import { describe, expect, it } from 'vitest';
import { mergeEmbeddedDocumentBindings } from '../designerDocumentBindingMerge';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { createInitialDesignerState } from '../state';

describe('mergeEmbeddedDocumentBindings', () => {
  it('restores select palette and items binding from embedded document by field name', () => {
    const initial = createInitialDesignerState();
    const embeddedNodeId = 'embedded-select';
    const reconciledNodeId = 'reconciled-select';

    const embedded = {
      ...initial.document,
      nodes: {
        ...initial.document.nodes,
        [embeddedNodeId]: {
          id: embeddedNodeId,
          type: 'container',
          parentId: initial.document.rootNodeId,
          order: 0,
          props: {
            name: 'genderCode',
            _designerPaletteItemId: 'heroui.select',
          },
          layout: {},
          binding: {
            [propertyBindingKeyForProp('items')]: createPropertyBindingDefinition(
              'items',
              'items',
              { fetchEndpoint: '/api/base-info/options?root=100.1&lang=en' },
            ),
          },
          children: [],
        },
      },
    };

    const reconciled = {
      ...initial.document,
      nodes: {
        ...initial.document.nodes,
        [reconciledNodeId]: {
          id: reconciledNodeId,
          type: 'container',
          parentId: initial.document.rootNodeId,
          order: 0,
          props: {
            name: 'genderCode',
            _designerPaletteItemId: 'html.container',
            _jsxSourceTag: 'UiSelect',
          },
          layout: {},
          binding: {},
          children: [],
        },
      },
    };

    const merged = mergeEmbeddedDocumentBindings(embedded, reconciled);
    const node = merged.nodes[reconciledNodeId];

    expect(node?.props._designerPaletteItemId).toBe('heroui.select');
    expect(node?.binding[propertyBindingKeyForProp('items')]?.fetchEndpoint)
      .toBe('/api/base-info/options?root=100.1&lang=en');
  });
});
