import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { GRID_VIRTUALIZE_ROW_THRESHOLD } from '../lib/gridVirtualizationConstants';
import { resolveCardLayout } from '../lib/appTableGridCardLayout';
import {
  type GridCardBelowTier,
  type GridPresentationMode,
} from '../lib/appTableGridPresentation';
import {
  isColumnHiddenAtViewport,
  resolveGridCardActionsMaxVisible,
} from '../lib/gridRowActions';
import type { ViewportTier } from '../lib/viewportTokens';
import {
  freezeLeadingDataColumn,
  resolveGridCompactViewport,
  type GridCompactViewportConfig,
} from '../lib/gridCompactViewport';
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
  type GridQueryChangeMeta,
  type GridQueryState,
} from '../lib/appTableGridQuery';
import {
  applyColumnLayout,
  applyColumnWidths,
  areColumnLayoutsEqual,
  buildColumnLayoutDefinitionSignature,
  createDefaultColumnLayout,
  buildAppTableGridColumnWidthStyle,
  resolveColumnLayoutOptions,
  resolveColumnMinWidthPx,
  sanitizeColumnLayout,
  setColumnWidth,
  type GridColumnLayoutChangeMeta,
  type GridColumnLayoutState,
} from '../lib/appTableGridColumnLayout';
import { measureAppTableGridColumnAutoWidth } from '../lib/appTableGridColumnAutoWidth';
import {
  flushStoredColumnLayout,
  persistStoredColumnLayout,
  resolveStoredColumnLayout,
} from '../lib/listPreferencesStorage';
import { useViewportTier } from '../lib/useViewportTier';
import {
  appTableGridCellPaddingXStyle,
  isAppTableGridHeroChrome,
  resolveAppTableGridCellPaddingXPx,
  resolveAppTableGridChrome,
  resolveAppTableGridChromeBorderWidthPx,
  resolveAppTableGridChromeMarginPx,
  resolveAppTableGridFillHost,
  resolveAppTableGridHeaderQueryControlsVisibility,
  resolveAppTableGridScrollGutter,
  appTableGridOverlayScrollInsetStyle,
  usesAppTableGridOverlayScrollInset,
  type AppTableGridChrome,
  type AppTableGridHeaderQueryControlsVisibility,
  type AppTableGridScrollGutter,
  type AppTableGridScrollOwner,
} from '../lib/appTableGridShell';
import {
  APP_TABLE_GRID_CONTENT_HOST_CLASS,
  APP_TABLE_GRID_CONTENT_SCROLL_CLASS,
  APP_TABLE_GRID_FILL_HOST_CLASS,
  APP_TABLE_GRID_HERO_THEAD_CLASS,
  APP_TABLE_GRID_HERO_THEAD_BAND_CLASS,
  APP_TABLE_GRID_JOINED_SHELL_CLASS,
  APP_TABLE_GRID_ROW_CLASS,
  APP_TABLE_GRID_SCROLL_CLASS,
  APP_TABLE_GRID_SCROLL_OVERLAY_CLASS,
  APP_TABLE_GRID_STATE_PANEL_CLASS,
  APP_TABLE_GRID_TABLE_CLASS,
  APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CLASS,
  APP_TABLE_GRID_TABLE_SCROLL_INNER_CLASS,
  APP_TABLE_GRID_TBODY_CLASS,
  APP_TABLE_GRID_THEAD_CLASS,
  APP_TABLE_GRID_THEAD_BAND_CLASS,
  HERO_TABLE_HEADER_CORNER_CLASS,
} from './surfaceClasses';
import {
  AppTableGridOverlayScrollbars,
  AppTableGridScrollOverflowFrame,
  useTableScrollOverflowHint,
} from './AppTableGridScrollOverflow';
import {
  AppTableGridCardBody,
} from './AppTableGridCardBody';
import type { GridRowActionItem } from './AppGridRowActions';
import {
  APP_TABLE_GRID_HEADER_ROW_GROUP_CLASS,
  AppTableGridColumnHeader,
} from './AppTableGridColumnHeader';
import { AppTableGridColumnLayoutControl } from './AppTableGridColumnLayoutControl';
import { AppTableGridRow } from './AppTableGridRow';
import { AppTableGridVirtualColumnBody } from './AppTableGridVirtualColumnBody';
import {
  AppTableGridSplitTableLayout,
  buildAppTableGridColGroup,
} from './AppTableGridSplitTableLayout';
import {
  resolvePinnedColumnStyles,
  mergePinnedCellStyle,
} from '../lib/appTableGridPinnedColumns';
import { UiCheckbox } from './HeroFieldControls';
import { AppTableGridCultureDirectionProvider } from './AppTableGridCultureDirectionContext';
import { AppTableGridScrollChromeProvider } from './AppTableGridScrollChromeContext';
import { useComposeListPageGridScroll } from '../lib/useComposeListPageGridScroll';

export type AppTableGridSize = 'xs' | 'sm';

