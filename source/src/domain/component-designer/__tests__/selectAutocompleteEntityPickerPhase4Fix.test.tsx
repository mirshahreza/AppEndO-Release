/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit items 31, 32, 46–52, 90, 92): Select/Autocomplete/Entity-Picker/
 * Tags-Input family — decorative closeOnSelect field, dead select label, Export label missing
 * for autocomplete/entity-picker, missing validation feedback, tags-input value binding ignored
 * in Export, hard-coded entity-picker LOV fields, decorative allowCustomValue, and dishonest
 * "Search…" placeholders on Select-based Autocomplete.
 * Fixed across DesignerRuntimeSelect/Autocomplete, runtimeNodeProps, HeroFieldControls,
 * bindingEntityPickerCodegen, tsxNodeRenderer, tsxPhase2Palette, tsxParityPalette,
 * inspectorPaletteFields, catalog.
 *
 * Item 47 re-verification note: an earlier pass "fixed" item 47 by renaming the emitted attribute
 * from `closeOnSelect` to `shouldCloseOnSelect`, on the premise that was the real react-stately
 * prop name. That premise was wrong for this component family — checked directly against the
 * installed `@heroui/react/node_modules/react-aria-components` type defs, `shouldCloseOnSelect`
 * only exists on Menu/MenuItem and DatePicker/DateRangePicker, never on Select/Autocomplete/
 * ComboBox. HeroUI's AutocompleteRoot/SelectRoot spread props straight onto react-aria-components'
 * `Select`, which always closes its popover on selection with no override, so the renamed prop
 * was exactly as inert as the original name in every path (Canvas/Preview/Export). Re-fixed by
 * removing the field and all forwarding entirely, matching the allowCustomValue precedent
 * (item 92) rather than leaving a differently-named but equally decorative field.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { renderEntityPickerRuntimeHelper } from '../bindingEntityPickerCodegen';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { toJsxAttributeName } from '../propRegistry';
import { resolveAutocompleteMenuProps, resolveSelectMenuProps } from '../runtimeNodeProps';
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

const inspectorKeys = (state: DesignerState, nodeId: string): string[] =>
  resolveInspectorFieldSections(state.document.nodes[nodeId]!)
    .flatMap((section) => section.fields.map((field) => field.key));

