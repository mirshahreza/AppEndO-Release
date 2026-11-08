import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  applyClientGridQuery,
  EMPTY_GRID_QUERY,
  resolveColumnMode,
  sanitizeGridQuery,
  setColumnFilter,
  toggleColumnSort,
  type AppTableGridColumnDef,
  type GridColumnQueryMode,
  type GridFilterValue,
  type GridQueryState,
} from '../../shared/lib/appTableGridQuery';
import {
  APP_TABLE_GRID_HEADER_ROW_GROUP_CLASS,
  AppTableGridColumnHeader,
} from '../../shared/ui/AppTableGridColumnHeader';
import {
  APP_TABLE_GRID_BODY_CELL_CLASS,
  APP_TABLE_GRID_ROW_CLASS,
  APP_TABLE_GRID_STATE_PANEL_CLASS,
  APP_TABLE_GRID_TABLE_CLASS,
  APP_TABLE_GRID_TBODY_CLASS,
} from '../../shared/ui/surfaceClasses';
import { buildDesignerGridColumnStyles } from './designerDataGridRuntime';
import {
  mergePinnedCellStyle,
  resolvePinnedColumnStyles,
} from '../../shared/lib/appTableGridPinnedColumns';

type DesignerDataGridTableProps<TRow> = {
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  rows: ReadonlyArray<TRow>;
  getRowKey: (row: TRow) => string;
  gridQueryMode?: GridColumnQueryMode;
  emptyMessage?: string;
  isStriped?: boolean;
  size?: 'xs' | 'sm';
  /** Scroll tbody inside the grid shell — header stays visible without CSS sticky. */
  containedScroll?: boolean;
  maxHeight?: React.CSSProperties['maxHeight'];
  query?: GridQueryState;
  onQueryChange?: (query: GridQueryState) => void;
  /** Parent already applied filter/sort/pagination to `rows`. */
  skipClientQuery?: boolean;
};

const CONTAINED_TBODY_ROW_CLASS = 'table w-full table-fixed';
const CONTAINED_THEAD_ROW_CLASS = 'table w-full table-fixed';

