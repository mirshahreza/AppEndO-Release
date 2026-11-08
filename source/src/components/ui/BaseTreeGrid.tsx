import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOptionalCulture, useOptionalCultureT } from '../../core/culture/CultureContext';
import {
  APP_TABLE_GRID_CELL_PR_CLASS,
  APP_TABLE_GRID_HEADER_CELL_CLASS,
  APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS,
  APP_TABLE_GRID_TABLE_CLASS,
  APP_TABLE_GRID_THEAD_CLASS,
} from '../../shared/ui/surfaceClasses';
import type { GridColumnHideBelow } from '../../shared/lib/appTableGridQuery';
import { isColumnHiddenAtViewport, type GridCardActionsPlacement } from '../../shared/lib/gridRowActions';
import { useViewportTier } from '../../shared/lib/useViewportTier';
import { isCompactChromeTier } from '../../shared/lib/viewportTokens';
import type { TreeDropPosition } from '../../shared/types/tree';
import { resolveTreeDropPosition } from '../../shared/lib/treeDropPosition';
import {
  shouldVirtualizeTreeGridRows,
  TreeGridVirtualHybridPadding,
  TreeGridVirtualTablePadding,
  useTreeGridRowVirtualizer,
  useTreeGridScrollParent,
} from './BaseTreeGridVirtualBodies';
import { useGridColumnLayout } from '../../shared/lib/useGridColumnLayout';
import type { AppTableGridColumnTextDirection } from '../../shared/lib/appTableGridColumnTextDirection';
import {
  buildTreeGridLayoutColumnDefs,
  createTreeGridColumnAutoFitHandler,
  createTreeGridResizeHandler,
  resolveTreeGridDataColumnDirectionChrome,
  resolveTreeGridIdColumnDirectionChrome,
  resolveTreeGridNodeColumnDirectionChrome,
  TREE_GRID_ID_COLUMN_ID,
  TREE_GRID_NODE_COLUMN_ID,
  treeGridColumnWidthStyle,
} from './baseTreeGridColumnLayout';
import { BaseTreeGridHeaderCell } from './BaseTreeGridHeaderCell';
import { BaseTreeGridTableRow } from './BaseTreeGridTableRow';

export type { TreeDropPosition } from '../../shared/types/tree';

export type BaseTreeGridRow = {
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren?: boolean;
};

type BaseTreeGridColumn<T extends BaseTreeGridRow> = {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  textDirection?: AppTableGridColumnTextDirection;
  style?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  hideBelow?: GridColumnHideBelow;
  /** Default true; set false to lock width. Actions column is always locked. */
  resizable?: boolean;
  renderCell: (row: T) => React.ReactNode;
};