type AppTableGridBaseProps = {
  footer?: React.ReactNode;
  size?: AppTableGridSize;
  className?: string;
  scrollClassName?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  tableClassName?: string;
  theadClassName?: string;
  /** Keeps the header fixed inside the grid scroll owner. Default true. */
  stickyHeader?: boolean;
  /**
   * `true` (default) — fill the parent (Height 100%, CRUD list composition).
   * `false` — hug row content. Ignored when `scrollOwner` is `panel`.
   */
  fillHeight?: boolean;
  /**
   * `self` — internal overflow (default, page lists).
   * `panel` — no internal vertical scroll; parent panel scrolls.
   */
  scrollOwner?: AppTableGridScrollOwner;
  /**
   * `overlay` (default) — overlay thumbs; native bars hidden (no layout gutter when overflow toggles).
   * `native` — OS scrollbars reserve width; split header syncs padding to the vertical gutter.
   */
  scrollGutter?: AppTableGridScrollGutter;
  /**
   * Visual treatment on this same grid. `classic` (default) is the flush page list.
   * `hero` is the joined 8px card, airy rows, and hero paging band.
   */
  chrome?: AppTableGridChrome;
  /**
   * Outer inset in px around the grid card (including paging). Default 0
   * so page lists stay flush under the toolbar.
   */
  margin?: number;
  /** Outer outline thickness in px around grid + paging. Default 0. */
  borderWidth?: number;
  /**
   * Left and right cell padding in px for every column. Default 5.
   * Applied through `--app-table-grid-cell-px` on the grid shell.
   */
  cellPaddingX?: number;
  /** Accessible name for the table. */
  ariaLabel?: string;
  /** When false, disables row virtualization (e.g. member face cells in modals). Default: true except panel scroll owner. */
  virtualizeRows?: boolean;
  tbodyClassName?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  loadingContent?: React.ReactNode;
  errorContent?: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyContent?: React.ReactNode;
  gridQueryMode?: GridColumnQueryMode;
  query?: GridQueryState;
  defaultQuery?: GridQueryState;
  onQueryChange?: (query: GridQueryState, meta: GridQueryChangeMeta) => void;
  /** Hide/reorder/pin plus the column-layout menu. Default false. Column resize is on by default. */
  enableColumnLayout?: boolean;
  columnLayout?: GridColumnLayoutState;
  defaultColumnLayout?: GridColumnLayoutState;
  onColumnLayoutChange?: (layout: GridColumnLayoutState, meta: GridColumnLayoutChangeMeta) => void;
  columnLayoutControl?: React.ReactNode;
  showColumnLayoutControl?: boolean;
  /** When set, column widths (and hide/reorder when layout is on) restore from browser localStorage for this list key. */
  persistListKey?: string;
  presentation?: GridPresentationMode;
  cardBelow?: GridCardBelowTier;
  /** Row actions for card footer when `getCardRowActions` is set. */
  getCardRowActions?: (row: unknown) => readonly GridRowActionItem[];
  cardActionsMaxVisible?: number;
  /** Override detected viewport (Base Components preview / tests). */
  viewportTier?: ViewportTier;
  /** Per-tier compact viewport policy (phone/tablet). Overlay on `presentation` / `cardBelow`. */
  compact?: GridCompactViewportConfig;
  /** Card list host grid classes when `presentation` resolves to cards (overrides tier column count). */
  cardListHostClassName?: string;
  /**
   * Sort/filter header affordances when a column enables sort and/or filter.
   * `hover` (default) — overlay on column header hover; active sort column also reveals on any header in the row; pinned while a filter is active or the filter popover is open.
   * `always` — inline next to the column label.
   */
  headerQueryControlsVisibility?: AppTableGridHeaderQueryControlsVisibility;
};

type AppTableGridComposedProps = AppTableGridBaseProps & {
  header: React.ReactNode;
  children: React.ReactNode;
  columns?: never;
  rows?: never;
  getRowKey?: never;
};

type AppTableGridSelectionMode = 'none' | 'single' | 'multiple';

type AppTableGridColumnModeProps<TRow> = AppTableGridBaseProps & {
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  rows: ReadonlyArray<TRow>;
  getRowKey: (row: TRow) => string | number;
  onRowClick?: (row: TRow) => void;
  getRowClassName?: (row: TRow) => string | undefined;
  /** Row selection (Phase 35). Default `'none'` — no selection chrome. */
  selectionMode?: AppTableGridSelectionMode;
  selectedKeys?: ReadonlyArray<string | number> | ReadonlySet<string | number>;
  onSelectionChange?: (keys: string[]) => void;
  /** Optional class on row/header selection checkboxes (no label children). */
  selectionControlClassName?: string;
  header?: never;
  children?: never;
};

export type AppTableGridProps<TRow = unknown> =
  | AppTableGridComposedProps
  | AppTableGridColumnModeProps<TRow>;

function isColumnModeProps<TRow>(
  props: AppTableGridProps<TRow>,
): props is AppTableGridColumnModeProps<TRow> {
  return Array.isArray(props.columns) && Array.isArray(props.rows) && typeof props.getRowKey === 'function';
}

function resolveAppTableGridTableClassName(
  scrollOwner: AppTableGridScrollOwner,
  scrollGutter: AppTableGridScrollGutter | undefined,
  ...parts: (string | undefined | false)[]
): string {
  return cn(
    APP_TABLE_GRID_TABLE_CLASS,
    usesAppTableGridOverlayScrollInset(scrollOwner, scrollGutter)
      && APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CLASS,
    ...parts,
  );
}

function resolveAppTableGridScrollClassName(
  scrollOwner: AppTableGridScrollOwner | undefined,
  fillHeight: boolean | undefined,
  scrollGutter: AppTableGridScrollGutter | undefined,
  scrollClassName?: string,
): string {
  const fillHost = resolveAppTableGridFillHost(scrollOwner, fillHeight);
  const gutter = resolveAppTableGridScrollGutter(scrollGutter);
  return cn(
    scrollOwner === 'panel'
      ? 'min-w-0 overflow-visible'
      : fillHost
        ? APP_TABLE_GRID_SCROLL_CLASS
        : APP_TABLE_GRID_CONTENT_SCROLL_CLASS,
    scrollOwner !== 'panel' && gutter === 'overlay' && APP_TABLE_GRID_SCROLL_OVERLAY_CLASS,
    scrollClassName,
  );
}

type AppTableGridScrollViewportProps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollOwner: AppTableGridScrollOwner;
  scrollGutter: AppTableGridScrollGutter;
  className: string;
  children: React.ReactNode;
  role?: React.AriaRole;
  tabIndex?: number;
  'aria-label'?: string;
  'data-table-grid-scroll-owner'?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
};

function AppTableGridScrollViewport({
  scrollRef,
  scrollOwner,
  scrollGutter,
  className,
  children,
  role,
  tabIndex,
  'aria-label': ariaLabel,
  'data-table-grid-scroll-owner': dataScrollOwner,
  onScroll,
  onMouseEnter,
  onMouseLeave,
}: AppTableGridScrollViewportProps) {
  const viewport = (
    <div
      ref={scrollRef}
      className={className}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      data-table-grid-scroll-owner={dataScrollOwner}
      onScroll={onScroll}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );

  if (scrollOwner === 'panel' || scrollGutter === 'native') {
    return viewport;
  }

  return (
    <div className="relative min-h-0 min-w-0 flex flex-1 flex-col">
      {viewport}
      <AppTableGridOverlayScrollbars viewportRef={scrollRef} />
    </div>
  );
}

