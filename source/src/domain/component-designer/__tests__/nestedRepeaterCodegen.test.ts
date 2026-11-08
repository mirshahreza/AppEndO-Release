import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { REPEATER_LIST_RESOURCE_BINDING_KEY, createRepeaterListResourceBindingDefinition } from '../bindingRepeaterEngine';
import type { DesignerState } from '../types';

/**
 * Bug found: a Repeater nested inside another Repeater, with `dataPath="item.<field>"` (e.g.
 * "for each order, repeat its line items"), always resolved its array expression against the
 * page's `dataContext` in exported code (`dataContext?.item?.lineItems ?? []` — a field that
 * doesn't exist there) instead of the PARENT repeater's current item — silently rendering empty
 * in production while the live canvas/preview correctly resolved it against the parent item.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('nested repeater codegen', () => {
  it('resolves a nested repeater\'s item-scoped dataPath against the parent item, not dataContext', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: { id: 'orders', name: 'Orders', endpoint: '/api/orders', fields: ['id', 'lineItems'] },
    });

    state = insertItem(state, 'logic.repeater');
    const outerRepeaterId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: outerRepeaterId,
      bindingKey: REPEATER_LIST_RESOURCE_BINDING_KEY,
      definition: createRepeaterListResourceBindingDefinition('orders'),
    });

    state = insertItem(state, 'logic.repeater', outerRepeaterId);
    const innerRepeaterId = lastChildId(state, outerRepeaterId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: innerRepeaterId,
      key: 'dataPath',
      value: 'item.lineItems',
    });

    state = insertItem(state, 'html.text', innerRepeaterId);
    const textId = lastChildId(state, innerRepeaterId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: textId,
      key: 'text',
      value: 'Line item marker',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('nested repeater item-scoped dataPath', tsx);

    // The inner repeater's array expression must reference the outer repeater's item variable
    // (item?.lineItems), never the page's dataContext.
    expect(tsx).not.toContain('dataContext?.item?.lineItems');
    expect(tsx).toMatch(/\{\(\(item\?\.lineItems\) \?\? \[\]\)\.map\(/);
  });

  it('still resolves a top-level (non-nested) repeater dataPath against dataContext as before', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'logic.repeater');
    const repeaterId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId: repeaterId, key: 'dataPath', value: 'products' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('top-level repeater', tsx);
    expect(tsx).toMatch(/\{\(dataContext\?\.products \?\? \[\]\)\.map\(/);
  });
});
