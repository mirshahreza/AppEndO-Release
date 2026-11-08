import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import {
  GRID_LIST_RESOURCE_BINDING_KEY,
  createGridListResourceBindingDefinition,
} from '../bindingGridEngine';
import {
  GRID_DETAIL_FLOW_BINDING_KEY,
  createGridDetailFlowBindingDefinition,
} from '../bindingGridDetailEngine';
import {
  serializeDesignerDataGridColumns,
  type DesignerDataGridColumn,
} from '../designerDataGridColumns';
import {
  applyDesignerGridToolbarClientFilters,
  serializeDesignerGridToolbarConfig,
} from '../designerGridToolbarConfig';
import {
  resolveDataGridTotalCount,
  resolveEffectiveAppTableGridQueryMode,
  sliceDataGridRowsForDisplay,
} from '../designerDataGridRuntime';
import { documentAppTableGridUsesStore } from '../bindingStoreCodegen';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit items 30, 70–78, 97): App Table Grid server paging re-sliced page
 * payloads to empty rows; Export hard-coded dead cellClickHandlerRef; detail-flow row actions
 * with mismatched actionId no-op'd; footer props cardBelow/showSortControls/showListModeControls/
 * visibleInfiniteCount were excluded without re-emit; toolbar search/role filters were silent
 * without Sync-to-API; role-filter initial state flipped between Preview (false) and Export
 * (true); Total Records was design-time only; cell disable expressions referencing store.* never
 * forced a real designerStore into column builders.
 * Fixed across designerDataGridRuntime.ts, DesignerRuntimeAppTableGrid.tsx, bindingCodegen.ts,
 * tsxPhase2Palette.ts, bindingStoreCodegen.ts, designerGridToolbarConfig.ts.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('sliceDataGridRowsForDisplay server mode (parity audit item 30)', () => {
  it('returns the server page rows as-is on page 2+ instead of re-slicing to empty', () => {
    const pageRows = Array.from({ length: 10 }, (_, index) => ({ id: 11 + index }));
    const result = sliceDataGridRowsForDisplay(pageRows, 2, 10, 100, 'server');

    expect(result.safePage).toBe(2);
    expect(result.totalPages).toBe(10);
    expect(result.displayRows.map((row) => row.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('still slices locally in client mode', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ id: index + 1 }));
    const result = sliceDataGridRowsForDisplay(rows, 2, 10, rows.length, 'client');
    expect(result.displayRows.map((row) => row.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });
});

describe('resolveDataGridTotalCount heuristic (parity audit item 78)', () => {
  it('uses explicit total when provided', () => {
    expect(resolveDataGridTotalCount({
      page: 1,
      pageSize: 10,
      total: 120,
      gridQueryMode: 'server',
    }, 10)).toBe(120);
  });

  it('assumes at least one more page when server total is unset and the page is full', () => {
    expect(resolveDataGridTotalCount({
      page: 1,
      pageSize: 10,
      total: 0,
      gridQueryMode: 'server',
    }, 10)).toBe(11);
  });

  it('falls back to loaded row count when the last page is partial', () => {
    expect(resolveDataGridTotalCount({
      page: 2,
      pageSize: 10,
      total: 0,
      gridQueryMode: 'server',
    }, 3)).toBe(13);
  });
});

describe('effective query mode + toolbar client filters (parity audit items 73/74)', () => {
  it('falls back to client mode when Sync-to-API is off', () => {
    expect(resolveEffectiveAppTableGridQueryMode('server', false)).toBe('client');
    expect(resolveEffectiveAppTableGridQueryMode('server', true)).toBe('server');
    expect(resolveEffectiveAppTableGridQueryMode('client', true)).toBe('client');
  });

  it('filters loaded rows by search and active role checkboxes', () => {
    const rows = [
      { id: 1, email: 'alice@example.com', roles: ['ADMIN'] },
      { id: 2, email: 'bob@example.com', roles: ['USER'] },
      { id: 3, email: 'carol@example.com', roles: ['ADMIN', 'USER'] },
    ];

    expect(applyDesignerGridToolbarClientFilters(rows, { searchText: 'bob' }).map((row) => row.id)).toEqual([2]);
    expect(applyDesignerGridToolbarClientFilters(rows, {
      roleFilters: { ADMIN: true, USER: false },
    }).map((row) => row.id)).toEqual([1, 3]);
    expect(applyDesignerGridToolbarClientFilters(rows, {
      roleFilters: { ADMIN: false, USER: false },
    })).toHaveLength(3);
  });
});

describe('app-table-grid phase 3 export parity (items 70–72, 77, 97)', () => {
  const buildGridWithRichClickAndDetailFlow = (): {
    state: DesignerState;
    gridNodeId: string;
    modalId: string;
  } => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'email', 'roles'],
        primaryKey: 'id',
        responseMapping: { arrayPath: 'data', totalPath: 'meta.total' },
      },
    });
    state = insertItem(state, 'heroui.modal');
    const modalId = lastChildId(state);
    state = insertItem(state, 'html.form', modalId);
    const formId = lastChildId(state);
    state = insertItem(state, 'heroui.app-table-grid');
    const gridNodeId = lastChildId(state);

    const columns: DesignerDataGridColumn[] = [
      {
        key: 'email',
        label: 'Email',
        cellKind: 'link',
        cellFields: { labelField: 'email' },
        cellClickBehavior: {
          kind: 'open-modal',
          modalNodeId: modalId,
          primaryKeyField: 'id',
          selectionStorePath: 'selection.id',
        },
        sort: true,
      },
      {
        key: 'actions',
        label: '',
        kind: 'action-group',
        actions: [
          {
            actionId: 'open-detail-alias',
            icon: 'Eye',
            intent: 'view',
            tooltip: 'Open',
            behavior: { kind: 'detail-flow' },
          },
        ],
      },
    ];

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns(columns),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'gridQueryMode',
      value: 'server',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'cardBelow',
      value: 'tablet',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'showSortControls',
      value: false,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'showListModeControls',
      value: false,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'toolbarConfig',
      value: serializeDesignerGridToolbarConfig({
        enabled: true,
        search: { enabled: true, storePath: 'gridToolbar.search' },
        roleFilters: { enabled: true, roles: ['ADMIN', 'USER'] },
        serverQuery: { enabled: true },
      }),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_DETAIL_FLOW_BINDING_KEY,
      definition: createGridDetailFlowBindingDefinition({
        primaryKeyField: 'id',
        selectionStorePath: 'selection.id',
        detailDataSourceRef: 'users',
        detailModalNodeId: modalId,
        detailRegionNodeId: formId,
        rowActionId: 'view-details',
        rowActionLabel: 'Details',
      }),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    return { state, gridNodeId, modalId };
  };

  it('emits a real cellClick handler and detail-flow case for mismatched actionId (items 70/71)', () => {
    const { state, modalId } = buildGridWithRichClickAndDetailFlow();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('app-table-grid phase3 cell click + detail-flow', tsx);

    expect(tsx).toMatch(/const handleGridCellClick_\w+ = React\.useCallback/);
    expect(tsx).toContain('cellClickHandlerRef: { current: handleGridCellClick_');
    expect(tsx).not.toContain('cellClickHandlerRef: { current: undefined }');
    expect(tsx).toContain(`case "open-detail-alias"`);
    expect(tsx).toContain(`ui.visibility.${modalId}`);
  });

  it('re-emits footer control props and cardBelow (item 72)', () => {
    const { state } = buildGridWithRichClickAndDetailFlow();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('cardBelow="tablet"');
    expect(tsx).toContain('showSortControls={false}');
    expect(tsx).not.toMatch(/onListModeChange=\{setGridListMode_/);
    expect(tsx).toContain('visibleInfiniteCount={');
  });

  it('initializes role filters as all-false like Preview (item 77)', () => {
    const { state } = buildGridWithRichClickAndDetailFlow();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('{"ADMIN":false,"USER":false}');
    expect(tsx).not.toContain('{"ADMIN":true,"USER":true}');
  });

  it('resolves total from responseMapping.totalPath when present (item 78)', () => {
    const { state } = buildGridWithRichClickAndDetailFlow();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('"meta.total"');
    expect(tsx).toMatch(/gridApiTotal_\w+/);
  });

  it('detects store.* expressions in cellDisabledWhen (item 97)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.app-table-grid');
    const gridNodeId = lastChildId(state);
    const columns: DesignerDataGridColumn[] = [
      {
        key: 'email',
        label: 'Email',
        cellDisabledWhen: {
          preset: 'expression',
          expression: 'store.user.role === "GUEST"',
        },
      },
    ];
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns(columns),
    });

    expect(documentAppTableGridUsesStore(state.document, state.bindingDefinitions)).toBe(true);
  });
});