function wrapAppTableGridShell({
  scrollOwner = 'self',
  scrollGutter,
  fillHeight = true,
  chrome,
  margin,
  borderWidth,
  cellPaddingX,
  className,
  footer,
  scrollBody,
}: {
  scrollOwner?: AppTableGridScrollOwner;
  scrollGutter?: AppTableGridScrollGutter;
  fillHeight?: boolean;
  chrome?: AppTableGridChrome;
  margin?: number;
  borderWidth?: number;
  cellPaddingX?: number;
  className?: string;
  footer?: React.ReactNode;
  scrollBody: React.ReactNode;
}) {
  const fillHost = resolveAppTableGridFillHost(scrollOwner, fillHeight);
  const resolvedChrome = resolveAppTableGridChrome(chrome);
  const isHeroChrome = resolvedChrome === 'hero';
  const marginPx = resolveAppTableGridChromeMarginPx(resolvedChrome, margin);
  const borderWidthPx = resolveAppTableGridChromeBorderWidthPx(resolvedChrome, borderWidth);
  const cellPaddingXPx = resolveAppTableGridCellPaddingXPx(cellPaddingX);
  const cellPxStyle = {
    ...appTableGridCellPaddingXStyle(cellPaddingXPx),
    ...(usesAppTableGridOverlayScrollInset(scrollOwner, scrollGutter)
      ? appTableGridOverlayScrollInsetStyle()
      : {}),
  };
  const lastColumnOverlayInset = usesAppTableGridOverlayScrollInset(scrollOwner, scrollGutter);
  const hasFooter = Boolean(footer);
  const needsChrome = isHeroChrome || marginPx > 0 || borderWidthPx > 0;
  const hosted = hasFooter || needsChrome ? (
    <div
      className={cn(
        fillHost ? APP_TABLE_GRID_FILL_HOST_CLASS : APP_TABLE_GRID_CONTENT_HOST_CLASS,
        needsChrome && APP_TABLE_GRID_JOINED_SHELL_CLASS,
      )}
      style={{
        ...cellPxStyle,
        ...(borderWidthPx > 0 ? { borderWidth: borderWidthPx, borderStyle: 'solid' as const } : {}),
      }}
      data-table-grid-border-width={borderWidthPx}
      data-table-grid-chrome={resolvedChrome}
      data-table-grid-cell-px={cellPaddingXPx}
    >
      <AppTableGridScrollChromeProvider lastColumnOverlayInset={lastColumnOverlayInset}>
        {scrollBody}
      </AppTableGridScrollChromeProvider>
      {hasFooter ? (
        <div className={cn('w-full shrink-0', fillHost && 'mt-auto')}>{footer}</div>
      ) : null}
    </div>
  ) : (
    <div
      className="contents"
      style={cellPxStyle}
      data-table-grid-cell-px={cellPaddingXPx}
    >
      <AppTableGridScrollChromeProvider lastColumnOverlayInset={lastColumnOverlayInset}>
        {scrollBody}
      </AppTableGridScrollChromeProvider>
    </div>
  );

  if (!needsChrome && !className) {
    return hosted;
  }

  return (
    <div
      className={cn(
        'box-border flex w-full min-w-0 flex-col',
        fillHost && 'h-full min-h-0 flex-1',
        className,
      )}
      style={{
        ...cellPxStyle,
        ...(marginPx > 0 ? { padding: marginPx } : {}),
      }}
      data-table-grid-margin={marginPx}
      data-table-grid-scroll-owner={scrollOwner}
      data-table-grid-chrome={resolvedChrome}
      data-table-grid-cell-px={cellPaddingXPx}
    >
      {hosted}
    </div>
  );
}

function AppTableGridColumnBody<TRow>({
  columns,
  displayRows,
  getRowKey,
  scrollRef,
  onRowClick,
  getRowClassName,
  pinnedStyles,
  virtualize = true,
  chrome,
}: {
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  displayRows: ReadonlyArray<TRow>;
  getRowKey: (row: TRow) => string | number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onRowClick?: (row: TRow) => void;
  getRowClassName?: (row: TRow) => string | undefined;
  pinnedStyles?: ReadonlyMap<string, React.CSSProperties>;
  virtualize?: boolean;
  chrome?: AppTableGridChrome;
}) {
  const shouldVirtualize = virtualize && displayRows.length >= GRID_VIRTUALIZE_ROW_THRESHOLD;

  if (shouldVirtualize) {
    return (
      <AppTableGridVirtualColumnBody
        scrollRef={scrollRef}
        columns={columns}
        displayRows={displayRows}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
        getRowClassName={getRowClassName}
        pinnedStyles={pinnedStyles}
        chrome={chrome}
      />
    );
  }

  return (
    <>
      {displayRows.map((row) => (
        <AppTableGridRow
          key={getRowKey(row)}
          row={row}
          columns={columns}
          pinnedStyles={pinnedStyles}
          chrome={chrome}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={cn(onRowClick ? 'cursor-pointer' : undefined, getRowClassName?.(row))}
        />
      ))}
    </>
  );
}

const SELECTION_COLUMN_ID = '__selection__';

const normalizeKeySet = (
  value: ReadonlyArray<string | number> | ReadonlySet<string | number> | undefined,
): Set<string> => {
  if (!value) {
    return new Set();
  }
  if (value instanceof Set) {
    return new Set([...value].map((entry) => String(entry)));
  }
  return new Set([...value].map((entry) => String(entry)));
};

