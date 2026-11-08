import { describe, expect, it } from 'vitest';
import {
  applyColumnLayout,
  applyColumnWidths,
  buildAppTableGridColumnWidthStyle,
  createDefaultColumnLayout,
  mergeStoredColumnLayoutWidths,
  reorderColumn,
  resetColumnLayout,
  resolveColumnMinWidthPx,
  sanitizeColumnLayout,
  setColumnWidth,
  toggleColumnVisibility,
  type GridColumnLayoutState,
} from '../appTableGridColumnLayout';
import type { AppTableGridColumnDef } from '../appTableGridQuery';

type Row = { id: number; name: string };

const columns: AppTableGridColumnDef<Row>[] = [
  {
    id: 'id',
    label: 'ID',
    width: 48,
    renderCell: (row) => row.id,
  },
  {
    id: 'name',
    label: 'Name',
    renderCell: (row) => row.name,
  },
  {
    id: 'actions',
    label: '',
    layout: { hideable: false },
    width: 120,
    renderCell: () => 'actions',
  },
];

describe('appTableGridColumnLayout', () => {
  it('creates default layout from managed columns only', () => {
    expect(createDefaultColumnLayout(columns)).toEqual({
      order: ['id', 'name', 'actions'],
      hidden: [],
      widths: {},
    });
  });

  it('hides and reorders columns while keeping non-hideable columns visible', () => {
    const layout: GridColumnLayoutState = {
      order: ['name', 'id', 'actions'],
      hidden: ['id'],
      widths: { name: 200 },
    };

    const visible = applyColumnLayout(columns, layout);
    expect(visible.map((column) => column.id)).toEqual(['name', 'actions']);
    expect(visible[0]?.width).toBe(200);
  });

  it('applies resized widths without hiding or reordering when layout is off', () => {
    const layout: GridColumnLayoutState = {
      order: ['name', 'id', 'actions'],
      hidden: ['id'],
      widths: { name: 220 },
    };

    const sized = applyColumnWidths(columns, layout);
    expect(sized.map((column) => column.id)).toEqual(['id', 'name', 'actions']);
    expect(sized[1]?.width).toBe(220);
    expect(sized[0]?.width).toBe(48);
  });

  it('mergeStoredColumnLayoutWidths keeps definition order and drops stored reorder/hidden', () => {
    const stored: GridColumnLayoutState = {
      order: ['name', 'id', 'actions'],
      hidden: ['id'],
      widths: { name: 240 },
    };
    const merged = mergeStoredColumnLayoutWidths(stored, columns);
    expect(merged.order).toEqual(['id', 'name', 'actions']);
    expect(merged.hidden).toEqual([]);
    expect(merged.widths).toEqual({ name: 240 });
  });

  it('inserts newly added columns at their definition position', () => {
    const columnsWithLoginAs: AppTableGridColumnDef<Row>[] = [
      columns[0],
      columns[1],
      {
        id: 'login_as',
        label: 'Login As',
        layout: { hideable: false },
        width: 116,
        renderCell: () => 'login',
      },
      columns[2],
    ];

    const sanitized = sanitizeColumnLayout(
      {
        order: ['id', 'name', 'actions'],
        hidden: [],
        widths: {},
      },
      columnsWithLoginAs,
    );

    expect(sanitized.order).toEqual(['id', 'name', 'login_as', 'actions']);
  });

  it('sanitizes unknown columns and invalid widths', () => {
    const sanitized = sanitizeColumnLayout(
      {
        order: ['missing', 'name', 'id'],
        hidden: ['actions', 'missing'],
        widths: { name: 20, id: 100, missing: 80 },
      },
      columns,
    );

    expect(sanitized.order).toEqual(['name', 'id', 'actions']);
    expect(sanitized.hidden).toEqual([]);
    expect(sanitized.widths).toEqual({ id: 100 });
  });

  it('keeps at least one managed column visible when all hideable columns are hidden', () => {
    const hideableColumns: AppTableGridColumnDef<Row>[] = [
      columns[0],
      columns[1],
    ];
    const layout: GridColumnLayoutState = {
      order: ['id', 'name'],
      hidden: ['id', 'name'],
      widths: {},
    };

    const visible = applyColumnLayout(hideableColumns, layout);
    expect(visible.map((column) => column.id)).toEqual(['id']);
  });

  it('builds width styles with optional minWidth', () => {
    expect(buildAppTableGridColumnWidthStyle({
      id: 'id',
      label: 'ID',
      width: 120,
      renderCell: () => null,
    })).toEqual({ width: 120, minWidth: 120 });

    expect(buildAppTableGridColumnWidthStyle({
      id: 'name',
      label: 'Name',
      minWidth: 96,
      renderCell: () => null,
    })).toEqual({ minWidth: 96 });

    expect(buildAppTableGridColumnWidthStyle({
      id: 'name',
      label: 'Name',
      width: 200,
      minWidth: 120,
      renderCell: () => null,
    })).toEqual({ width: 200, minWidth: 120 });
  });

  it('respects per-column min width when resizing and sanitizing', () => {
    const wideMin: AppTableGridColumnDef<Row>[] = [
      {
        id: 'name',
        label: 'Name',
        minWidth: 80,
        renderCell: (row) => row.name,
      },
    ];

    expect(resolveColumnMinWidthPx(wideMin[0])).toBe(80);
    expect(setColumnWidth(createDefaultColumnLayout(wideMin), 'name', 60, 80).widths.name).toBe(80);

    const sanitized = sanitizeColumnLayout(
      { order: ['name'], hidden: [], widths: { name: 60 } },
      wideMin,
    );
    expect(sanitized.widths).toEqual({});

    expect(setColumnWidth(createDefaultColumnLayout(wideMin), 'name', 100, 80).widths.name).toBe(100);
  });

  it('supports layout mutations', () => {
    const initial = createDefaultColumnLayout(columns);
    const hidden = toggleColumnVisibility(initial, 'name', false);
    expect(hidden.hidden).toEqual(['name']);

    const reordered = reorderColumn(hidden, 'actions', 'id');
    expect(reordered.order).toEqual(['actions', 'id', 'name']);

    const resized = setColumnWidth(reordered, 'id', 72);
    expect(resized.widths.id).toBe(72);

    expect(resetColumnLayout(columns)).toEqual(createDefaultColumnLayout(columns));
  });
});