type BaseTreeGridProps<T extends BaseTreeGridRow> = {
  rows: T[];
  columns: Array<BaseTreeGridColumn<T>>;
  expandedById: Record<string, boolean>;
  loadingByParent: Record<string, boolean>;
  moveDisabled?: boolean;
  hideExpandControls?: boolean;
  showHeader?: boolean;
  showIdColumn?: boolean;
  nodeColumnHeader?: string;
  /** Fixed width for the tree node column (pixels). */
  nodeColumnWidth?: number;
  /** Phone and tablet stacked field rows; disables row drag-reorder. */
  layout?: 'table' | 'hybrid-stacked';
  /** Where the actions column renders in stacked layout. */
  stackedActionsPlacement?: GridCardActionsPlacement;
  /** Stacked field label treatment. Default inline. */
  stackedFieldLabels?: 'inline' | 'stacked' | 'hidden';
  /** Keeps the header fixed inside the tree scroll owner. Default true. */
  stickyHeader?: boolean;
  /** Remember column widths in browser localStorage (ui-grid). */
  persistListKey?: string;
  /** Table layout only. Default true. */
  enableColumnResize?: boolean;
  rowClassName?: (row: T) => string;
  getNodeLabel: (row: T) => React.ReactNode;
  onToggleExpand: (row: T) => void;
  onRowClick?: (row: T) => void;
  isRowClickable?: (row: T) => boolean;
  onMove: (sourceId: string, targetId: string | null, position: TreeDropPosition) => Promise<void>;
  canDrop?: (sourceId: string, targetId: string | null, position: TreeDropPosition) => boolean;
  /** List-page scroll owner (e.g. collapsing toolbar). */
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

const DRAG_INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [data-no-drag]';

type BaseTreeGridHybridRowProps<T extends BaseTreeGridRow> = {
  row: T;
  expandedById: Record<string, boolean>;
  loadingByParent: Record<string, boolean>;
  hideExpandControls: boolean;
  showIdColumn: boolean;
  fieldColumns: Array<BaseTreeGridColumn<T>>;
  actionColumn?: BaseTreeGridColumn<T>;
  stackedActionsPlacement: GridCardActionsPlacement;
  stackedFieldLabels: 'inline' | 'stacked' | 'hidden';
  rowClassName?: (row: T) => string;
  getNodeLabel: (row: T) => React.ReactNode;
  onToggleExpand: (row: T) => void;
  onRowClick?: (row: T) => void;
  canClickRow: (row: T) => boolean;
};

function BaseTreeGridHybridRowInner<T extends BaseTreeGridRow>({
  row,
  expandedById,
  loadingByParent,
  hideExpandControls,
  showIdColumn,
  fieldColumns,
  actionColumn,
  stackedActionsPlacement,
  stackedFieldLabels = 'inline',
  rowClassName,
  getNodeLabel,
  onToggleExpand,
  onRowClick,
  canClickRow,
}: BaseTreeGridHybridRowProps<T>) {
  const TREE_INDENT = 20;
  const cultureDirection = useOptionalCulture()?.direction ?? 'ltr';
  const idColumnDirectionChrome = useMemo(
    () => resolveTreeGridIdColumnDirectionChrome(cultureDirection),
    [cultureDirection],
  );
  const nodeColumnDirectionChrome = useMemo(
    () => resolveTreeGridNodeColumnDirectionChrome(cultureDirection),
    [cultureDirection],
  );
  const isExpanded = Boolean(expandedById[row.id]);
  const isLoadingChildren = Boolean(loadingByParent[row.id]);

  return (
    <div
      role="listitem"
      className={cn(
        APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS,
        'space-y-2 px-3 py-3 transition-colors',
        canClickRow(row) ? 'cursor-pointer hover:bg-slate-50' : '',
        rowClassName ? rowClassName(row) : '',
      )}
      onClick={(event) => {
        if (!canClickRow(row)) return;
        if ((event.target as HTMLElement).closest(DRAG_INTERACTIVE_SELECTOR)) {
          return;
        }
        onRowClick?.(row);
      }}
    >
      <div className="flex items-start gap-2" style={{ paddingInlineStart: `${row.depth * TREE_INDENT}px` }}>
        {!hideExpandControls && row.hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(row)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-cyan-600 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
            title={isExpanded ? 'Collapse' : 'Expand'}
            aria-label={isExpanded ? `Collapse ${row.id}` : `Expand ${row.id}`}
          >
            {isLoadingChildren ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isExpanded ? (
              <span aria-hidden="true" className="text-[17px] font-bold leading-none">-</span>
            ) : (
              <span aria-hidden="true" className="text-[17px] font-bold leading-none">+</span>
            )}
          </button>
        ) : !hideExpandControls ? (
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div
            className={cn(
              'text-sm',
              nodeColumnDirectionChrome.cellClassName,
              row.depth === 0 ? 'font-semibold text-slate-800' : 'text-slate-700',
            )}
            dir={nodeColumnDirectionChrome.cellDir}
          >
            {getNodeLabel(row)}
          </div>
          {showIdColumn ? (
            <div
              className={cn('font-mono text-[11px] text-slate-400', idColumnDirectionChrome.cellClassName)}
              dir={idColumnDirectionChrome.cellDir}
            >
              {row.id}
            </div>
          ) : null}
        </div>
        {actionColumn && stackedActionsPlacement === 'header' ? (
          <div className="flex shrink-0 items-center">
            {actionColumn.renderCell(row)}
          </div>
        ) : null}
      </div>

      <div className={cn(
        'ps-1',
        stackedFieldLabels === 'stacked' ? 'space-y-2' : 'space-y-1.5',
        stackedFieldLabels !== 'hidden' && 'divide-y divide-slate-100',
      )}>
        {fieldColumns.map((column) => {
          const columnChrome = resolveTreeGridDataColumnDirectionChrome(column, cultureDirection);
          return stackedFieldLabels === 'hidden' ? (
            <div
              key={column.key}
              className={cn('min-w-0 text-slate-700', columnChrome.cellClassName)}
              dir={columnChrome.cellDir}
            >
              {column.renderCell(row)}
            </div>
          ) : stackedFieldLabels === 'stacked' ? (
            <div key={column.key} className="flex flex-col gap-0.5 py-1 first:pt-0 last:pb-0">
              <span
                className={cn('font-medium text-slate-500', columnChrome.headerClassName)}
                dir={columnChrome.headerDir}
              >
                {column.header}
              </span>
              <span
                className={cn('min-w-0 text-slate-700', columnChrome.cellClassName)}
                dir={columnChrome.cellDir}
              >
                {column.renderCell(row)}
              </span>
            </div>
          ) : (
            <div key={column.key} className="flex items-center justify-between gap-3 py-1 first:pt-0 last:pb-0">
              <span
                className={cn('shrink-0 font-medium text-slate-500', columnChrome.headerClassName)}
                dir={columnChrome.headerDir}
              >
                {column.header}
              </span>
              <span
                className={cn('min-w-0 text-slate-700', columnChrome.cellClassName)}
                dir={columnChrome.cellDir}
              >
                {column.renderCell(row)}
              </span>
            </div>
          );
        })}
      </div>

      {actionColumn && stackedActionsPlacement === 'footer' ? (
        <div className="flex justify-end pt-1">
          {actionColumn.renderCell(row)}
        </div>
      ) : null}
    </div>
  );
}

const BaseTreeGridHybridRow = memo(BaseTreeGridHybridRowInner) as typeof BaseTreeGridHybridRowInner;

export function BaseTreeGrid<T extends BaseTreeGridRow>({
  rows,
  columns,
  expandedById,
  loadingByParent,
  moveDisabled = false,
  hideExpandControls = false,
  showHeader = true,
  showIdColumn = true,
  nodeColumnHeader = 'Node',
  nodeColumnWidth,
  layout,
  stackedActionsPlacement = 'footer',
  stackedFieldLabels = 'inline',
  stickyHeader = true,
  persistListKey,
  enableColumnResize = true,
  rowClassName,
  getNodeLabel,
  onToggleExpand,
  onRowClick,
  isRowClickable,
  onMove,
  canDrop,
  onScroll,
}: BaseTreeGridProps<T>) {
  const t = useOptionalCultureT();
  const cultureDirection = useOptionalCulture()?.direction ?? 'ltr';
  const resolvedNodeColumnHeader = nodeColumnHeader === 'Node' ? t('treeGrid.column.node') : nodeColumnHeader;
  const idColumnHeader = t('treeGrid.column.id');
  const idColumnDirectionChrome = useMemo(
    () => resolveTreeGridIdColumnDirectionChrome(cultureDirection),
    [cultureDirection],
  );
  const nodeColumnDirectionChrome = useMemo(
    () => resolveTreeGridNodeColumnDirectionChrome(cultureDirection),
    [cultureDirection],
  );
  const viewportTier = useViewportTier();
  const resolvedLayout = layout ?? (isCompactChromeTier(viewportTier) ? 'hybrid-stacked' : 'table');
  const columnResizeEnabled = enableColumnResize && resolvedLayout === 'table';

  const layoutColumnDefs = useMemo(
    () => buildTreeGridLayoutColumnDefs({
      showIdColumn,
      nodeColumnHeader: resolvedNodeColumnHeader,
      columns: columns.map((column) => ({
        key: column.key,
        header: column.header,
        resizable: column.resizable,
      })),
    }),
    [columns, resolvedNodeColumnHeader, showIdColumn],
  );

  const { layout: columnLayout, setLayout: commitColumnLayout } = useGridColumnLayout({
    columns: layoutColumnDefs,
    gridId: columnResizeEnabled ? persistListKey?.trim() || undefined : undefined,
  });

  const layoutColumnById = useMemo(
    () => new Map(layoutColumnDefs.map((column) => [column.id, column])),
    [layoutColumnDefs],
  );

  const layoutRef = useRef(columnLayout);
  layoutRef.current = columnLayout;

  const handleColumnResizeStart = useCallback(
    createTreeGridResizeHandler({
      getLayout: () => layoutRef.current,
      layoutColumns: layoutColumnDefs,
      onLayoutChange: (next) => commitColumnLayout(next, { source: 'resize' }),
    }),
    [commitColumnLayout, layoutColumnDefs],
  );

  const handleColumnResizeAutoFit = useCallback(
    createTreeGridColumnAutoFitHandler({
      getRoot: () => scrollRef.current,
      getLayout: () => layoutRef.current,
      layoutColumns: layoutColumnDefs,
      onLayoutChange: (next) => commitColumnLayout(next, { source: 'autoFit' }),
    }),
    [commitColumnLayout, layoutColumnDefs],
  );

  const defaultIdColumnStyle = useMemo(
    () => ({ width: '125px', minWidth: '125px', maxWidth: '125px' }),
    [],
  );

  const idColumnStyle = useMemo(() => {
    if (!showIdColumn) return undefined;
    const def = layoutColumnById.get(TREE_GRID_ID_COLUMN_ID);
    if (!def || !columnResizeEnabled) return defaultIdColumnStyle;
    return treeGridColumnWidthStyle(def, columnLayout, defaultIdColumnStyle);
  }, [columnLayout, columnResizeEnabled, defaultIdColumnStyle, layoutColumnById, showIdColumn]);

  const nodeColumnStyle = useMemo(() => {
    const def = layoutColumnById.get(TREE_GRID_NODE_COLUMN_ID);
    const fallback = nodeColumnWidth
      ? { width: `${nodeColumnWidth}px`, minWidth: `${nodeColumnWidth}px`, maxWidth: `${nodeColumnWidth}px` }
      : undefined;
    if (!columnResizeEnabled || !def) return fallback;
    return treeGridColumnWidthStyle(def, columnLayout, fallback);
  }, [columnLayout, columnResizeEnabled, layoutColumnById, nodeColumnWidth]);

  const canClickRow = useCallback((row: T) => (
    Boolean(onRowClick) && (isRowClickable ? isRowClickable(row) : true)
  ), [isRowClickable, onRowClick]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<TreeDropPosition>('inside');
  const [isDropping, setIsDropping] = useState(false);
  const draggingIdRef = useRef<string | null>(null);

  const canDropHere = useCallback((sourceId: string, targetId: string | null, position: TreeDropPosition) => {
    if (moveDisabled || isDropping) return false;
    if (!sourceId) return false;
    if (targetId && targetId === sourceId) return false;
    if (!canDrop) return true;
    return canDrop(sourceId, targetId, position);
  }, [canDrop, isDropping, moveDisabled]);

  const resolveDropPosition = useCallback((
    event: React.DragEvent<HTMLTableRowElement>,
    sourceId: string,
    targetRow: T,
  ): TreeDropPosition | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / Math.max(rect.height, 1);

    return resolveTreeDropPosition(relativeY, (candidate) => (
      canDropHere(sourceId, targetRow.id, candidate)
    ));
  }, [canDropHere]);

  const clearDragState = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    setDropPosition('inside');
  }, []);

  const getActiveDragId = useCallback((event: React.DragEvent): string | null => {
    if (draggingIdRef.current) return draggingIdRef.current;
    const fromTransfer = event.dataTransfer.getData('text/plain');
    return fromTransfer || draggingIdRef.current;
  }, []);

  const commitDrop = useCallback(async (sourceId: string, targetId: string | null, position: TreeDropPosition) => {
    if (!canDropHere(sourceId, targetId, position)) return;
    setIsDropping(true);
    try {
      await onMove(sourceId, targetId, position);
    } finally {
      setIsDropping(false);
      clearDragState();
    }
  }, [canDropHere, clearDragState, onMove]);

  const handleRowDragOver = useCallback((event: React.DragEvent<HTMLTableRowElement>, row: T) => {
    if (moveDisabled || isDropping) return;
    const sourceId = getActiveDragId(event);
    if (!sourceId) return;

    const nextDropPosition = resolveDropPosition(event, sourceId, row);
    if (!nextDropPosition) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(row.id);
    setDropPosition(nextDropPosition);
  }, [getActiveDragId, isDropping, moveDisabled, resolveDropPosition]);

  const handleRowDrop = useCallback((event: React.DragEvent<HTMLTableRowElement>, row: T) => {
    if (moveDisabled || isDropping) return;
    const sourceId = getActiveDragId(event);
    if (!sourceId) return;

    const nextDropPosition = resolveDropPosition(event, sourceId, row);
    if (!nextDropPosition) return;

    event.preventDefault();
    event.stopPropagation();
    void commitDrop(sourceId, row.id, nextDropPosition);
  }, [commitDrop, getActiveDragId, isDropping, moveDisabled, resolveDropPosition]);

  const handleRowDragStart = useCallback((event: React.DragEvent<HTMLTableRowElement>, row: T) => {
    if (moveDisabled || isDropping) return;
    if ((event.target as HTMLElement).closest(DRAG_INTERACTIVE_SELECTOR)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.id);
    draggingIdRef.current = row.id;
    setDraggingId(row.id);
  }, [isDropping, moveDisabled]);

  const actionColumn = stackedActionsPlacement === 'none'
    ? undefined
    : columns.find((column) => column.key === 'actions');
  const stackedTier = resolvedLayout === 'hybrid-stacked' ? viewportTier : undefined;
  const fieldColumns = columns.filter((column) => {
    if (column.key === 'actions') {
      return false;
    }
    if (stackedTier && isColumnHiddenAtViewport(column.hideBelow, stackedTier)) {
      return false;
    }
    return true;
  });

  const applyLayoutColumnWidth = useCallback((
    column: BaseTreeGridColumn<T>,
    columnId: string,
  ): BaseTreeGridColumn<T> => {
    const def = layoutColumnById.get(columnId);
    if (!def || !columnResizeEnabled) {
      return column;
    }
    const style = treeGridColumnWidthStyle(def, columnLayout, column.style);
    const headerStyle = treeGridColumnWidthStyle(
      def,
      columnLayout,
      column.headerStyle ?? column.style,
    );
    return { ...column, style, headerStyle };
  }, [columnLayout, columnResizeEnabled, layoutColumnById]);

  const tableFieldColumns = useMemo(
    () => fieldColumns.map((column) => applyLayoutColumnWidth(column, column.key)),
    [applyLayoutColumnWidth, fieldColumns],
  );

  const tableActionColumn = useMemo(
    () => (actionColumn ? applyLayoutColumnWidth(actionColumn, actionColumn.key) : undefined),
    [actionColumn, applyLayoutColumnWidth],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const fallbackGetScrollElement = useTreeGridScrollParent(scrollAnchorRef);
  const dragActive = Boolean(draggingId);
  const shouldVirtualizeTable = resolvedLayout === 'table' && shouldVirtualizeTreeGridRows(rows.length, dragActive, moveDisabled);
  const shouldVirtualizeHybrid = resolvedLayout === 'hybrid-stacked' && shouldVirtualizeTreeGridRows(rows.length, dragActive, moveDisabled);
  const usesVirtualScroll = shouldVirtualizeTable || shouldVirtualizeHybrid;

  const getScrollElement = useCallback(() => {
    if (usesVirtualScroll) {
      return scrollRef.current;
    }
    return fallbackGetScrollElement();
  }, [fallbackGetScrollElement, usesVirtualScroll]);

  const tableRemeasureToken = useMemo(() => (
    [
      rows.length,
      rows.map((row) => row.id).join('\0'),
      JSON.stringify(expandedById),
      dropTargetId ?? '',
      dropPosition,
      draggingId ?? '',
      fieldColumns.length,
    ].join('|')
  ), [draggingId, dropPosition, dropTargetId, expandedById, fieldColumns.length, rows]);

  const hybridRemeasureToken = useMemo(() => (
    [
      rows.length,
      rows.map((row) => row.id).join('\0'),
      JSON.stringify(expandedById),
      fieldColumns.length,
    ].join('|')
  ), [expandedById, fieldColumns.length, rows]);

  const tableVirtualizer = useTreeGridRowVirtualizer({
    rowCount: rows.length,
    enabled: shouldVirtualizeTable,
    getScrollElement,
    remeasureToken: tableRemeasureToken,
  });

  const hybridVirtualizer = useTreeGridRowVirtualizer({
    rowCount: rows.length,
    enabled: shouldVirtualizeHybrid,
    getScrollElement,
    remeasureToken: hybridRemeasureToken,
  });

  const tableColSpan = (showIdColumn ? 1 : 0) + 1 + fieldColumns.length + (actionColumn ? 1 : 0);

  const renderTableRow = (row: T, virtualIndex?: number) => (
    <BaseTreeGridTableRow
      key={row.id}
      row={row}
      virtualIndex={virtualIndex}
      measureRef={virtualIndex === undefined ? undefined : tableVirtualizer.rowVirtualizer.measureElement}
      showIdColumn={showIdColumn}
      idColumnStyle={idColumnStyle}
      idColumnDirectionChrome={idColumnDirectionChrome}
      nodeColumnDirectionChrome={nodeColumnDirectionChrome}
      nodeColumnStyle={nodeColumnStyle}
      fieldColumns={tableFieldColumns}
      actionColumn={tableActionColumn}
      hideExpandControls={hideExpandControls}
      moveDisabled={moveDisabled}
      isDropping={isDropping}
      isExpanded={Boolean(expandedById[row.id])}
      isLoadingChildren={Boolean(loadingByParent[row.id])}
      isDragSource={draggingId === row.id}
      isDropTarget={dropTargetId === row.id}
      dropPosition={dropPosition}
      rowClassName={rowClassName}
      getNodeLabel={getNodeLabel}
      canClickRow={canClickRow}
      onToggleExpand={onToggleExpand}
      onRowClick={onRowClick}
      onDragStart={handleRowDragStart}
      onDragEnd={clearDragState}
      onDragOver={handleRowDragOver}
      onDrop={handleRowDrop}
    />
  );

  const renderHybridRow = (row: T, virtualIndex?: number) => (
    <div
      key={row.id}
      data-index={virtualIndex}
      ref={virtualIndex === undefined ? undefined : hybridVirtualizer.rowVirtualizer.measureElement}
    >
      <BaseTreeGridHybridRow
        row={row}
        expandedById={expandedById}
        loadingByParent={loadingByParent}
        hideExpandControls={hideExpandControls}
        showIdColumn={showIdColumn}
        fieldColumns={fieldColumns}
        actionColumn={actionColumn}
        stackedActionsPlacement={stackedActionsPlacement}
        stackedFieldLabels={stackedFieldLabels}
        rowClassName={rowClassName}
        getNodeLabel={getNodeLabel}
        onToggleExpand={onToggleExpand}
        onRowClick={onRowClick}
        canClickRow={canClickRow}
      />
    </div>
  );

  if (resolvedLayout === 'hybrid-stacked') {
    const hybridBody = (
      <div role="list" className="divide-y divide-slate-100 text-xs">
        <TreeGridVirtualHybridPadding paddingTop={hybridVirtualizer.paddingTop} />
        {shouldVirtualizeHybrid
          ? hybridVirtualizer.virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            return renderHybridRow(row, virtualRow.index);
          })
          : rows.map((row) => renderHybridRow(row))}
        <TreeGridVirtualHybridPadding paddingBottom={hybridVirtualizer.paddingBottom} />
      </div>
    );

    if (usesVirtualScroll) {
      return (
        <div
          ref={scrollRef}
          className="h-full min-h-0 overflow-auto"
          onScroll={onScroll}
          data-table-grid-scroll-owner="self"
        >
          {hybridBody}
        </div>
      );
    }

    return (
      <div ref={scrollAnchorRef} className="contents">
        {hybridBody}
      </div>
    );
  }

  const tableClassName = cn(APP_TABLE_GRID_TABLE_CLASS, 'text-xs table-fixed');

  const isColumnResizable = (columnId: string) => {
    if (!columnResizeEnabled) return false;
    const def = layoutColumnById.get(columnId);
    if (!def || def.layout === false) return false;
    return def.layout?.resizable !== false;
  };

  const tableColGroup = (
    <colgroup>
      {showIdColumn ? <col style={idColumnStyle} /> : null}
      <col style={nodeColumnStyle} />
      {tableFieldColumns.map((column) => (
        <col key={column.key} style={column.style} />
      ))}
      {tableActionColumn ? <col key={tableActionColumn.key} style={tableActionColumn.style} /> : null}
    </colgroup>
  );

  const tableHeaderRow = showHeader ? (
    <tr>
      {showIdColumn ? (
        <BaseTreeGridHeaderCell
          columnId={TREE_GRID_ID_COLUMN_ID}
          className={idColumnDirectionChrome.headerClassName}
          dir={idColumnDirectionChrome.headerDir}
          style={idColumnStyle}
          resizable={isColumnResizable(TREE_GRID_ID_COLUMN_ID)}
          onResizeStart={handleColumnResizeStart}
          onResizeAutoFit={handleColumnResizeAutoFit}
        >
          {idColumnHeader}
        </BaseTreeGridHeaderCell>
      ) : null}
      <BaseTreeGridHeaderCell
        columnId={TREE_GRID_NODE_COLUMN_ID}
        className={nodeColumnDirectionChrome.headerClassName}
        dir={nodeColumnDirectionChrome.headerDir}
        style={nodeColumnStyle}
        resizable={isColumnResizable(TREE_GRID_NODE_COLUMN_ID)}
        onResizeStart={handleColumnResizeStart}
        onResizeAutoFit={handleColumnResizeAutoFit}
      >
        {resolvedNodeColumnHeader}
      </BaseTreeGridHeaderCell>
      {tableFieldColumns.map((column) => {
        const headerChrome = resolveTreeGridDataColumnDirectionChrome(column, cultureDirection);
        return (
          <BaseTreeGridHeaderCell
            key={column.key}
            columnId={column.key}
            className={headerChrome.headerClassName}
            dir={headerChrome.headerDir}
            style={column.headerStyle}
            resizable={isColumnResizable(column.key)}
            onResizeStart={handleColumnResizeStart}
            onResizeAutoFit={handleColumnResizeAutoFit}
          >
            {column.header}
          </BaseTreeGridHeaderCell>
        );
      })}
      {tableActionColumn ? (() => {
        const headerChrome = resolveTreeGridDataColumnDirectionChrome(tableActionColumn, cultureDirection);
        return (
          <BaseTreeGridHeaderCell
            columnId={tableActionColumn.key}
            className={headerChrome.headerClassName}
            dir={headerChrome.headerDir}
            style={tableActionColumn.headerStyle}
            resizable={false}
          >
            {tableActionColumn.header}
          </BaseTreeGridHeaderCell>
        );
      })() : null}
    </tr>
  ) : null;

  const tableBodyContent = (
    <>
      <TreeGridVirtualTablePadding
        colSpan={tableColSpan}
        paddingTop={tableVirtualizer.paddingTop}
      />
      {shouldVirtualizeTable
        ? tableVirtualizer.virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return renderTableRow(row, virtualRow.index);
        })
        : rows.map((row) => renderTableRow(row))}
      <TreeGridVirtualTablePadding
        colSpan={tableColSpan}
        paddingBottom={tableVirtualizer.paddingBottom}
      />
    </>
  );

  const handleTbodyDragOver = useCallback((event: React.DragEvent<HTMLTableSectionElement>) => {
    if (moveDisabled || isDropping) return;
    const sourceId = getActiveDragId(event);
    if (!sourceId) return;

    const targetRow = (event.target as HTMLElement).closest('tr[data-row-id]');
    if (targetRow) return;
    if (!canDropHere(sourceId, null, 'after')) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(null);
    setDropPosition('after');
  }, [canDropHere, getActiveDragId, isDropping, moveDisabled]);

  const handleTbodyDrop = useCallback((event: React.DragEvent<HTMLTableSectionElement>) => {
    if (moveDisabled || isDropping) return;
    const sourceId = getActiveDragId(event);
    if (!sourceId) return;

    const targetRow = (event.target as HTMLElement).closest('tr[data-row-id]');
    if (targetRow) return;

    event.preventDefault();
    void commitDrop(sourceId, null, 'after');
  }, [commitDrop, getActiveDragId, isDropping, moveDisabled]);

  const tableTbodyDragProps = useMemo(() => ({
    onDragOver: handleTbodyDragOver,
    onDrop: handleTbodyDrop,
  }), [handleTbodyDragOver, handleTbodyDrop]);

  const tableTbody = (
    <tbody
      className="divide-y divide-slate-100"
      {...tableTbodyDragProps}
    >
      {tableBodyContent}
    </tbody>
  );

  const tableBody = (
    <table className={tableClassName}>
      {tableColGroup}
      {showHeader ? (
        <thead className={cn('bg-slate-50 border-b border-slate-200', stickyHeader && APP_TABLE_GRID_THEAD_CLASS)}>
          {tableHeaderRow}
        </thead>
      ) : null}
      {tableTbody}
    </table>
  );

  if (usesVirtualScroll) {
    return (
      <div
        ref={scrollRef}
        className="h-full min-h-0 overflow-auto"
        onScroll={onScroll}
        data-table-grid-scroll-owner="self"
      >
        {tableBody}
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-0 overflow-auto"
      onScroll={onScroll}
      data-table-grid-scroll-owner="self"
    >
      {tableBody}
    </div>
  );
}
