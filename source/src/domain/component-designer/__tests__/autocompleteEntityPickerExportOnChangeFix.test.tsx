/**
 * @vitest-environment jsdom
 * heroui.autocomplete / heroui.entity-picker — HeroUI's real Autocomplete component has no
 * `onChange` prop (only `onSelectionChange`). Both widgets already fired real events in the
 * canvas preview, but exported/published code emitted a plain `onChange={handler}` attribute
 * the component never calls, so a configured onChange binding silently never fired once
 * published. Fixed via adaptAutocompleteOnChangeAttr (tsxPhase2Palette.ts).
 */
import { describe, expect, it } from 'vitest';
import { createEventBindingDefinition, eventBindingKeyForEvent } from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

const bindOnChange = (state: DesignerState, nodeId: string, endpoint: string): DesignerState =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: eventBindingKeyForEvent('onChange'),
    definition: createEventBindingDefinition('onChange', endpoint, 'POST'),
  });

describe.each(['heroui.autocomplete', 'heroui.entity-picker'] as const)('%s export onChange', (itemId) => {
  it('wires a real selection change path (never a dead onChange on raw Autocomplete)', () => {
    let state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state);
    state = bindOnChange(state, nodeId, '/api/v1/picked');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    if (itemId === 'heroui.autocomplete') {
      // Export uses UiAutocomplete which accepts a real onChange (event-shaped) prop.
      expect(tsx).toMatch(/<UiAutocomplete\b[^>]*\sonChange=\{handle/);
      expect(tsx).not.toMatch(/<Autocomplete\b/);
    } else {
      // Entity-picker still exports raw Autocomplete → needs onSelectionChange adapter.
      expect(tsx).toMatch(/onSelectionChange=\{\(key\) => handle/);
      expect(tsx).not.toMatch(/\sonChange=\{handleonChange_/);
    }
  });
});
