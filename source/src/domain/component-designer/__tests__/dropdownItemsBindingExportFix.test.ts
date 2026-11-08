import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 7): unlike `heroui.select`/`heroui.autocomplete`/`heroui.listbox`
 * (all of which correctly resolve a dynamically bound `items` source in export via
 * `resolveNodeOptionItemsDataExpression` + `renderDesignerItemsMapperExpression`),
 * `heroui.dropdown`'s codegen only ever called the static-only `parseDesignerAutocompleteItems`
 * on the raw node prop — so a bound/LOV `items` source worked live in the canvas/interactive
 * Preview (`DesignerRuntimeDropdown.tsx`'s `useDesignerOptionItems`) but always exported only the
 * static placeholder ("Option 1"). Mirrors `heroui.listbox`'s equivalent, already-fixed bug
 * exactly (see `listboxItemsBindingExportFix.test.ts`); react-aria's Menu, like ListBox, supports
 * the `items` + render-prop collection pattern.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('heroui.dropdown items binding export fix (parity audit item 7)', () => {
  it('exports a real, dynamic items expression instead of the static placeholder options', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
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
    assertValidTsxSyntax('dropdown bound items', tsx);

    expect(tsx).toMatch(/<Dropdown\.Menu[^>]*? items=\{mapDesignerListBoxItems\(dataContext\?\.lovData_topics\) \?\? \[\]\}/);
    const itemsAttrCount = (tsx.match(/ items=\{/g) ?? []).length;
    expect(itemsAttrCount).toBe(1);
    expect(tsx).toContain('(item) => <Dropdown.Item id={item.id}>{item.textValue}</Dropdown.Item>');
    expect(tsx).not.toContain('Option 1');
  });

  it('still exports the static placeholder option when items is not bound', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('dropdown static items', tsx);
    expect(tsx).toContain('Option 1');
  });
});
