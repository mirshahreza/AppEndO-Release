import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { serializeDesignerDataGridColumns, type DesignerDataGridColumn } from '../designerDataGridColumns';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 13): the live canvas/interactive Preview
 * (DesignerRuntimeAppTableGrid.tsx) seeds the App Table Grid's initial sort state from the
 * Inspector's "Default Sort Field" (`defaultSortBy`, falling back to the first configured sort
 * option, then the first column, then "id"), but the exported state hook
 * (`renderAppTableGridStateHookLines`, bindingCodegen.ts) always started from a bare
 * `EMPTY_GRID_QUERY` (sort: null) with no reference to `defaultSortBy` anywhere — a published
 * grid always opened unsorted regardless of the configured default.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const TEST_COLUMNS: DesignerDataGridColumn[] = [
  { key: 'name', label: 'Name', sort: true },
  { key: 'createdAt', label: 'Created', sort: true },
];

describe('app-table-grid defaultSortBy export fix (parity audit item 13)', () => {
  it('exports an initial query state seeded from the configured defaultSortBy', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'columns', value: serializeDesignerDataGridColumns(TEST_COLUMNS) });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'defaultSortBy', value: 'createdAt' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app-table-grid with defaultSortBy', tsx);

    expect(tsx).toMatch(/React\.useState<GridQueryState>\(\(\) => \(\{ \.\.\.EMPTY_GRID_QUERY, sort: \{ columnId: "createdAt", direction: 'asc' \} \}\)\)/);
    expect(tsx).not.toMatch(/\sdefaultSortBy=/);
  });

  it('falls back to the first configured sort option when defaultSortBy is explicitly cleared', () => {
    // The palette seeds `defaultSortBy: 'created_at'` on every new node, so the fallback chain
    // is only reachable once the author explicitly clears the field (readString treats '' as
    // unset) — matches exactly how DesignerRuntimeAppTableGrid.tsx's own readString call behaves.
    let state = insertItem(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'columns', value: serializeDesignerDataGridColumns(TEST_COLUMNS) });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'defaultSortBy', value: '' });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'sortOptions',
      value: JSON.stringify([{ value: 'name', label: 'Name' }, { value: 'createdAt', label: 'Created' }]),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app-table-grid with sortOptions fallback', tsx);

    expect(tsx).toMatch(/sort: \{ columnId: "name", direction: 'asc' \}/);
  });

  it('uses the palette default (created_at) when the grid is freshly inserted and untouched', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'columns', value: serializeDesignerDataGridColumns(TEST_COLUMNS) });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app-table-grid with palette default sort', tsx);

    expect(tsx).toMatch(/React\.useState<GridQueryState>\(\(\) => \(\{ \.\.\.EMPTY_GRID_QUERY, sort: \{ columnId: "created_at", direction: 'asc' \} \}\)\)/);
  });
});
