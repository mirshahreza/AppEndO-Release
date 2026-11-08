import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { GRID_LIST_RESOURCE_BINDING_KEY, createGridListResourceBindingDefinition } from '../bindingGridEngine';
import { serializeDesignerDataGridColumns, type DesignerDataGridColumn } from '../designerDataGridColumns';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 12): `heroui.data-grid`/`heroui.table` share
 * `renderDataGridCustomJsx` (tsxPhase2Palette.ts), which never read `isLoading`/`emptyContent`/
 * `errorContent`/`isHeaderSticky` at all — all four are real, working Inspector fields in the
 * live canvas/interactive Preview (DesignerRuntimeDataGrid.tsx shows a loading placeholder, an
 * inline empty row, an error panel, and a max-height/scroll style for sticky headers
 * respectively) — and since none were excluded from the generic attrs pass, they leaked onto the
 * real `<Table>` root as unknown, untyped JSX attributes the component doesn't declare.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const TEST_COLUMNS: DesignerDataGridColumn[] = [
  { key: 'name', label: 'Name', sort: true, filter: true, filterType: 'text' },
  { key: 'email', label: 'Email' },
];

const buildBoundGridState = (): { state: DesignerState; gridNodeId: string } => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'contacts',
    dataSource: {
      id: 'contacts',
      name: 'Contacts',
      endpoint: '/api/contacts',
      fields: ['id', 'name', 'email'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/contacts' } },
    },
  });

  state = insertItem(state, 'heroui.data-grid');
  const gridNodeId = lastChildId(state);
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: gridNodeId,
    key: 'columns',
    value: serializeDesignerDataGridColumns(TEST_COLUMNS),
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: gridNodeId,
    bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
    definition: createGridListResourceBindingDefinition('contacts'),
  });

  return { state, gridNodeId };
};

describe('heroui.data-grid loading/empty/error/sticky export fix (parity audit item 12)', () => {
  it('shows a loading placeholder and no Table at all when isLoading is set', () => {
    const { state: initial, gridNodeId } = buildBoundGridState();
    const state = designerReducer(initial, { type: 'set-node-prop', nodeId: gridNodeId, key: 'isLoading', value: true });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('data-grid isLoading', tsx);

    expect(tsx).toContain('Loading records…');
    expect(tsx).not.toContain('<Table ');
    expect(tsx).not.toMatch(/\sisLoading=/);
  });

  it('shows the configured error content instead of the Table when the bound fetch errors', () => {
    const { state, gridNodeId } = buildBoundGridState();
    const withError = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'errorContent',
      value: 'Could not reach the contacts API',
    });

    const tsx = generateDesignerTsx(withError.document, withError.bindingDefinitions);
    assertValidTsxSyntax('data-grid errorContent', tsx);

    expect(tsx).toMatch(/Boolean\(error_gridData_\w+\) \? \(<div[^>]*>Could not reach the contacts API<\/div>\) : \(<Table\b/);
    expect(tsx).not.toMatch(/\serrorContent=/);
  });

  it('renders the configured empty message as an inline row when the bound rows array is empty', () => {
    const { state, gridNodeId } = buildBoundGridState();
    const withEmpty = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'emptyContent',
      value: 'No contacts yet',
    });

    const tsx = generateDesignerTsx(withEmpty.document, withEmpty.bindingDefinitions);
    assertValidTsxSyntax('data-grid emptyContent', tsx);

    expect(tsx).toMatch(/\)\.length === 0 \? \(<Table\.Body>.*No contacts yet/);
    expect(tsx).not.toMatch(/\semptyContent=/);
  });

  it('applies a max-height scroll style to the ScrollContainer when isHeaderSticky is set', () => {
    const { state, gridNodeId } = buildBoundGridState();
    const withSticky = designerReducer(state, { type: 'set-node-prop', nodeId: gridNodeId, key: 'isHeaderSticky', value: true });

    const tsx = generateDesignerTsx(withSticky.document, withSticky.bindingDefinitions);
    assertValidTsxSyntax('data-grid isHeaderSticky', tsx);

    expect(tsx).toMatch(/<Table\.ScrollContainer style=\{\{ maxHeight: "20rem", overflowY: "auto" \}\}>/);
    expect(tsx).not.toMatch(/\sisHeaderSticky=/);
  });

  it('renders the plain Table with no wrapper/leak when none of the four fields are set', () => {
    const { state } = buildBoundGridState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('data-grid defaults', tsx);

    expect(tsx).toContain('<Table ');
    expect(tsx).not.toContain('Loading records…');
    expect(tsx).not.toMatch(/\sisLoading=|\semptyContent=|\serrorContent=|\sisHeaderSticky=/);
  });

  it('heroui.table shares the same fix (same underlying codegen function)', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'heroui.table');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isLoading', value: true });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('heroui.table isLoading', tsx);
    expect(tsx).toContain('Loading records…');
  });
});
