import { describe, expect, it } from 'vitest';
import {
  collectInspectorSearchEntries,
  inspectorFieldMatchesSearch,
  resolveInspectorFieldSearch,
} from '../inspectorFieldSearch';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
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

describe('T1-11b inspector field search', () => {
  it('matches Placeholder by partial label query', () => {
    expect(inspectorFieldMatchesSearch(
      { key: 'placeholder', label: 'Placeholder', type: 'string', group: 'heroui' },
      'place',
    )).toBe(true);
    expect(inspectorFieldMatchesSearch(
      { key: 'placeholder', label: 'Placeholder', type: 'string', group: 'heroui' },
      'placeholder',
    )).toBe(true);
    expect(inspectorFieldMatchesSearch(
      { key: 'label', label: 'Label', type: 'string', group: 'heroui' },
      'placeholder',
    )).toBe(false);
  });

  it('finds placeholder on Text Input and keeps it in the Content tier', () => {
    let state = createInitialDesignerState();
    state = insertPaletteItem(state, 'heroui.input-text');
    const node = getLastInsertedNode(state);
    const sections = resolveInspectorFieldSections(node);
    const entries = collectInspectorSearchEntries(sections, node);
    const result = resolveInspectorFieldSearch(entries, 'placeholder');

    expect(result.matchedKeys).toContain('placeholder');
    expect(result.firstMatchKey).toBe('placeholder');
    expect(result.tiersToOpen.has('content')).toBe(true);
    expect(result.tiersToOpen.has('advanced')).toBe(false);
  });

  it('opens Advanced temporarily when querying a closed-tier field like Pattern', () => {
    let state = createInitialDesignerState();
    state = insertPaletteItem(state, 'heroui.input-text');
    const node = getLastInsertedNode(state);
    const sections = resolveInspectorFieldSections(node);
    const entries = collectInspectorSearchEntries(sections, node);
    const result = resolveInspectorFieldSearch(entries, 'pattern');

    expect(result.matchedKeys).toContain('pattern');
    expect(result.tiersToOpen.has('advanced')).toBe(true);
  });

  it('opens Behavior when querying an event name', () => {
    let state = createInitialDesignerState();
    state = insertPaletteItem(state, 'heroui.input-text');
    const node = getLastInsertedNode(state);
    const sections = resolveInspectorFieldSections(node);
    const entries = collectInspectorSearchEntries(sections, node);
    const result = resolveInspectorFieldSearch(entries, 'onChange');

    expect(result.matchedKeys).toContain('event:onChange');
    expect(result.tiersToOpen.has('behavior')).toBe(true);
  });
});
