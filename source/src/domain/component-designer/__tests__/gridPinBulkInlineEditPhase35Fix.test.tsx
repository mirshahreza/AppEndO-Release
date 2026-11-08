/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit phase 35 / per-element §6 #5): grids lacked column pin/freeze,
 * multi-select → bulk toolbar actions, and inline cell editing across Canvas/Preview/Export.
 * Fixed in designerDataGridColumns.ts, designerGridToolbarConfig.ts, designerGridSelectionRuntime.ts,
 * AppTableGrid (+ pin/selection), DesignerRuntimeAppTableGrid/DataGrid, DesignerDataGridTable,
 * bindingEngine.ts (onSelectionChange/onCellChange), Inspector column/toolbar fields.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { resolvePinnedColumnStyles } from '../../../shared/lib/appTableGridPinnedColumns';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { resolveNodeEventBindingTargets } from '../bindingEngine';
import {
  parseDesignerDataGridColumns,
  serializeDesignerDataGridColumns,
} from '../designerDataGridColumns';
import {
  createDefaultGridBulkAction,
  executeGridBulkAction,
  executeGridCellChangeActions,
} from '../designerGridSelectionRuntime';
import { createDynamicAction } from '../bindingDynamicActionsEngine';
import { DesignerGridInlineEditCell } from '../designerGridInlineEditCell';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import { DesignerGridBulkActionsBar } from '../designerGridBulkActionsBar';
import { parseDesignerGridToolbarConfig } from '../designerGridToolbarConfig';

const withCulture = (ui: React.ReactElement) => render(
  <CultureProvider cultureId="us">{ui}</CultureProvider>,
);

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('35.1 — layoutPinned sticky column styles', () => {
  it('parses layoutPinned on DesignerDataGridColumn and keeps round-trip', () => {
    const json = serializeDesignerDataGridColumns([
      { key: 'id', label: 'ID', width: '80px', layoutPinned: 'left' },
      { key: 'name', label: 'Name' },
      { key: 'actions', label: 'Actions', layoutPinned: 'right' },
    ]);
    const parsed = parseDesignerDataGridColumns(json);
    expect(parsed[0]?.layoutPinned).toBe('left');
    expect(parsed[2]?.layoutPinned).toBe('right');
  });

  it('computes sticky left/right offsets from pin side + widths', () => {
    const columns: AppTableGridColumnDef<Record<string, unknown>>[] = [
      {
        id: 'id',
        label: 'ID',
        width: 80,
        layout: { pinned: 'left' },
        renderCell: () => null,
      },
      {
        id: 'name',
        label: 'Name',
        width: 200,
        renderCell: () => null,
      },
      {
        id: 'status',
        label: 'Status',
        width: 120,
        layout: { pinned: 'right' },
        renderCell: () => null,
      },
    ];
    const styles = resolvePinnedColumnStyles(columns);
    expect(styles.get('id')).toMatchObject({ position: 'sticky', insetInlineStart: 0 });
    expect(styles.get('status')).toMatchObject({ position: 'sticky', insetInlineEnd: 0 });
    expect(styles.has('name')).toBe(false);
  });

  it('renders pinned cells with position:sticky and fixed left offset in AppTableGrid DOM', () => {
    const columns: AppTableGridColumnDef<{ id: string; name: string }>[] = [
      {
        id: 'id',
        label: 'ID',
        width: 100,
        layout: { pinned: 'left', hideable: false, resizable: false, reorderable: false },
        renderCell: (row) => row.id,
      },
      {
        id: 'name',
        label: 'Name',
        width: 400,
        renderCell: (row) => row.name,
      },
    ];

    const { container } = withCulture(
      <div style={{ width: 240, overflow: 'auto' }}>
        <AppTableGrid
          columns={columns}
          rows={[
            { id: 'r1', name: 'Alpha with a very long name that forces horizontal scroll' },
            { id: 'r2', name: 'Beta with a very long name that forces horizontal scroll' },
          ]}
          getRowKey={(row) => row.id}
          presentation="table"
        />
      </div>,
    );

    const pinnedCell = container.querySelector('td[data-pinned="left"]') as HTMLElement | null;
    expect(pinnedCell).toBeTruthy();
    expect(pinnedCell!.style.position).toBe('sticky');
    expect(pinnedCell!.style.insetInlineStart).toBe('0px');

    const scrollHost = container.querySelector('[class*="overflow"]') as HTMLElement | null
      ?? pinnedCell!.closest('div');
    if (scrollHost) {
      scrollHost.scrollLeft = 80;
      expect(pinnedCell!.style.position).toBe('sticky');
      expect(pinnedCell!.getBoundingClientRect().left).toBeTypeOf('number');
    }
  });
});

