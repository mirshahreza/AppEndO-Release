import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { serializeDesignerGridToolbarConfig } from '../designerGridToolbarConfig';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 14): the live canvas/interactive Preview
 * (DesignerRuntimeAppTableGrid.tsx) debounces the toolbar search box (default 300ms,
 * configurable via the "Connect to API" wizard's `debounceMs`) before syncing it to the store —
 * since a server-mode grid's fetch URL is derived directly from that store value, an undebounced
 * patch means one network request per keystroke. Export's generated `handleGridSearchChange`
 * patched the store immediately on every keystroke with zero debounce.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('app-table-grid toolbar search debounce export fix (parity audit item 14)', () => {
  it('wraps the store patch in a debounced setTimeout using the default 300ms delay', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'toolbarConfig',
      value: serializeDesignerGridToolbarConfig({ enabled: true, search: { enabled: true, storePath: 'gridToolbar.search' } }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app-table-grid with debounced search (default)', tsx);

    expect(tsx).toMatch(/const searchDebounceTimer_\w+ = React\.useRef<ReturnType<typeof setTimeout> \| null>\(null\);/);
    expect(tsx).toMatch(/searchDebounceTimer_\w+\.current = setTimeout\(\(\) => \{[\s\S]*?patchDesignerStore\("gridToolbar\.search", nextValue\);[\s\S]*?\}, 300\);/);
    // setSearchInput must still run synchronously (immediate), only the store patch is delayed.
    expect(tsx).toMatch(/setGridSearchInput_\w+\(nextValue\);\s*if \(searchDebounceTimer_\w+\.current\)/);
    // Phase 3: debounced search also resets page + drives client-fallback filter state.
    expect(tsx).toMatch(/setGridDebouncedSearch_\w+\(nextValue\);/);
    expect(tsx).toMatch(/setGridPage_\w+\(1\);/);
  });

  it('honors a custom debounceMs configured in the wizard', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'toolbarConfig',
      value: serializeDesignerGridToolbarConfig({ enabled: true, search: { enabled: true, storePath: 'gridToolbar.search', debounceMs: 750 } }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app-table-grid with custom debounceMs', tsx);

    expect(tsx).toMatch(/\}, 750\);/);
  });

  it('clears the previous timer before scheduling a new one (real debounce, not just a delay)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'toolbarConfig',
      value: serializeDesignerGridToolbarConfig({ enabled: true, search: { enabled: true, storePath: 'gridToolbar.search' } }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toMatch(/if \(searchDebounceTimer_\w+\.current\) \{\s*clearTimeout\(searchDebounceTimer_\w+\.current\);\s*\}/);
  });
});
