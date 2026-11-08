import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import type { DesignerState } from '../types';

/**
 * Bug found: unlike `heroui.select`/`heroui.autocomplete` (which both correctly resolve a
 * dynamically bound `items` source in export via `resolveNodeOptionItemsDataExpression` +
 * `renderDesignerItemsMapperExpression`), `heroui.listbox`'s codegen only ever called
 * `renderAutocompleteListBoxItems(node)` — a static-only parser with no bindingContext
 * parameter — so a bound/LOV `items` source worked live in the canvas but always exported only
 * the static placeholder options ("Option 1/2/3").
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('heroui.listbox items binding export fix', () => {
  it('exports a real, dynamic items expression instead of the static placeholder options', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.listbox');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('items'),
      definition: createPropertyBindingDefinition('items', 'lovData_topics', {
        fetchEndpoint: '/api/lov/topics',
        lovRef: 'topics',
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('listbox bound items', tsx);

    expect(tsx).toMatch(/<ListBox[^>]*? items=\{mapDesignerListBoxItems\(dataContext\?\.lovData_topics\) \?\? \[\]\}/);
    const itemsAttrCount = (tsx.match(/ items=\{/g) ?? []).length;
    expect(itemsAttrCount).toBe(1);
    expect(tsx).toContain('(item) => <ListBox.Item id={item.id} textValue={item.textValue}>{item.textValue}</ListBox.Item>');
    expect(tsx).not.toContain('Option 1');
  });

  it('still exports the static placeholder options when items is not bound', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.listbox');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('listbox static items', tsx);
    expect(tsx).toContain('Option 1');
  });
});