describe('35.2 — selection + bulkActions callMutation per selected key', () => {
  it('exposes onSelectionChange for all three grid palette items', () => {
    for (const itemId of ['heroui.app-table-grid', 'heroui.data-grid', 'heroui.table'] as const) {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const targets = resolveNodeEventBindingTargets(state.document.nodes[nodeId]!);
      expect(targets).toContain('onSelectionChange');
      expect(targets).toContain('onCellChange');
    }
  });

  it('parses bulkActions on toolbar config', () => {
    const bulk = createDefaultGridBulkAction('Delete selected');
    bulk.actions[0]!.dataSourceRef = 'users';
    const config = parseDesignerGridToolbarConfig({
      enabled: true,
      bulkActions: [bulk],
      selectionStorePath: 'gridSelection.selectedKeys',
    });
    expect(config?.bulkActions).toHaveLength(1);
    expect(config?.bulkActions?.[0]?.label).toBe('Delete selected');
    expect(config?.selectionStorePath).toBe('gridSelection.selectedKeys');
  });

  it('runs callMutation once per selected key (fetch count === selection size)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
        primaryKey: 'id',
        operations: {
          list: { method: 'GET', endpoint: '/api/users' },
          delete: { method: 'DELETE', endpoint: '/api/users/:id' },
        },
      },
    });

    const bulk = createDefaultGridBulkAction('Delete selected');
    bulk.actions[0]!.dataSourceRef = 'users';
    bulk.actions[0]!.mutationOperation = 'delete';
    bulk.actions[0]!.mutationRecordIdStorePath = 'gridSelection.activeId';

    const store: Record<string, unknown> = {};
    const patchStore = (path: string, value: unknown) => {
      const segments = path.split('.');
      let cursor: Record<string, unknown> = store;
      for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i]!;
        if (!cursor[key] || typeof cursor[key] !== 'object') {
          cursor[key] = {};
        }
        cursor = cursor[key] as Record<string, unknown>;
      }
      cursor[segments[segments.length - 1]!] = value;
    };

    await executeGridBulkAction(bulk, ['row-1', 'row-2', 'row-3'], {
      bindingDefinitions: state.bindingDefinitions,
      runtime: {
        designerStore: store,
        patchStore,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const callUrls = (fetchMock.mock.calls as unknown[][]).map((call) => String(call[0] ?? ''));
    expect(callUrls[0]).toContain('/api/users/row-1');
    expect(callUrls[1]).toContain('/api/users/row-2');
    expect(callUrls[2]).toContain('/api/users/row-3');
  });

  it('shows bulk action button only when selection is non-empty and invokes on click', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id'],
        primaryKey: 'id',
        operations: {
          delete: { method: 'DELETE', endpoint: '/api/users/:id' },
        },
      },
    });

    const bulk = createDefaultGridBulkAction('Delete selected');
    bulk.actions[0]!.dataSourceRef = 'users';

    const store: Record<string, unknown> = {};
    const patchStore = (path: string, value: unknown) => {
      store[path] = value;
    };

    const { rerender } = withCulture(
      <DesignerGridBulkActionsBar
        bulkActions={[bulk]}
        selectedKeys={[]}
        bindingDefinitions={state.bindingDefinitions}
        runtime={{ designerStore: store, patchStore }}
      />,
    );
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull();

    rerender(
      <CultureProvider cultureId="us">
        <DesignerGridBulkActionsBar
          bulkActions={[bulk]}
          selectedKeys={['a', 'b']}
          bindingDefinitions={state.bindingDefinitions}
          runtime={{ designerStore: store, patchStore }}
        />
      </CultureProvider>,
    );

    const button = screen.getByRole('button', { name: /delete selected/i });
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('AppTableGrid selectionMode=multiple writes selected keys via onSelectionChange', () => {
    const onSelectionChange = vi.fn();
    const columns: AppTableGridColumnDef<{ id: string; name: string }>[] = [
      { id: 'name', label: 'Name', renderCell: (row) => row.name },
    ];
    withCulture(
      <AppTableGrid
        columns={columns}
        rows={[
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ]}
        getRowKey={(row) => row.id}
        selectionMode="multiple"
        selectedKeys={[]}
        onSelectionChange={onSelectionChange}
        presentation="table"
      />,
    );

    const checkbox = screen.getByText('Select row 1');
    fireEvent.click(checkbox);
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });
});

