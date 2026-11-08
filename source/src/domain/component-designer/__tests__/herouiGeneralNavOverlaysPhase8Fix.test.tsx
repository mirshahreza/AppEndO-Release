/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit items 65–69, 94–96 — Phase 8 HeroUI General + Navigation/Overlays):
 * - 65: bound leftover `fallbackSrc` leaked on exported `<Avatar>` (Avatar.Image has no such prop).
 * - 66: typography-lead Color Inspector field was fully dead (raw `<p>`, not Typography).
 * - 67: breadcrumbs still injected dead `size="md"` after Size field removal.
 * - 68: dropdown Label binding worked in Export only — Canvas/Preview ignored resolveTextProp.
 * - 69: listbox Selected Keys binding dead in Preview and Export (static CSV only).
 * - 94/95: leftover bound `color` on buttons / `ariaLabel` on tooltip-trigger could leak in Export.
 * - 96: dead `renderEntityPickerSearchHandlerLines` duplicated inline in bindingCodegen — consolidated.
 * Fixed in tsxNodeRenderer / DesignerRuntime* / inspectorPaletteFields / bindingCodegen /
 * bindingEntityPickerCodegen / tsxParityPalette / DesignerRuntimeParityPalette / catalog.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { renderEntityPickerSearchHandlerLines } from '../bindingEntityPickerCodegen';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const fieldKeysFor = (state: DesignerState, nodeId: string): Set<string> =>
  new Set(resolveInspectorFieldSections(state.document.nodes[nodeId]).flatMap((s) => s.fields.map((f) => f.key)));

const bindStoreProp = (state: DesignerState, nodeId: string, prop: string, storePath: string): DesignerState => {
  const binding = createStoreReadBindingDefinition(prop, storePath);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

const bindPropertyProp = (state: DesignerState, nodeId: string, prop: string, dataPath: string): DesignerState =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp(prop),
    definition: createPropertyBindingDefinition(prop, dataPath),
  });

afterEach(() => cleanup());

describe('Phase 8 — HeroUI General + Navigation/Overlays (parity audit 65–69, 94–96)', () => {
  it('item 66: heroui.typography-lead no longer exposes Color, and leftover color never leaks in Export', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.typography-lead');
    const nodeId = lastChildId(state);
    expect(fieldKeysFor(state, nodeId).has('color')).toBe(false);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'color', value: 'danger' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('typography-lead leftover color', tsx);
    expect(tsx).not.toMatch(/\scolor=/);
  });

  it('item 67: heroui.breadcrumbs never emits size= (no size variant; field removed)', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.breadcrumbs');
    const nodeId = lastChildId(state);
    expect(fieldKeysFor(state, nodeId).has('size')).toBe(false);

    // Simulate a pre-existing document saved before Size was removed.
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: 'lg' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('breadcrumbs leftover size', tsx);
    expect(tsx).not.toMatch(/<Breadcrumbs\b[^>]*\ssize=/);
  });

  it('item 68: dropdown Label Property Binding resolves in interactive Preview (not only Export)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'label', value: 'Static Actions' });
    state = bindStoreProp(state, nodeId, 'label', 'menu.triggerLabel');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { menu: { triggerLabel: 'Live Bound Menu' } },
        })}
      </>,
    );

    expect(container.textContent).toContain('Live Bound Menu');
    expect(container.textContent).not.toContain('Static Actions');
  });

  it('item 69: listbox Selected Keys binding seeds selection in Preview and Export', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.listbox');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'alpha', textValue: 'Alpha' },
        { id: 'beta', textValue: 'Beta' },
      ]),
    });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'selectedKeys', value: 'alpha' });
    state = bindStoreProp(state, nodeId, 'selectedKeys', 'picker.selected');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { picker: { selected: 'beta' } },
        })}
      </>,
    );

    const selected = container.querySelector('[role="option"][aria-selected="true"]');
    expect(selected?.textContent).toBe('Beta');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('listbox bound selectedKeys', tsx);
    expect(tsx).toContain("defaultSelectedKeys={String(designerStore?.picker?.selected ?? '').split(',').map((key) => key.trim()).filter((key) => key.length > 0)}");
    expect(tsx).not.toMatch(/\sselectedKeys=\{/);
  });

  it('item 94: bound leftover color on button-solid/outline never leaks in Export', async () => {
    for (const itemId of ['heroui.button-solid', 'heroui.button-outline'] as const) {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state);
      state = bindPropertyProp(state, nodeId, 'color', 'theme.accent');
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      await assertValidTsxSyntax(`${itemId} bound color stripped`, tsx);
      expect(tsx).not.toMatch(/\scolor=/);
    }
  });

  it('item 95: bound leftover ariaLabel on tooltip-trigger never leaks onto Tooltip.Root', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const nodeId = lastChildId(state);
    state = bindPropertyProp(state, nodeId, 'ariaLabel', 'a11y.tip');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('tooltip-trigger bound ariaLabel stripped', tsx);
    expect(tsx).not.toMatch(/aria-label=\{/);
    expect(tsx).not.toMatch(/\sariaLabel=/);
  });

  it('item 96: renderEntityPickerSearchHandlerLines is the shared Export search-handler source', () => {
    const lines = renderEntityPickerSearchHandlerLines({
      nodeId: 'node-abc',
      entityRef: 'users',
      searchParam: 'q',
      returnField: 'id',
      displayField: 'name',
      itemsVar: 'entityPickerItems_node_abc',
      loadingVar: 'entityPickerLoading_node_abc',
      loadOptionsVar: 'loadEntityPickerOptions_node_abc',
    });
    expect(lines.join('\n')).toContain('handleEntitySearch_node_abc');
    expect(lines.join('\n')).toContain('loadEntityPickerOptions_node_abc');

    let state = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'entityRef', value: 'users' });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toMatch(/handleEntitySearch_/);
    expect(tsx).toMatch(/loadEntityPickerOptions_/);
  });
});