export const DesignerDataGridTable = <TRow,>({
  columns,
  rows,
  getRowKey,
  gridQueryMode = 'client',
  emptyMessage = 'No records found',
  isStriped = false,
  size = 'xs',
  containedScroll = false,
  maxHeight = '20rem',
  query: controlledQuery,
  onQueryChange,
  skipClientQuery = false,
}: DesignerDataGridTableProps<TRow>) => {
  const [uncontrolledQuery, setUncontrolledQuery] = React.useState<GridQueryState>(EMPTY_GRID_QUERY);
  const isQueryControlled = controlledQuery !== undefined;
  const effectiveQuery = controlledQuery ?? uncontrolledQuery;

  const commitQuery = React.useCallback((nextQuery: GridQueryState) => {
    if (onQueryChange) {
      onQueryChange(nextQuery);
      return;
    }
    setUncontrolledQuery(nextQuery);
  }, [onQueryChange]);

  const sanitizedQuery = React.useMemo(
    () => sanitizeGridQuery(
      effectiveQuery,
      columns as ReadonlyArray<AppTableGridColumnDef<unknown>>,
      gridQueryMode,
    ),
    [columns, effectiveQuery, gridQueryMode],
  );

  const displayRows = React.useMemo(
    () => (skipClientQuery
      ? rows
      : applyClientGridQuery(
        rows,
        sanitizedQuery,
        columns as ReadonlyArray<AppTableGridColumnDef<unknown>>,
        gridQueryMode,
      )),
    [columns, gridQueryMode, rows, sanitizedQuery, skipClientQuery],
  );

  const columnById = React.useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  const handleSortToggle = React.useCallback((columnId: string) => {
    const column = columnById.get(columnId);
    if (!column) {
      return;
    }

    const nextQuery = toggleColumnSort(
      effectiveQuery,
      columnId,
      column as AppTableGridColumnDef<unknown>,
    );
    if (!nextQuery) {
      return;
    }

    commitQuery(sanitizeGridQuery(
      nextQuery,
      columns as ReadonlyArray<AppTableGridColumnDef<unknown>>,
      gridQueryMode,
    ));
  }, [columnById, columns, commitQuery, effectiveQuery, gridQueryMode]);

  const handleFilterCommit = React.useCallback((columnId: string, filter: GridFilterValue) => {
    const column = columnById.get(columnId);
    if (!column || !column.filter) {
      return;
    }

    const mode = resolveColumnMode(column as AppTableGridColumnDef<unknown>, 'filter', gridQueryMode);
    const nextQuery = setColumnFilter(effectiveQuery, columnId, filter);
    const sanitized = sanitizeGridQuery(
      nextQuery,
      columns as ReadonlyArray<AppTableGridColumnDef<unknown>>,
      gridQueryMode,
    );

    if (mode === 'client') {
      commitQuery(sanitized);
      return;
    }

    commitQuery(sanitized);
  }, [columnById, columns, commitQuery, effectiveQuery, gridQueryMode]);

  const tableClassName = cn(
    APP_TABLE_GRID_TABLE_CLASS,
    'w-full table-fixed',
    size === 'xs' ? 'text-xs' : 'text-sm',
  );

  const columnStyles = React.useMemo(
    () => buildDesignerGridColumnStyles(columns),
    [columns],
  );

  const pinnedStyles = React.useMemo(
    () => resolvePinnedColumnStyles(columns as ReadonlyArray<AppTableGridColumnDef<unknown>>),
    [columns],
  );

  const colgroup = (
    <colgroup>
      {columns.map((column, index) => (
        <col
          key={column.id}
          style={columnStyles[index]}
        />
      ))}
    </colgroup>
  );

  const headerCells = columns.map((column, index) => (
    <AppTableGridColumnHeader
      key={column.id}
      column={column as AppTableGridColumnDef<unknown>}
      query={sanitizedQuery}
      gridQueryMode={gridQueryMode}
      onSortToggle={handleSortToggle}
      onFilterCommit={handleFilterCommit}
      // Body cells below always get an explicit width via `columnStyles[index]` (a computed
      // even auto-share percentage when the column has no explicit width). The header must use
      // the exact same style, not just its own `column.width`-only fallback — see the `style`
      // prop doc on AppTableGridColumnHeader for why this drifts badly under contained-scroll
      // (sticky header) mode specifically.
      style={mergePinnedCellStyle(columnStyles[index], pinnedStyles.get(column.id))}
    />
  ));

  const tbodyClassName = cn(
    APP_TABLE_GRID_TBODY_CLASS,
    isStriped ? '[&_tr:nth-child(even)]:bg-slate-50/80' : undefined,
    containedScroll ? 'block w-full overflow-y-auto overscroll-y-auto' : undefined,
  );

  const bodyRows = displayRows.length === 0
    ? (
      <tr className={containedScroll ? CONTAINED_TBODY_ROW_CLASS : undefined}>
        <td
          colSpan={Math.max(columns.length, 1)}
          className={cn(APP_TABLE_GRID_BODY_CELL_CLASS, APP_TABLE_GRID_STATE_PANEL_CLASS, 'text-center')}
        >
          {emptyMessage}
        </td>
      </tr>
    )
    : displayRows.map((row) => (
      <tr
        key={getRowKey(row)}
        className={cn(APP_TABLE_GRID_ROW_CLASS, containedScroll ? CONTAINED_TBODY_ROW_CLASS : undefined)}
      >
        {columns.map((column, index) => (
          <td
            key={column.id}
            className={cn(APP_TABLE_GRID_BODY_CELL_CLASS, column.cellClassName)}
            style={mergePinnedCellStyle(columnStyles[index], pinnedStyles.get(column.id))}
            data-column-id={column.id}
            data-pinned={
              column.layout && typeof column.layout === 'object' && column.layout.pinned
                ? column.layout.pinned
                : undefined
            }
          >
            {column.renderCell(row)}
          </td>
        ))}
      </tr>
    ));

  if (containedScroll) {
    return (
      <div className="relative z-0 w-full overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className={tableClassName}>
          {colgroup}
          <thead className="block w-full border-b border-slate-300 bg-slate-100">
            <tr className={cn(CONTAINED_THEAD_ROW_CLASS, APP_TABLE_GRID_HEADER_ROW_GROUP_CLASS)}>
              {headerCells}
            </tr>
          </thead>
          <tbody className={tbodyClassName} style={{ maxHeight }}>
            {bodyRows}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="relative z-0 w-full overflow-x-auto">
      <table className={tableClassName}>
        {colgroup}
        <thead className="border-b border-slate-300 bg-slate-100">
          <tr className={APP_TABLE_GRID_HEADER_ROW_GROUP_CLASS}>
            {headerCells}
          </tr>
        </thead>
        <tbody className={tbodyClassName}>
          {bodyRows}
        </tbody>
      </table>
    </div>
  );
};
