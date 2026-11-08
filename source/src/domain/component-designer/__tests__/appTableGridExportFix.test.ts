import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { GRID_LIST_RESOURCE_BINDING_KEY, createGridListResourceBindingDefinition } from '../bindingGridEngine';
import { serializeDesignerDataGridColumns, type DesignerDataGridColumn } from '../designerDataGridColumns';
import type { DesignerState } from '../types';

/**
 * Group F (parity-audit fix): the exported App Table Grid never passed real `columns`/`rows`/
 * `getRowKey` to the real `<AppTableGrid>` component (only an inert `columnsMeta` JSON string —
 * not a real prop), the footer's pagination/sort controls were 100% hardcoded/non-functional,
 * rich cells/action columns/disable rules had zero codegen representation, and any `open-modal`
 * row action caused a compile crash (`onGridRowAction` referenced an undeclared handler). This
 * suite proves the exported code now: compiles, renders real data through the real column
 * builder, wires a real per-action row-action dispatcher, and drives a genuinely interactive
 * footer from real state instead of literals.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const TEST_COLUMNS: DesignerDataGridColumn[] = [
  {
    key: 'email',
    label: 'Email',
    cellKind: 'account',
    cellFields: { primaryField: 'email', secondaryField: 'username' },
    sort: true,
    filter: true,
    filterType: 'text',
  },
  {
    key: 'locked',
    label: 'Lock Status',
    cellKind: 'lock-status',
    filter: true,
    filterType: 'boolean',
  },
  {
    key: 'actions',
    label: '',
    kind: 'action-group',
    actions: [
      {
        actionId: 'edit',
        icon: 'Pencil',
        intent: 'edit',
        tooltip: 'Edit',
        behavior: { kind: 'open-modal', modalNodeId: '', primaryKeyField: 'id', selectionStorePath: 'selection.id' },
        disabledWhen: { preset: 'builtin-field', field: 'is_builtin' },
      },
      {
        actionId: 'delete',
        icon: 'Trash2',
        intent: 'delete',
        tooltip: 'Delete',
        behavior: { kind: 'open-modal', modalNodeId: '', primaryKeyField: 'id', selectionStorePath: 'selection.id' },
        disabledWhen: { preset: 'has-role', role: 'ADMIN' },
      },
    ],
  },
];

const buildGridState = (): { state: DesignerState; gridNodeId: string; editModalId: string; deleteModalId: string } => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'users',
    dataSource: {
      id: 'users',
      name: 'Users',
      endpoint: '/api/users',
      fields: ['id', 'email', 'username', 'locked', 'is_builtin', 'roles'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/users' } },
    },
  });

  state = insertItem(state, 'heroui.modal');
  const editModalId = lastChildId(state);
  state = insertItem(state, 'heroui.modal');
  const deleteModalId = lastChildId(state);

  const columns: DesignerDataGridColumn[] = TEST_COLUMNS.map((column) => {
    if (column.kind !== 'action-group') {
      return column;
    }
    return {
      ...column,
      actions: column.actions?.map((action) => ({
        ...action,
        behavior: action.behavior
          ? { ...action.behavior, modalNodeId: action.actionId === 'edit' ? editModalId : deleteModalId }
          : undefined,
      })),
    };
  });

  state = insertItem(state, 'heroui.app-table-grid');
  const gridNodeId = lastChildId(state);
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: gridNodeId,
    key: 'columns',
    value: serializeDesignerDataGridColumns(columns),
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: gridNodeId,
    bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
    definition: createGridListResourceBindingDefinition('users'),
  });

  return { state, gridNodeId, editModalId, deleteModalId };
};

describe('App Table Grid export fix', () => {
  it('generates syntactically valid TSX with real columns/rows/getRowKey passed to the real component', () => {
    const { state } = buildGridState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app table grid full export', tsx);

    expect(tsx).toMatch(/<AppTableGrid[^>]*\bcolumns=\{gridColumns_\w+\}/);
    expect(tsx).toMatch(/\brows=\{gridPaging_\w+\.displayRows\}/);
    expect(tsx).toMatch(/getRowKey=\{\(row\) => String\(\(row as Record<string, unknown>\)\["id"\] \?\? ''\)\}/);
    expect(tsx).not.toContain('columnsMeta');
  });

  it('never leaks gridId/gridColumnLayoutStorePath/toolbarConfig as raw attributes onto <AppTableGrid>', () => {
    const { state } = buildGridState();
    state.document.nodes[Object.keys(state.document.nodes).find(
      (id) => state.document.nodes[id]?.props._designerPaletteItemId === 'heroui.app-table-grid',
    )!].props.gridId = 'users';

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app table grid no leaked attrs', tsx);
    expect(tsx).not.toMatch(/\bgridId=/);
    expect(tsx).not.toMatch(/\btoolbarConfig=/);
    expect(tsx).not.toMatch(/\bgridColumnLayoutStorePath=/);
  });

  it('builds real rich-cell/action columns via buildAppTableGridColumns instead of an inert JSON blob', () => {
    const { state } = buildGridState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app table grid rich cells', tsx);

    // Without "Sync filters to API", effective query mode falls back to client so header
    // sort/filter controls are not silently dead (parity audit items 73/74).
    expect(tsx).toMatch(/buildAppTableGridColumns\(\[.*"cellKind":"account".*\], "client", \{/s);
    expect(tsx).toContain('"key":"locked"');
    expect(tsx).toContain('"kind":"action-group"');
  });

  it('generates a real row-action handler dispatching open-modal actions without referencing an undeclared variable', () => {
    const { state, editModalId, deleteModalId } = buildGridState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app table grid row action handler', tsx);

    expect(tsx).toMatch(/const handleGridRowAction_\w+ = React\.useCallback\(\(row: Record<string, unknown>, actionId: string\) => \{/);
    expect(tsx).toContain("case \"edit\":");
    expect(tsx).toContain("case \"delete\":");
    expect(tsx).toContain(`patchDesignerStore("ui.visibility.${editModalId}", true)`);
    expect(tsx).toContain(`patchDesignerStore("ui.visibility.${deleteModalId}", true)`);
    expect(tsx).toMatch(/onGridRowAction=\{handleGridRowAction_\w+\}/);
  });

  it('drives the footer from real state instead of hardcoded literals', () => {
    const { state } = buildGridState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app table grid real footer', tsx);

    expect(tsx).toMatch(/safePage=\{gridPaging_\w+\.safePage\}/);
    expect(tsx).toMatch(/onPageSizeChange=\{handleGridPageSizeChange_\w+\}/);
    expect(tsx).toMatch(/onSortByChange=\{handleGridSortByChange_\w+\}/);
    expect(tsx).toMatch(/onToggleSortDirection=\{handleGridToggleSortDirection_\w+\}/);
    expect(tsx).toMatch(/totalPages=\{gridPaging_\w+\.totalPages\}/);
    expect(tsx).toMatch(/pageNumbers=\{buildDataGridPageNumbers\(gridPaging_\w+\.safePage, gridPaging_\w+\.totalPages\)\}/);
    expect(tsx).toMatch(/onPageChange=\{handleGridPageChange_\w+\}/);
    expect(tsx).not.toContain('safePage={1}');
    expect(tsx).not.toContain('sortBy=""');
    expect(tsx).not.toContain('onPageChange={() => {}}');
  });

  it('binds grid fetch error state to errorContent instead of inverting on row count', () => {
    const { state, gridNodeId } = buildGridState();
    const withError = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'errorContent',
      value: 'Could not load users',
    });

    const tsx = generateDesignerTsx(withError.document, withError.bindingDefinitions);
    assertValidTsxSyntax('app table grid errorContent', tsx);

    expect(tsx).toMatch(/errorContent=\{\(error_gridData_\w+ \? "Could not load users" : undefined\)\}/);
    expect(tsx).not.toMatch(/errorContent=\{gridAggregatedRows_\w+\.length === 0 \? undefined :/);
    expect(tsx).toMatch(/isLoading=\{isLoading_gridData_\w+\}/);
  });

  it('imports the real shared helpers needed to run the generated hooks', () => {
    const { state } = buildGridState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app table grid imports', tsx);

    expect(tsx).toContain("import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';");
    expect(tsx).toContain("import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';");
    expect(tsx).toContain("import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';");
    expect(tsx).toContain("import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';");
    expect(tsx).toContain("import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';");
  });

  it('does not require any of this for a document with no App Table Grid at all', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('no app table grid', tsx);
    expect(tsx).not.toContain('buildAppTableGridColumns');
    expect(tsx).not.toContain('gridColumns_');
  });
});
