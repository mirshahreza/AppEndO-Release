import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const fieldKeysFor = (state: DesignerState, nodeId: string): Set<string> =>
  new Set(resolveInspectorFieldSections(state.document.nodes[nodeId]).flatMap((s) => s.fields.map((f) => f.key)));

describe('HeroUI Navigation & Overlays — dead-field cleanup and confirmed bugs', () => {
  it('heroui.dropdown: isDisabled is applied to the exported Trigger (the real button), not the inert root MenuTrigger', async () => {
    let state = insert(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChild(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isDisabled', value: true });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('heroui.dropdown disabled', tsx);
    expect(tsx).toMatch(/<Dropdown\.Trigger\s+isDisabled/);
    expect(tsx).not.toMatch(/<Dropdown\s+isDisabled/);
  });

  it('heroui.drawer: exposes a real, working Placement field instead of the dead Size field', () => {
    const state = insert(createInitialDesignerState(), 'heroui.drawer');
    const nodeId = lastChild(state);
    const keys = fieldKeysFor(state, nodeId);
    expect(keys.has('placement'), 'heroui.drawer should expose Placement').toBe(true);
    expect(keys.has('size'), 'heroui.drawer should no longer expose the dead Size field').toBe(false);
  });

  it('heroui.drawer: a chosen placement is emitted as a real placement prop on Drawer.Content in exported TSX', async () => {
    let state = insert(createInitialDesignerState(), 'heroui.drawer');
    const nodeId = lastChild(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'placement', value: 'left' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('heroui.drawer placement', tsx);
    expect(tsx).toMatch(/<Drawer\.Content[^>]*\splacement="left"/);
  });

  it('heroui.modal / heroui.alert-dialog: no longer offer the dead xl/2xl/3xl/4xl/5xl size options', () => {
    for (const itemId of ['heroui.modal', 'heroui.alert-dialog']) {
      const state = insert(createInitialDesignerState(), itemId);
      const nodeId = lastChild(state);
      const sizeField = resolveInspectorFieldSections(state.document.nodes[nodeId])
        .flatMap((s) => s.fields)
        .find((f) => f.key === 'size');
      expect(sizeField, `${itemId} should still expose a Size field`).toBeTruthy();
      const values = (sizeField?.options ?? []).map((o) => o.value);
      expect(values).toEqual(['xs', 'sm', 'md', 'lg', 'full']);
    }
  });

  it.each(['heroui.tabs', 'heroui.breadcrumbs', 'heroui.toolbar', 'heroui.field-container', 'heroui.dropdown'] as const)(
    '%s no longer exposes the dead Size field',
    (itemId) => {
      const state = insert(createInitialDesignerState(), itemId);
      const nodeId = lastChild(state);
      const keys = fieldKeysFor(state, nodeId);
      expect(keys.has('size')).toBe(false);
    },
  );

  it('heroui.dropdown: never emits a size attribute on the real <Dropdown> (no size variant exists on the real component)', async () => {
    let state = insert(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChild(state);
    // Simulate a pre-existing document saved before the Size field was removed.
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: 'lg' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('heroui.dropdown leftover size prop', tsx);
    expect(tsx).not.toMatch(/<Dropdown\b[^>]*\ssize=/);
  });

  it('heroui.breadcrumbs: never emits a size attribute on the real <Breadcrumbs> (no size variant; leftover from incomplete field removal)', async () => {
    // Parity audit item 67: Size was removed from Inspector but codegen still injected size="md".
    let state = insert(createInitialDesignerState(), 'heroui.breadcrumbs');
    const nodeId = lastChild(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: 'lg' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('heroui.breadcrumbs leftover size prop', tsx);
    expect(tsx).not.toMatch(/<Breadcrumbs\b[^>]*\ssize=/);
  });
});
