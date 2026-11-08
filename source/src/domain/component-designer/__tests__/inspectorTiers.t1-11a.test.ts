import { describe, expect, it } from 'vitest';
import {
  countDefaultVisibleInspectorFields,
  resolveInspectorFieldSections,
} from '../inspectorRegistry';
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

describe('T1-11a inspector progressive disclosure skeleton', () => {
  it('remaps Text Input fields into Content / Style / Advanced tiers', () => {
    let state = createInitialDesignerState();
    state = insertPaletteItem(state, 'heroui.input-text');
    const node = getLastInsertedNode(state);
    const sections = resolveInspectorFieldSections(node);
    const ids = sections.map((section) => section.id);

    expect(ids).toEqual(['content', 'style', 'advanced']);

    const contentKeys = sections.find((section) => section.id === 'content')?.fields.map((field) => field.key) ?? [];
    expect(contentKeys).toEqual(expect.arrayContaining(['label', 'hint', 'placeholder', 'value', 'type']));
    expect(contentKeys).not.toEqual(expect.arrayContaining(['pattern', 'validationRule', 'htmlExtraAttrs']));

    const styleKeys = sections.find((section) => section.id === 'style')?.fields.map((field) => field.key) ?? [];
    expect(styleKeys).toEqual(expect.arrayContaining(['className', 'style', 'twDisplay', 'twPadding']));
    expect(styleKeys.indexOf('className')).toBeLessThan(styleKeys.indexOf('style'));

    const advancedKeys = sections.find((section) => section.id === 'advanced')?.fields.map((field) => field.key) ?? [];
    expect(advancedKeys).toEqual(expect.arrayContaining(['pattern', 'validationRule', 'htmlExtraAttrs', 'ariaLabel']));
    expect(advancedKeys).not.toEqual(expect.arrayContaining(['style', 'className']));
  });

  it('exposes all Content and Style fields without a within-section More disclosure', () => {
    let state = createInitialDesignerState();
    state = insertPaletteItem(state, 'heroui.input-text');
    const node = getLastInsertedNode(state);

    const visible = countDefaultVisibleInspectorFields(node);
    const sections = resolveInspectorFieldSections(node);
    const expected = sections
      .filter((section) => section.id === 'content' || section.id === 'style')
      .reduce((sum, section) => sum + section.fields.length, 0);

    expect(visible).toBe(expected);
    expect(visible).toBeGreaterThanOrEqual(8);
  });
});
