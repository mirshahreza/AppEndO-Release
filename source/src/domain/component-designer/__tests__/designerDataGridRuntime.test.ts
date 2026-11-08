import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION } from '../../../shared/lib/appTableGridColumnTextDirection';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { resolveDesignerAppTableGridColumnAlign } from '../DesignerRuntimeAppTableGrid';
import {
  appendServerInfiniteGridRows,
  buildDataGridPageNumbers,
  buildDesignerGridColumnStyles,
  normalizeDataGridPageSize,
  resolveDataGridPagingConfig,
  resolveDataGridTotalCount,
  resolveGridColumnWidth,
  shouldUseDesignerDataGridContainedScroll,
  sliceDataGridRowsForDisplay,
} from '../designerDataGridRuntime';

describe('designerDataGridRuntime', () => {
  it('normalizes page size within supported bounds', () => {
    expect(normalizeDataGridPageSize(0)).toBe(1);
    expect(normalizeDataGridPageSize(999)).toBe(500);
    expect(normalizeDataGridPageSize(25)).toBe(25);
  });

  it('appends the next server infinite page without duplicate row keys', () => {
    const page1 = [{ id: 1 }, { id: 2 }];
    const page2 = [{ id: 2 }, { id: 3 }];
    expect(appendServerInfiniteGridRows(page1, page2, 'id').map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('slices rows for the active page in client mode', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ id: index + 1 }));
    const result = sliceDataGridRowsForDisplay(rows, 2, 10, rows.length, 'client');

    expect(result.safePage).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.displayRows.map((row) => row.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('uses configured total for server mode and does not re-slice server page rows', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({ id: index + 1 }));
    const config = {
      page: 2,
      pageSize: 5,
      total: 120,
      gridQueryMode: 'server' as const,
    };

    expect(resolveDataGridTotalCount(config, rows.length)).toBe(120);
    const sliced = sliceDataGridRowsForDisplay(rows, 2, 5, 120, 'server');
    expect(sliced.totalPages).toBe(24);
    expect(sliced.displayRows.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('builds a compact page number window', () => {
    expect(buildDataGridPageNumbers(5, 10)).toEqual([3, 4, 5, 6, 7]);
  });

  it('uses contained scroll when sticky header is enabled', () => {
    expect(shouldUseDesignerDataGridContainedScroll(true)).toBe(true);
    expect(shouldUseDesignerDataGridContainedScroll(false)).toBe(false);
  });

  it('parses designer column width strings', () => {
    expect(resolveGridColumnWidth('120px')).toBe('120px');
    expect(resolveGridColumnWidth('200')).toBe('200px');
    expect(resolveGridColumnWidth(96)).toBe('96px');
    expect(resolveGridColumnWidth('')).toBeUndefined();
  });

  it('assigns auto width and min width for columns without explicit width', () => {
    const styles = buildDesignerGridColumnStyles([
      { id: 'id', width: '80px' },
      { id: 'name' },
      { id: 'status', width: '120px' },
    ]);

    expect(styles[0]).toEqual({ width: '80px', minWidth: '80px' });
    expect(styles[1]?.minWidth).toBe('8rem');
    expect(styles[1]?.width).toMatch(/%$/);
    expect(styles[2]).toEqual({ width: '120px', minWidth: '120px' });
  });

  it('reads paging config from node props', () => {
    const config = resolveDataGridPagingConfig({
      id: 'grid-1',
      type: 'container',
      parentId: 'root',
      children: [],
      props: {
        pageSize: 20,
        page: 2,
        total: 80,
        gridQueryMode: 'server',
      },
      layout: {},
      binding: {},
    });

    expect(config).toEqual({
      page: 2,
      pageSize: 20,
      total: 80,
      gridQueryMode: 'server',
    });
  });
});

describe('resolveDesignerAppTableGridColumnAlign', () => {
  it('defaults data columns to culture-relative direction and action columns to the logical end', () => {
    expect(resolveDesignerAppTableGridColumnAlign({
      key: 'title',
      label: 'Title',
    })).toEqual({
      textDirection: DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION,
    });

    expect(resolveDesignerAppTableGridColumnAlign({
      key: '__actions',
      label: '',
      kind: 'action-group',
      actions: [],
    })).toEqual({
      headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
      cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
    });
  });

  it('preserves authored alignment classes and still defaults textDirection to culture', () => {
    expect(resolveDesignerAppTableGridColumnAlign({
      key: 'title',
      label: 'Title',
      headerClassName: 'text-start',
      cellClassName: 'text-start',
    })).toEqual({
      textDirection: DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION,
    });

    expect(resolveDesignerAppTableGridColumnAlign({
      key: 'phone1',
      label: 'Phone',
      headerClassName: 'text-center [&>div]:justify-center',
      cellClassName: 'text-center',
    })).toEqual({
      headerClassName: 'text-center [&>div]:justify-center',
      cellClassName: 'text-center',
      textDirection: DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION,
    });
  });
});
