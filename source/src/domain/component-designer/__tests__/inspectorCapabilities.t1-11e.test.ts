import { describe, expect, it } from 'vitest';
import {
  getPaletteItemById,
  nodeHasCapability,
  resolveNodeCapabilities,
  resolveNodeClass,
} from '../catalog';
import { isDataRegionEligibleContainer } from '../bindingRegionEngine';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS } from '../paletteCapabilities';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const insertPaletteItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const getLastInsertedNode = (state: DesignerState) => {
  const root = state.document.nodes[state.document.rootNodeId];
  const nodeId = root.children[root.children.length - 1] as string;
  return state.document.nodes[nodeId];
};

const collectInspectorFieldKeys = (itemId: string): string[] => {
  let state = createInitialDesignerState();
  state = insertPaletteItem(state, itemId);
  const node = getLastInsertedNode(state);
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

const NOISY_STRUCTURAL_IDS = [
  'layout.aspect-ratio',
  'layout.overlay',
  'logic.visibility-container',
] as const;

describe('T1-11e inspector capability system', () => {
  it('attaches capabilities and derived nodeClass to every catalog item', () => {
    const flex = getPaletteItemById('layout.flex-row');
    expect(flex?.capabilities).toEqual(expect.arrayContaining(['container', 'bindable']));
    expect(flex?.nodeClass).toBe('container');

    const input = getPaletteItemById('heroui.input-text');
    expect(input?.capabilities).toEqual(expect.arrayContaining(['leaf-content', 'bindable']));
    expect(input?.nodeClass).toBe('form-input');
  });

  it.each(NOISY_STRUCTURAL_IDS)(
    'hides unrelated container Layout fields for %s',
    (itemId) => {
      const item = getPaletteItemById(itemId);
      expect(item).toBeTruthy();
      expect(item!.capabilities ?? []).not.toContain('container');

      let state = createInitialDesignerState();
      state = insertPaletteItem(state, itemId);
      const node = getLastInsertedNode(state);

      expect(nodeHasCapability(node, 'container')).toBe(false);
      expect(isDataRegionEligibleContainer(node)).toBe(false);

      const keys = collectInspectorFieldKeys(itemId);
      for (const layoutKey of INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS) {
        expect(keys).not.toContain(layoutKey);
      }
    },
  );

  it('logic.repeater keeps multi-capability Layout + Data surfaces', () => {
    const item = getPaletteItemById('logic.repeater');
    expect(item?.capabilities).toEqual(
      expect.arrayContaining(['container', 'repeatable', 'bindable']),
    );
    expect(item?.nodeClass).toBe('container');

    let state = createInitialDesignerState();
    state = insertPaletteItem(state, 'logic.repeater');
    const node = getLastInsertedNode(state);

    expect(resolveNodeCapabilities(node)).toEqual(
      expect.arrayContaining(['container', 'repeatable', 'bindable']),
    );
    expect(resolveNodeClass(node)).toBe('container');
    expect(nodeHasCapability(node, 'container')).toBe(true);
    expect(nodeHasCapability(node, 'bindable')).toBe(true);
    expect(nodeHasCapability(node, 'repeatable')).toBe(true);

    const keys = collectInspectorFieldKeys('logic.repeater');
    // Layout (container) + Data path (bindable content)
    expect(keys).toContain('twFlexDirection');
    expect(keys).toContain('twGap');
    expect(keys).toContain('dataPath');
    expect(keys).toContain('itemAlias');
  });

  it('tags the three noise cases with non-container capabilities', () => {
    expect(getPaletteItemById('layout.aspect-ratio')?.capabilities).toEqual(['resizable']);
    expect(getPaletteItemById('layout.overlay')?.capabilities).toEqual(['overlay']);
    expect(getPaletteItemById('logic.visibility-container')?.capabilities).toEqual([]);
  });
});
