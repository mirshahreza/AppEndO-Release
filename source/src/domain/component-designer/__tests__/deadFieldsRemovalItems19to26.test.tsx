/**
 * @vitest-environment jsdom
 *
 * Parity audit items 19-26 — remove Inspector fields confirmed (against real `@heroui/react` /
 * `@heroui/styles` type defs and variant definitions, and against Preview/Export code that never
 * read them) to have zero functional effect anywhere, rather than leaving them decorative.
 * Verified directly against `node_modules/@heroui/react`/`@heroui/styles` before removal — see
 * inline comments at each removal site in `inspectorPaletteFields.ts` for the exact evidence.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] => {
  const node = state.document.nodes[nodeId];
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

describe('parity audit items 19-26: dead Inspector fields removed', () => {
  afterEach(() => cleanup());

  it('item 19: heroui.button-solid/outline no longer expose Color, and no leaked color= attribute in export', () => {
    for (const paletteId of ['heroui.button-solid', 'heroui.button-outline'] as const) {
      let state = insertItem(createInitialDesignerState(), paletteId);
      const nodeId = lastChildId(state);
      expect(collectInspectorFieldKeys(state, nodeId)).not.toContain('color');

      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'color', value: 'accent' });
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`${paletteId} legacy color prop`, tsx);
      expect(tsx).not.toMatch(/\scolor=/);
    }
  });

  it('item 20: heroui.link no longer exposes Size or Color, and neither leaks in export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.link');
    const nodeId = lastChildId(state);
    expect(collectInspectorFieldKeys(state, nodeId)).not.toContain('size');
    expect(collectInspectorFieldKeys(state, nodeId)).not.toContain('color');

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: 'lg' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'color', value: 'primary' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('heroui.link legacy size/color props', tsx);
    expect(tsx).not.toMatch(/\ssize=/);
    expect(tsx).not.toMatch(/\scolor=/);
  });

  it('item 21: heroui.avatar no longer exposes Fallback Source, and it never leaks onto Avatar.Image', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const nodeId = lastChildId(state);
    expect(collectInspectorFieldKeys(state, nodeId)).not.toContain('fallbackSrc');

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'src', value: '/photo.png' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'fallbackSrc', value: '/legacy-fallback.png' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('heroui.avatar legacy fallbackSrc prop', tsx);
    expect(tsx).not.toMatch(/\sfallbackSrc=/);

    // Bug found (parity audit item 21, follow-up): a leftover fallbackSrc value on an older saved
    // document also reached React.createElement via the generic library-component passthrough
    // mechanism (independent of the specific Avatar.Image fix), spreading onto the real
    // component and triggering "React does not recognize the fallbackSrc prop" in the console —
    // proof the value was truly inert, not just hidden from the exported source text. Fixed by
    // adding `fallbackSrc` to LIBRARY_BLOCKED_PASSTHROUGH_KEYS (runtimeNodeProps.ts).
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('fallbackSrc');
    consoleError.mockRestore();
  });

  it('item 22: heroui.skeleton replaces isLoaded with the real animationType prop, in both paths', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.skeleton');
    const nodeId = lastChildId(state);
    const keys = collectInspectorFieldKeys(state, nodeId);
    expect(keys).not.toContain('isLoaded');
    expect(keys).toContain('animationType');

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'animationType', value: 'pulse' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('heroui.skeleton animationType', tsx);
    expect(tsx).toMatch(/animationType="pulse"/);
    expect(tsx).not.toMatch(/\sisLoaded=/);
  });

  it('item 23: heroui.tooltip-trigger no longer exposes the redundant per-item Aria Label field, and it never leaks onto Tooltip.Root', () => {
    // Note: a *generic* `ariaLabel` field exists in the global "Advanced" section for every
    // element (accessibility escape hatch, out of this audit item's scope) — this test targets
    // only the redundant, non-functional per-item "heroui" group field that duplicated it and,
    // regardless of which UI path set the value, that it never reaches the real Tooltip.Root.
    let state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const nodeId = lastChildId(state);
    const heroUiGroupKeys = resolveInspectorFieldSections(state.document.nodes[nodeId])
      .filter((section) => section.fields.some((f) => f.group === 'heroui'))
      .flatMap((section) => section.fields.filter((f) => f.group === 'heroui').map((f) => f.key));
    expect(heroUiGroupKeys).not.toContain('ariaLabel');

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'ariaLabel', value: 'legacy label' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('heroui.tooltip-trigger legacy ariaLabel prop', tsx);
    expect(tsx).not.toMatch(/<Tooltip\.Root[^>]*\sariaLabel=/);
  });

  it('item 24: heroui.dropdown bound Label renders as trigger text with no duplicate attribute in export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('label'),
      definition: createPropertyBindingDefinition('label', 'menu.title'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('heroui.dropdown bound label', tsx);
    expect(tsx).not.toMatch(/<Dropdown\b[^>]*\slabel=/);
    expect(tsx).toContain('<Dropdown.Trigger>{dataContext?.menu?.title ?? "Actions"}</Dropdown.Trigger>');
  });

  it('item 25: heroui.listbox no longer exposes Size, and it never leaks onto the real ListBox', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.listbox');
    const nodeId = lastChildId(state);
    expect(collectInspectorFieldKeys(state, nodeId)).not.toContain('size');

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: 'lg' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('heroui.listbox legacy size prop', tsx);
    expect(tsx).not.toMatch(/<ListBox\b[^>]*\ssize=/);
  });

  it('item 26: layout.split-pane no longer exposes Disabled, and it never leaks onto the wrapper div', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.split-pane');
    const nodeId = lastChildId(state);
    expect(collectInspectorFieldKeys(state, nodeId)).not.toContain('isDisabled');

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isDisabled', value: true });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('layout.split-pane legacy isDisabled prop', tsx);
    expect(tsx).not.toMatch(/\sisDisabled=|\sdisabled=/);
  });
});