describe('Phase 4 — Select/Autocomplete/Entity-Picker/Tags-Input parity fixes', () => {
  afterEach(() => cleanup());

  it('item 47 (re-verified): Close On Select is removed — not a real Select/Autocomplete prop', () => {
    // Bug found: a prior pass renamed `closeOnSelect` to `shouldCloseOnSelect`, believing that
    // was the real react-stately/HeroUI prop name. Re-checked directly against the installed
    // `@heroui/react/node_modules/react-aria-components` type defs: `shouldCloseOnSelect` only
    // exists on Menu/MenuItem and DatePicker/DateRangePicker — Select.d.ts/Autocomplete.d.ts have
    // no such prop, and HeroUI's AutocompleteRoot/SelectRoot spread straight onto
    // react-aria-components' Select, which always closes its popover on selection with no
    // override. The renamed prop was exactly as inert as the original — removed entirely
    // (Inspector field + all runtime/Export forwarding), matching the allowCustomValue precedent.
    expect(toJsxAttributeName('closeOnSelect')).toBe('closeOnSelect');

    for (const itemId of ['heroui.select', 'heroui.autocomplete', 'heroui.entity-picker'] as const) {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state);
      expect(inspectorKeys(state, nodeId)).not.toContain('closeOnSelect');

      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'closeOnSelect', value: true });
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`${itemId} legacy closeOnSelect prop`, tsx);
      expect(tsx).not.toMatch(/\sshouldCloseOnSelect/);
      expect(tsx).not.toMatch(/\scloseOnSelect=/);
    }

    let selectState = insertItem(createInitialDesignerState(), 'heroui.select');
    const selectId = lastChildId(selectState);
    selectState = designerReducer(selectState, { type: 'set-node-prop', nodeId: selectId, key: 'closeOnSelect', value: true });
    expect(resolveSelectMenuProps(selectState.document.nodes[selectId]!)).not.toHaveProperty('shouldCloseOnSelect');
    expect(resolveSelectMenuProps(selectState.document.nodes[selectId]!)).not.toHaveProperty('closeOnSelect');
  });

  it('item 48: heroui.select Label is visible in Preview and emitted on UiSelect in Export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.select');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'label', value: 'Country' });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('Country')).toBeInTheDocument();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('select label export', tsx);
    expect(tsx).toMatch(/<UiSelect\b[^>]*\slabel="Country"/);
  });

  it('item 49: autocomplete/entity-picker Export render a visible label (UiAutocomplete prop or span)', () => {
    for (const itemId of ['heroui.autocomplete', 'heroui.entity-picker'] as const) {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state);
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'label', value: 'Assignee' });

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`${itemId} label export`, tsx);
      expect(tsx).toContain('Assignee');
      expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\slabel=/);

      if (itemId === 'heroui.autocomplete') {
        expect(tsx).toMatch(/<UiAutocomplete\b[^>]*\slabel="Assignee"/);
        expect(tsx).toContain("from '@/shared/ui/HeroFieldControls'");
      } else {
        expect(tsx).toContain('ps-[4px]');
      }
    }
  });

  it('item 50: select and entity-picker show isInvalid/errorMessage feedback in Preview', () => {
    let selectState = insertItem(createInitialDesignerState(), 'heroui.select');
    const selectId = lastChildId(selectState);
    selectState = designerReducer(selectState, { type: 'set-node-prop', nodeId: selectId, key: 'isInvalid', value: true });
    selectState = designerReducer(selectState, {
      type: 'set-node-prop',
      nodeId: selectId,
      key: 'errorMessage',
      value: 'Pick a value',
    });
    render(<>{renderDesignerDocumentPreview(selectState.document)}</>);
    expect(screen.getByText('Pick a value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Select/i })).toHaveAttribute('aria-invalid', 'true');
    cleanup();

    let pickerState = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const pickerId = lastChildId(pickerState);
    pickerState = designerReducer(pickerState, { type: 'set-node-prop', nodeId: pickerId, key: 'isInvalid', value: true });
    pickerState = designerReducer(pickerState, {
      type: 'set-node-prop',
      nodeId: pickerId,
      key: 'errorMessage',
      value: 'Entity required',
    });
    const pickerTsx = generateDesignerTsx(pickerState.document, pickerState.bindingDefinitions);
    assertValidTsxSyntax('entity-picker validation exclude', pickerTsx);
    expect(pickerTsx).not.toMatch(/<Autocomplete\b[^>]*\serrorMessage=/);
    expect(pickerTsx).not.toMatch(/<Autocomplete\b[^>]*\sisInvalid=/);

    render(<>{renderDesignerDocumentPreview(pickerState.document)}</>);
    expect(screen.getByText('Entity required')).toBeInTheDocument();
  });

  it('item 51: manual Loading flag still applies when no items binding is active', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.autocomplete');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isLoading', value: true });
    expect(resolveAutocompleteMenuProps(state.document.nodes[nodeId]!)).toMatchObject({
      isLoading: true,
      isPending: true,
    });

    render(<>{renderDesignerDocumentPreview(state.document, { interactive: true })}</>);
    const trigger = document.querySelector('[data-slot="autocomplete"] button, [aria-haspopup="listbox"]');
    expect(trigger).toBeTruthy();
  });

  it('item 52: tags-input Export seeds state from a bound value expression', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tags-input');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createPropertyBindingDefinition('value', 'store.filters.tags'),
    });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: 'static-ignored' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('tags-input bound value', tsx);
    expect(tsx).toMatch(/dataContext\?\.store\?\.filters\?\.tags|store\.filters\.tags/);
    expect(tsx).toMatch(/useState<string\[\]>\(\(\) => \{/);
    expect(tsx).not.toContain('static-ignored');
  });

  it('items 46/90: entity-picker returnField/displayField wired into helper + hook call', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const nodeId = lastChildId(state);
    expect(inspectorKeys(state, nodeId)).toEqual(expect.arrayContaining(['returnField', 'displayField']));

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'returnField', value: 'code' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'displayField', value: 'title' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('entity-picker field remap', tsx);
    expect(tsx).toContain('returnField: "code"');
    expect(tsx).toContain('displayField: "title"');
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\sreturnField=/);
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\sdisplayField=/);

    const helperSource = renderEntityPickerRuntimeHelper().join('\n');
    expect(helperSource).toContain('mapping?.returnField');
    expect(helperSource).toContain('mapping?.displayField');
    expect(helperSource).toContain('record[returnField]');
    expect(helperSource).toContain('record[displayField]');
  });

  it('items 31/32/92 Option A: honest Select placeholders; allowCustomValue removed', () => {
    let autocompleteState = insertItem(createInitialDesignerState(), 'heroui.autocomplete');
    const autocompleteId = lastChildId(autocompleteState);
    expect(inspectorKeys(autocompleteState, autocompleteId)).not.toContain('allowCustomValue');
    expect(autocompleteState.document.nodes[autocompleteId]!.props.placeholder).toBe('Select…');

    const autocompleteTsx = generateDesignerTsx(autocompleteState.document, autocompleteState.bindingDefinitions);
    expect(autocompleteTsx).toContain('placeholder="Select…"');
    expect(autocompleteTsx).not.toMatch(/allowCustomValue/);
    expect(autocompleteTsx).toContain('UiAutocomplete');
    expect(autocompleteTsx).toMatch(/items=\{\[/);

    let pickerState = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const pickerId = lastChildId(pickerState);
    expect(pickerState.document.nodes[pickerId]!.props.placeholder).toBe('Select entity…');
    const pickerTsx = generateDesignerTsx(pickerState.document, pickerState.bindingDefinitions);
    expect(pickerTsx).toContain('placeholder="Select entity…"');
    expect(pickerTsx).toContain('useEntityPickerOptions(');
  });
});