describe('35.3 — inline cell edit onCellChange payload', () => {
  it('parses editable + onCellChangeActions on columns', () => {
    const action = createDynamicAction('callMutation');
    action.mutationOperation = 'update';
    const json = serializeDesignerDataGridColumns([
      {
        key: 'name',
        label: 'Name',
        editable: true,
        cellEditorPaletteItemId: 'heroui.input',
        onCellChangeActions: [action],
      },
    ]);
    const parsed = parseDesignerDataGridColumns(json);
    expect(parsed[0]?.editable).toBe(true);
    expect(parsed[0]?.cellEditorPaletteItemId).toBe('heroui.input');
    expect(parsed[0]?.onCellChangeActions?.[0]?.type).toBe('callMutation');
  });

  it('commits inline edit and runs onCellChange with rowKey/field/value payload', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
        primaryKey: 'id',
        operations: {
          update: { method: 'PATCH', endpoint: '/api/users/:id' },
        },
      },
    });

    const action = createDynamicAction('callMutation');
    action.dataSourceRef = 'users';
    action.mutationOperation = 'update';
    action.mutationRecordIdStorePath = 'gridSelection.activeId';

    const store: Record<string, unknown> = {};
    const patches: Array<{ path: string; value: unknown }> = [];
    const patchStore = (path: string, value: unknown) => {
      patches.push({ path, value });
      const segments = path.split('.');
      let cursor: Record<string, unknown> = store;
      for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i]!;
        if (!cursor[key] || typeof cursor[key] !== 'object') {
          cursor[key] = {};
        }
        cursor = cursor[key] as Record<string, unknown>;
      }
      cursor[segments[segments.length - 1]!] = value;
    };

    withCulture(
      <DesignerGridInlineEditCell
        column={{
          key: 'name',
          label: 'Name',
          editable: true,
          onCellChangeActions: [action],
        }}
        row={{ id: 'row-9', name: 'Old' }}
        rowKey="row-9"
        mode="runtime"
        bindingDefinitions={state.bindingDefinitions}
        runtime={{ designerStore: store, patchStore }}
      />,
    );

    const input = screen.getByDisplayValue('Old');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(patches.some((entry) => entry.path === 'gridCellEdit.value' && entry.value === 'New Name')).toBe(true);
      expect(patches.some((entry) => entry.path === 'gridCellEdit.field' && entry.value === 'name')).toBe(true);
      expect(patches.some((entry) => entry.path === 'gridCellEdit.rowKey' && entry.value === 'row-9')).toBe(true);
    });

    await waitFor(() => {
      const userCalls = fetchMock.mock.calls.filter((call) => String(call.at(0)).includes('/api/users/'));
      expect(userCalls.length).toBeGreaterThan(0);
      expect(String(userCalls[0]?.at(0))).toContain('/api/users/row-9');
    });
  });

  it('executeGridCellChangeActions writes payload then resolves mutation', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
        primaryKey: 'id',
        operations: {
          update: { method: 'PATCH', endpoint: '/api/users/:id' },
        },
      },
    });

    const action = createDynamicAction('callMutation');
    action.dataSourceRef = 'users';
    action.mutationOperation = 'update';
    action.mutationRecordIdStorePath = 'gridSelection.activeId';

    const store: Record<string, unknown> = {};
    const patchStore = (path: string, value: unknown) => {
      const segments = path.split('.');
      let cursor: Record<string, unknown> = store;
      for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i]!;
        if (!cursor[key] || typeof cursor[key] !== 'object') {
          cursor[key] = {};
        }
        cursor = cursor[key] as Record<string, unknown>;
      }
      cursor[segments[segments.length - 1]!] = value;
    };

    await executeGridCellChangeActions([action], {
      rowKey: '42',
      field: 'name',
      value: 'Patched',
      row: { id: '42', name: 'Patched' },
    }, {
      bindingDefinitions: state.bindingDefinitions,
      runtime: { designerStore: store, patchStore },
    });

    expect((store.gridCellEdit as { value?: string })?.value).toBe('Patched');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