function AppTableGridColumnMode<TRow>({
  columns,
  rows,
  getRowKey,
  footer,
  size = 'xs',
  className,
  scrollClassName,
  onScroll,
  tableClassName,
  theadClassName,
  stickyHeader = true,
  fillHeight = true,
  scrollOwner = 'self',
  scrollGutter,
  chrome,
  margin,
  borderWidth,
  cellPaddingX,
  ariaLabel,
  virtualizeRows,
  tbodyClassName,
  isLoading = false,
  loadingMessage = 'Loading...',
  loadingContent,
  errorContent,
  isEmpty,
  emptyMessage = 'No records found.',
  emptyContent,
  gridQueryMode = 'client',
  query: controlledQuery,
  defaultQuery = EMPTY_GRID_QUERY,
  onQueryChange,
  enableColumnLayout = false,
  columnLayout: controlledColumnLayout,
  defaultColumnLayout,
  onColumnLayoutChange,
  columnLayoutControl,
  showColumnLayoutControl = true,
  persistListKey,
  presentation = 'auto',
  cardBelow = 'tablet',
  getCardRowActions,
  cardActionsMaxVisible,
  viewportTier: viewportTierProp,
  compact,
  cardListHostClassName,
  headerQueryControlsVisibility,
  onRowClick,
  getRowClassName,
  selectionMode = 'none',
  selectedKeys,
  onSelectionChange,
  selectionControlClassName,
}: AppTableGridColumnModeProps<TRow>) {
  const resolvedHeaderQueryControlsVisibility = resolveAppTableGridHeaderQueryControlsVisibility(
    headerQueryControlsVisibility,
  );
  const detectedTier = useViewportTier();
  const viewportTier = viewportTierProp ?? detectedTier;
  const resolvedCardActionsMaxVisible = useMemo(
    () => resolveGridCardActionsMaxVisible(viewportTier, cardActionsMaxVisible),
    [viewportTier, cardActionsMaxVisible],
  );
  const compactViewport = useMemo(
    () => resolveGridCompactViewport({
      presentation,
      cardBelow,
      compact,
      viewportTier,
    }),
    [cardBelow, compact, presentation, viewportTier],
  );
  const effectivePresentation = compactViewport.layout;
  const isCardPresentation = effectivePresentation === 'cards';
  const isTableScrollPresentation = effectivePresentation === 'table-scroll';
  const [uncontrolledQuery, setUncontrolledQuery] = useState<GridQueryState>(defaultQuery);
  const columnLayoutPersistKey = persistListKey?.trim() || undefined;
  const [uncontrolledColumnLayout, setUncontrolledColumnLayout] = useState<GridColumnLayoutState>(
    () => sanitizeColumnLayout(
      defaultColumnLayout
        ?? (columnLayoutPersistKey ? resolveStoredColumnLayout(columnLayoutPersistKey) : null)
        ?? createDefaultColumnLayout(columns),
      columns,
    ),
  );
  const isQueryControlled = controlledQuery !== undefined;
  const effectiveQuery = controlledQuery ?? uncontrolledQuery;
  const isColumnLayoutControlled = controlledColumnLayout !== undefined;
  const effectiveColumnLayout = controlledColumnLayout ?? uncontrolledColumnLayout;
  const columnLayoutDefinitionSignature = useMemo(
    () => buildColumnLayoutDefinitionSignature(columns),
    [columns],
  );

  useEffect(() => {
    if (isColumnLayoutControlled) {
      return;
    }

    setUncontrolledColumnLayout((current) => {
      const sanitized = sanitizeColumnLayout(current, columns);
      return areColumnLayoutsEqual(current, sanitized) ? current : sanitized;
    });
  }, [columnLayoutDefinitionSignature, columns, isColumnLayoutControlled]);

  const sanitizedColumnLayout = useMemo(
    () => sanitizeColumnLayout(effectiveColumnLayout, columns),
    [columns, effectiveColumnLayout],
  );
  const displayColumns = useMemo(
    () => (enableColumnLayout
      ? applyColumnLayout(columns, sanitizedColumnLayout)
      : applyColumnWidths(columns, sanitizedColumnLayout)),
    [columns, enableColumnLayout, sanitizedColumnLayout],
  );
  const viewportColumns = useMemo(
    () => displayColumns.filter((column) => !isColumnHiddenAtViewport(column.hideBelow, viewportTier)),
    [displayColumns, viewportTier],
  );
  const sourceColumnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );
  const resizeStateRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showTableScrollFade = useTableScrollOverflowHint(scrollRef, isTableScrollPresentation);
  const [gridHovered, setGridHovered] = useState(false);
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);

  const columnById = useMemo(
    () => new Map(displayColumns.map((column) => [column.id, column])),
    [displayColumns],
  );

  const sanitizedQuery = useMemo(
    () => sanitizeGridQuery(effectiveQuery, displayColumns, gridQueryMode),
    [effectiveQuery, displayColumns, gridQueryMode],
  );

  const displayRows = useMemo(
    () => applyClientGridQuery(rows, sanitizedQuery, displayColumns, gridQueryMode),
    [rows, sanitizedQuery, displayColumns, gridQueryMode],
  );

  const selectedKeySet = useMemo(() => normalizeKeySet(selectedKeys), [selectedKeys]);
  const selectionEnabled = selectionMode === 'single' || selectionMode === 'multiple';

  const columnsWithSelection = useMemo((): ReadonlyArray<AppTableGridColumnDef<TRow>> => {
    if (!selectionEnabled) {
      return viewportColumns;
    }

    const allVisibleSelected = displayRows.length > 0
      && displayRows.every((row) => selectedKeySet.has(String(getRowKey(row))));

    const selectionColumn: AppTableGridColumnDef<TRow> = {
      id: SELECTION_COLUMN_ID,
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      label: selectionMode === 'multiple' ? (
        <UiCheckbox
          ariaLabel="Select all rows"
          size="sm"
          className={selectionControlClassName}
          checked={allVisibleSelected}
          onChange={(event) => {
            const checked = event.target.checked;
            if (!checked) {
              onSelectionChange?.([]);
              return;
            }
            onSelectionChange?.(displayRows.map((row) => String(getRowKey(row))));
          }}
        />
      ) : '',
      width: 44,
      layout: { hideable: false, resizable: false, reorderable: false, pinned: 'left' },
      sort: false,
      filter: false,
      renderCell: (row) => {
        const key = String(getRowKey(row));
        const checked = selectedKeySet.has(key);
        return (
          <span
            data-row-selection-key={key}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <UiCheckbox
              size="sm"
              className={selectionControlClassName}
              ariaLabel={`Select row ${key}`}
              checked={checked}
              onChange={(event) => {
                const nextChecked = event.target.checked;
                if (selectionMode === 'single') {
                  onSelectionChange?.(nextChecked ? [key] : []);
                  return;
                }
                const next = new Set(selectedKeySet);
                if (nextChecked) {
                  next.add(key);
                } else {
                  next.delete(key);
                }
                onSelectionChange?.([...next]);
              }}
            />
          </span>
        );
      },
    };

    return [selectionColumn, ...viewportColumns];
  }, [
    viewportColumns,
    displayRows,
    getRowKey,
    onSelectionChange,
    selectedKeySet,
    selectionControlClassName,
    selectionEnabled,
    selectionMode,
  ]);

  const tableColumns = useMemo(
    () => freezeLeadingDataColumn(
      columnsWithSelection,
      compactViewport.freezeFirstColumn && !isCardPresentation,
      SELECTION_COLUMN_ID,
    ),
    [columnsWithSelection, compactViewport.freezeFirstColumn, isCardPresentation],
  );

  const pinnedStyles = useMemo(
    () => resolvePinnedColumnStyles(tableColumns, sanitizedColumnLayout),
    [sanitizedColumnLayout, tableColumns],
  );

  const commitQuery = useCallback((
    nextQuery: GridQueryState,
    meta: GridQueryChangeMeta,
  ) => {
    const sanitized = sanitizeGridQuery(nextQuery, displayColumns, gridQueryMode);
    if (!isQueryControlled) {
      setUncontrolledQuery(sanitized);
    }
    onQueryChange?.(sanitized, meta);
  }, [displayColumns, gridQueryMode, isQueryControlled, onQueryChange]);

  const commitColumnLayout = useCallback((
    nextLayout: GridColumnLayoutState,
    meta: GridColumnLayoutChangeMeta,
  ) => {
    const sanitized = sanitizeColumnLayout(nextLayout, columns);
    if (!isColumnLayoutControlled) {
      setUncontrolledColumnLayout((current) => (
        areColumnLayoutsEqual(current, sanitized) ? current : sanitized
      ));
    }
    if (columnLayoutPersistKey) {
      persistStoredColumnLayout(columnLayoutPersistKey, sanitized);
    }
    onColumnLayoutChange?.(sanitized, meta);
  }, [columnLayoutPersistKey, columns, isColumnLayoutControlled, onColumnLayoutChange]);

  useEffect(() => () => {
    if (columnLayoutPersistKey) {
      flushStoredColumnLayout(columnLayoutPersistKey);
    }
  }, [columnLayoutPersistKey]);

  const handleColumnResizeStart = useCallback((columnId: string, event: React.PointerEvent<HTMLSpanElement>) => {
    const sourceColumn = sourceColumnById.get(columnId);
    if (!sourceColumn || !resolveColumnLayoutOptions(sourceColumn.layout).resizable) {
      return;
    }

    const headerCell = event.currentTarget.closest('th');
    const resizeHandle = event.currentTarget;
    if (!headerCell) {
      return;
    }

    event.preventDefault();
    resizeHandle.setPointerCapture(event.pointerId);

    const rtl = getComputedStyle(headerCell).direction === 'rtl';
    const startWidth = headerCell.getBoundingClientRect().width;
    resizeStateRef.current = { columnId, startX: event.clientX, startWidth };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }
      const delta = moveEvent.clientX - state.startX;
      const minWidthPx = resolveColumnMinWidthPx(sourceColumn);
      const nextWidth = Math.max(
        minWidthPx,
        Math.round(state.startWidth + (rtl ? -delta : delta)),
      );
      commitColumnLayout(setColumnWidth(sanitizedColumnLayout, state.columnId, nextWidth, minWidthPx), {
        source: 'resize',
        columnId: state.columnId,
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      resizeHandle.releasePointerCapture(upEvent.pointerId);
      resizeStateRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [commitColumnLayout, sanitizedColumnLayout, sourceColumnById]);

  const handleColumnResizeAutoFit = useCallback((columnId: string) => {
    const sourceColumn = sourceColumnById.get(columnId);
    if (!sourceColumn || !resolveColumnLayoutOptions(sourceColumn.layout).resizable) {
      return;
    }

    const minWidthPx = resolveColumnMinWidthPx(sourceColumn);
    const nextWidth = measureAppTableGridColumnAutoWidth(scrollRef.current, columnId, minWidthPx);
    if (nextWidth == null) {
      return;
    }

    commitColumnLayout(setColumnWidth(sanitizedColumnLayout, columnId, nextWidth, minWidthPx), {
      source: 'autoFit',
      columnId,
    });
  }, [commitColumnLayout, sanitizedColumnLayout, sourceColumnById]);

  const handleSortToggle = useCallback((columnId: string) => {
    const column = columnById.get(columnId);
    if (!column) {
      return;
    }
    const nextQuery = toggleColumnSort(effectiveQuery, columnId, column);
    if (!nextQuery) {
      return;
    }
    commitQuery(nextQuery, { source: 'sort', columnId });
  }, [columnById, commitQuery, effectiveQuery]);

  const handleFilterCommit = useCallback((columnId: string, filter: GridFilterValue) => {
    const column = columnById.get(columnId);
    if (!column || !column.filter) {
      return;
    }

    const mode = resolveColumnMode(column, 'filter', gridQueryMode);
    const nextQuery = setColumnFilter(effectiveQuery, columnId, filter);
    const sanitized = sanitizeGridQuery(nextQuery, displayColumns, gridQueryMode);

    if (mode === 'client') {
      if (!isQueryControlled) {
        setUncontrolledQuery(sanitized);
      }
      onQueryChange?.(sanitized, { source: 'filter', columnId });
      return;
    }

    commitQuery(nextQuery, { source: 'filter', columnId });
  }, [
    columnById,
    displayColumns,
    commitQuery,
    effectiveQuery,
    gridQueryMode,
    isQueryControlled,
    onQueryChange,
  ]);

  const resolvedIsEmpty = isEmpty ?? (!isLoading && !errorContent && displayRows.length === 0);

  const cardLayout = useMemo(
    () => resolveCardLayout(viewportColumns, viewportTier),
    [viewportColumns, viewportTier],
  );
  const cardRowActionsResolver = getCardRowActions as ((row: TRow) => readonly GridRowActionItem[]) | undefined;

  const layoutControl = enableColumnLayout && showColumnLayoutControl && !isCardPresentation
    ? (columnLayoutControl ?? (
      <AppTableGridColumnLayoutControl
        columns={columns}
        layout={sanitizedColumnLayout}
        onLayoutChange={commitColumnLayout}
        visible={gridHovered || layoutPanelOpen}
        onOpenChange={setLayoutPanelOpen}
      />
    ))
    : null;

  const useSplitTableScroll = stickyHeader && !isCardPresentation && scrollOwner === 'self';
  const resolvedScrollGutter = resolveAppTableGridScrollGutter(scrollGutter);
  const bodyScrollClassName = resolveAppTableGridScrollClassName(
    scrollOwner,
    fillHeight,
    scrollGutter,
    scrollClassName,
  );
  const gridScrollOverlay = scrollOwner !== 'panel' && resolvedScrollGutter === 'overlay'
    ? <AppTableGridOverlayScrollbars viewportRef={scrollRef} />
    : null;
  const syncHeaderScrollbarGutter = resolvedScrollGutter === 'native';

  const renderLoadingPanel = () => (
    loadingContent ?? (
      <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>{loadingMessage}</div>
    )
  );

  const renderScrollBody = () => {
    if (errorContent) {
      return errorContent;
    }

    if (isCardPresentation) {
      if (isLoading) {
        return renderLoadingPanel();
      }

      if (resolvedIsEmpty) {
        if (emptyContent) {
          return emptyContent;
        }
        if (!String(emptyMessage ?? '').trim()) {
          return null;
        }
        return (
          <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>{emptyMessage}</div>
        );
      }

      return (
        <AppTableGridCardBody
          layout={cardLayout}
          rows={displayRows}
          getRowKey={getRowKey}
          size={size}
          scrollRef={scrollRef}
          chrome={{
            cardsPerRow: compactViewport.cardsPerRow,
            collapseExtraFields: compactViewport.collapseExtraFields,
            visibleFieldCount: compactViewport.visibleFieldCount,
            showActions: compactViewport.showActions,
            showMeta: compactViewport.showMeta,
          }}
          cardListHostClassName={cardListHostClassName}
          getCardRowActions={cardRowActionsResolver}
          cardActionsMaxVisible={resolvedCardActionsMaxVisible}
        />
      );
    }

    if (!useSplitTableScroll && isLoading) {
      return renderLoadingPanel();
    }

    // Wide table-scroll grids: center loading in the viewport (not at the horizontal start of a wide table).
    if (useSplitTableScroll && isLoading && resolvedIsEmpty) {
      return renderLoadingPanel();
    }

    if (!useSplitTableScroll && resolvedIsEmpty) {
      if (emptyContent) {
        return emptyContent;
      }
      if (!String(emptyMessage ?? '').trim()) {
        return null;
      }
      return (
        <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>{emptyMessage}</div>
      );
    }

    const isHeroChrome = isAppTableGridHeroChrome(chrome);
    const tableClass = resolveAppTableGridTableClassName(
      scrollOwner,
      scrollGutter,
      size === 'xs' ? 'text-xs' : 'text-sm',
      isHeroChrome && HERO_TABLE_HEADER_CORNER_CLASS,
      tableClassName,
    );
    const theadClass = cn(
      isHeroChrome
        ? (useSplitTableScroll ? APP_TABLE_GRID_HERO_THEAD_BAND_CLASS : APP_TABLE_GRID_HERO_THEAD_CLASS)
        : (useSplitTableScroll ? APP_TABLE_GRID_THEAD_BAND_CLASS : APP_TABLE_GRID_THEAD_CLASS),
      !stickyHeader && '!static',
      theadClassName,
    );
    const tableWidthClass = isTableScrollPresentation ? APP_TABLE_GRID_TABLE_SCROLL_INNER_CLASS : undefined;
    const colGroup = buildAppTableGridColGroup(tableColumns, sanitizedColumnLayout);

    const layoutControlColumnId = tableColumns[tableColumns.length - 1]?.id;

    const headerRow = (
      <tr className={APP_TABLE_GRID_HEADER_ROW_GROUP_CLASS}>
        {tableColumns.map((column, columnIndex) => {
          const sourceColumn = sourceColumnById.get(column.id) ?? column;
          const layoutOptions = resolveColumnLayoutOptions(sourceColumn.layout);
          const widthStyle = buildAppTableGridColumnWidthStyle({
            ...sourceColumn,
            width: column.width ?? sourceColumn.width,
          });
          return (
            <AppTableGridColumnHeader
              key={column.id}
              column={column as AppTableGridColumnDef<unknown>}
              isLastColumn={columnIndex === tableColumns.length - 1}
              query={sanitizedQuery}
              gridQueryMode={gridQueryMode}
              onSortToggle={handleSortToggle}
              onFilterCommit={handleFilterCommit}
              resizable={
                layoutOptions.resizable
                && column.id !== SELECTION_COLUMN_ID
              }
              onResizeStart={handleColumnResizeStart}
              onResizeAutoFit={handleColumnResizeAutoFit}
              headerEndSlot={layoutControl && column.id === layoutControlColumnId ? layoutControl : undefined}
              style={mergePinnedCellStyle(widthStyle, pinnedStyles.get(column.id))}
              chrome={chrome}
              queryControlsVisibility={resolvedHeaderQueryControlsVisibility}
            />
          );
        })}
      </tr>
    );

    const renderEmptyBodyRow = () => {
      if (emptyContent) {
        return emptyContent;
      }
      if (!String(emptyMessage ?? '').trim()) {
        return null;
      }
      return (
        <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>{emptyMessage}</div>
      );
    };

    const tableBody = isLoading ? (
      <tr>
        <td colSpan={Math.max(1, tableColumns.length)} className="p-0">
          {renderLoadingPanel()}
        </td>
      </tr>
    ) : resolvedIsEmpty ? (
      <tr>
        <td colSpan={Math.max(1, tableColumns.length)} className="p-0">
          {renderEmptyBodyRow()}
        </td>
      </tr>
    ) : (
      <AppTableGridColumnBody
        columns={tableColumns}
        displayRows={displayRows}
        getRowKey={getRowKey}
        scrollRef={scrollRef}
        onRowClick={onRowClick}
        getRowClassName={getRowClassName}
        pinnedStyles={pinnedStyles}
        virtualize={virtualizeRows ?? scrollOwner !== 'panel'}
        chrome={chrome}
      />
    );

    if (useSplitTableScroll) {
      return (
        <AppTableGridSplitTableLayout
          scrollRef={scrollRef}
          bodyScrollClassName={bodyScrollClassName}
          tableClassName={tableClass}
          tableAriaLabel={ariaLabel}
          tableWidthClassName={tableWidthClass}
          colGroup={colGroup}
          theadClassName={theadClass}
          headerRow={headerRow}
          tbodyClassName={cn(APP_TABLE_GRID_TBODY_CLASS, tbodyClassName)}
          onScroll={onScroll}
          onMouseEnter={() => setGridHovered(true)}
          onMouseLeave={() => setGridHovered(false)}
          bodyRole={isTableScrollPresentation ? 'region' : undefined}
          bodyTabIndex={isTableScrollPresentation ? 0 : undefined}
          bodyAriaLabel={isTableScrollPresentation
            ? (ariaLabel ? `${ariaLabel} (scrollable)` : 'Scrollable data table')
            : undefined}
          bodyDataScrollOwner={scrollOwner}
          scrollOverlay={gridScrollOverlay}
          syncHeaderScrollbarGutter={syncHeaderScrollbarGutter}
        >
          {tableBody}
        </AppTableGridSplitTableLayout>
      );
    }

    const table = (
      <table
        className={cn(
          tableClass,
          isTableScrollPresentation && '!w-max min-w-full',
        )}
        aria-label={ariaLabel}
      >
        {colGroup}
        <thead className={theadClass}>
          {headerRow}
        </thead>
        <tbody className={cn(APP_TABLE_GRID_TBODY_CLASS, tbodyClassName)}>
          {tableBody}
        </tbody>
      </table>
    );

    if (isTableScrollPresentation) {
      return (
        <div className={APP_TABLE_GRID_TABLE_SCROLL_INNER_CLASS}>
          {table}
        </div>
      );
    }

    return table;
  };

  const usesSplitScrollHost = useSplitTableScroll
    && !errorContent
    && !isCardPresentation
    && !isLoading
    && !resolvedIsEmpty;

  const scrollBody = (
    <AppTableGridScrollOverflowFrame
      enabled={isTableScrollPresentation}
      showEndFade={showTableScrollFade}
      className={
        resolveAppTableGridFillHost(scrollOwner, fillHeight)
          ? 'flex min-h-0 flex-1 flex-col'
          : 'flex-none'
      }
    >
      {usesSplitScrollHost ? (
        renderScrollBody()
      ) : (
        <AppTableGridScrollViewport
          scrollRef={scrollRef}
          scrollOwner={scrollOwner}
          scrollGutter={resolvedScrollGutter}
          className={bodyScrollClassName}
          role={isTableScrollPresentation ? 'region' : undefined}
          tabIndex={isTableScrollPresentation ? 0 : undefined}
          aria-label={isTableScrollPresentation
            ? (ariaLabel ? `${ariaLabel} (scrollable)` : 'Scrollable data table')
            : undefined}
          data-table-grid-scroll-owner={scrollOwner}
          onScroll={onScroll}
          onMouseEnter={() => setGridHovered(true)}
          onMouseLeave={() => setGridHovered(false)}
        >
          {renderScrollBody()}
        </AppTableGridScrollViewport>
      )}
    </AppTableGridScrollOverflowFrame>
  );

  return wrapAppTableGridShell({
    scrollOwner,
    scrollGutter,
    fillHeight,
    chrome,
    margin,
    borderWidth,
    cellPaddingX,
    className,
    footer,
    scrollBody,
  });
}

function AppTableGridComposed({
  header,
  children,
  footer,
  size = 'xs',
  className,
  scrollClassName,
  onScroll,
  tableClassName,
  theadClassName,
  stickyHeader = true,
  fillHeight = true,
  scrollOwner = 'self',
  scrollGutter,
  chrome,
  margin,
  borderWidth,
  cellPaddingX,
  ariaLabel,
  tbodyClassName,
  isLoading = false,
  loadingMessage = 'Loading...',
  loadingContent,
  errorContent,
  isEmpty = false,
  emptyMessage = 'No records found.',
  emptyContent,
}: AppTableGridComposedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const useSplitTableScroll = stickyHeader && scrollOwner === 'self';
  const resolvedScrollGutter = resolveAppTableGridScrollGutter(scrollGutter);
  const bodyScrollClassName = resolveAppTableGridScrollClassName(
    scrollOwner,
    fillHeight,
    scrollGutter,
    scrollClassName,
  );
  const gridScrollOverlay = scrollOwner !== 'panel' && resolvedScrollGutter === 'overlay'
    ? <AppTableGridOverlayScrollbars viewportRef={scrollRef} />
    : null;
  const syncHeaderScrollbarGutter = resolvedScrollGutter === 'native';
  const isHeroChrome = isAppTableGridHeroChrome(chrome);
  const tableClass = resolveAppTableGridTableClassName(
    scrollOwner,
    scrollGutter,
    size === 'xs' ? 'text-xs' : 'text-sm',
    isHeroChrome && HERO_TABLE_HEADER_CORNER_CLASS,
    tableClassName,
  );
  const theadClass = cn(
    isHeroChrome
      ? (useSplitTableScroll ? APP_TABLE_GRID_HERO_THEAD_BAND_CLASS : APP_TABLE_GRID_THEAD_CLASS)
      : (useSplitTableScroll ? APP_TABLE_GRID_THEAD_BAND_CLASS : APP_TABLE_GRID_THEAD_CLASS),
    !stickyHeader && '!static',
    theadClassName,
  );

  const renderScrollBody = () => {
    if (isLoading) {
      return loadingContent ?? (
        <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>{loadingMessage}</div>
      );
    }

    if (errorContent) {
      return errorContent;
    }

    if (isEmpty) {
      if (emptyContent) {
        return emptyContent;
      }
      if (!String(emptyMessage ?? '').trim()) {
        return null;
      }
      return (
        <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>{emptyMessage}</div>
      );
    }

    if (useSplitTableScroll) {
      return (
        <AppTableGridSplitTableLayout
          scrollRef={scrollRef}
          bodyScrollClassName={bodyScrollClassName}
          tableClassName={tableClass}
          tableAriaLabel={ariaLabel}
          theadClassName={theadClass}
          headerRow={header}
          tbodyClassName={cn(APP_TABLE_GRID_TBODY_CLASS, tbodyClassName)}
          onScroll={onScroll}
          bodyDataScrollOwner={scrollOwner}
          scrollOverlay={gridScrollOverlay}
          syncHeaderScrollbarGutter={syncHeaderScrollbarGutter}
        >
          {children}
        </AppTableGridSplitTableLayout>
      );
    }

    return (
      <table
        className={tableClass}
        aria-label={ariaLabel}
      >
        <thead className={theadClass}>
          {header}
        </thead>
        <tbody className={cn(APP_TABLE_GRID_TBODY_CLASS, tbodyClassName)}>
          {children}
        </tbody>
      </table>
    );
  };

  const usesSplitScrollHost = useSplitTableScroll && !isLoading && !errorContent && !isEmpty;

  const scrollBody = usesSplitScrollHost ? (
    renderScrollBody()
  ) : (
    <AppTableGridScrollViewport
      scrollRef={scrollRef}
      scrollOwner={scrollOwner}
      scrollGutter={resolvedScrollGutter}
      className={bodyScrollClassName}
      data-table-grid-scroll-owner={scrollOwner}
      onScroll={onScroll}
    >
      {renderScrollBody()}
    </AppTableGridScrollViewport>
  );

  return wrapAppTableGridShell({
    scrollOwner,
    scrollGutter,
    fillHeight,
    chrome,
    margin,
    borderWidth,
    cellPaddingX,
    className,
    footer,
    scrollBody,
  });
}

export function AppTableGrid<TRow = unknown>(props: AppTableGridProps<TRow>) {
  const onScroll = useComposeListPageGridScroll(props.onScroll);
  const gridProps = onScroll === props.onScroll ? props : { ...props, onScroll };

  return (
    <AppTableGridCultureDirectionProvider>
      {isColumnModeProps(gridProps) ? <AppTableGridColumnMode {...gridProps} /> : <AppTableGridComposed {...gridProps} />}
    </AppTableGridCultureDirectionProvider>
  );
}

export {
  APP_TABLE_GRID_ROW_CLASS,
  APP_TABLE_GRID_SCROLL_CLASS,
  APP_TABLE_GRID_CONTENT_SCROLL_CLASS,
  APP_TABLE_GRID_FILL_HOST_CLASS,
  APP_TABLE_GRID_CONTENT_HOST_CLASS,
  APP_TABLE_GRID_STATE_PANEL_CLASS,
  APP_TABLE_GRID_EMPTY_VALUE,
  APP_TABLE_GRID_EMPTY_VALUE_CLASS,
  APP_TABLE_GRID_TABLE_CLASS,
  APP_TABLE_GRID_TABLE_FIRST_COLUMN_INSET_CLASS,
  APP_TABLE_GRID_CELL_CLIP_CLASS,
  APP_TABLE_GRID_CELL_WRAP_CLASS,
  APP_TABLE_GRID_TBODY_CLASS,
  APP_TABLE_GRID_THEAD_CLASS,
  APP_TABLE_GRID_BODY_CELL_CLASS,
  APP_TABLE_GRID_CELL_PR_CLASS,
  APP_TABLE_GRID_FIRST_COLUMN_PL_CLASS,
  appTableGridCellPxClass,
  appTableGridHeaderCellClass,
} from './surfaceClasses';
export type {
  AppTableGridChrome,
  AppTableGridHeaderQueryControlsVisibility,
  AppTableGridScrollGutter,
  AppTableGridScrollOwner,
} from '../lib/appTableGridShell';
export {
  APP_TABLE_GRID_BORDER_WIDTH_OPTIONS,
  APP_TABLE_GRID_CELL_PADDING_X_OPTIONS,
  APP_TABLE_GRID_MARGIN_OPTIONS,
  DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX,
  DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX,
  DEFAULT_APP_TABLE_GRID_HEADER_QUERY_CONTROLS_VISIBILITY,
  DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX,
  DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX,
  DEFAULT_APP_TABLE_GRID_MARGIN_PX,
  DEFAULT_APP_TABLE_GRID_SCROLL_GUTTER,
  isAppTableGridHeroChrome,
  resolveAppTableGridBorderWidthPx,
  resolveAppTableGridCellPaddingXPx,
  resolveAppTableGridChrome,
  resolveAppTableGridChromeBorderWidthPx,
  resolveAppTableGridChromeMarginPx,
  resolveAppTableGridHeaderQueryControlsVisibility,
  resolveAppTableGridMarginPx,
  resolveAppTableGridScrollGutter,
  resolveGridPagingFooterChrome,
} from '../lib/appTableGridShell';
