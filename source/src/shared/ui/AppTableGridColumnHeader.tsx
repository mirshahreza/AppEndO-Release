import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, Check, Filter, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCultureT } from '../../core/culture/CultureContext';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import {
  createEmptyFilterValue,
  isFilterActive,
  isFilterableColumn,
  isSortableColumn,
  resolveColumnMode,
  type AppTableGridColumnDef,
  type GridColumnQueryMode,
  type GridFilterValue,
  type GridQueryState,
  type GridSortDirection,
} from '../lib/appTableGridQuery';
import { buildAppTableGridColumnWidthStyle, resolveColumnLayoutOptions } from '../lib/appTableGridColumnLayout';
import {
  resolveAppTableGridHeaderFlexJustify,
  resolveAppTableGridHeaderLabelClassName,
} from '../lib/appTableGridColumnAlign';
import { resolveAppTableGridColumnDirectionChrome } from '../lib/appTableGridColumnTextDirection';
import { useAppTableGridCultureDirection } from './AppTableGridCultureDirectionContext';
import {
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  overlayOriginFromFixedMenuStyle,
  useFixedDropDownMenuStyle,
} from './AppSplitButton';
import { NativeButton } from './NativeButton';
import { overlayMotionDocumentDir, overlayMotionPanelProps } from './overlay-motion/overlayMotion';
import { UiCheckbox, UiInput, UiSelect } from './HeroFieldControls';
import type { AppTableGridChrome } from '../lib/appTableGridShell';
import {
  isAppTableGridHeroChrome,
  resolveAppTableGridHeaderQueryControlsVisibility,
  type AppTableGridHeaderQueryControlsVisibility,
} from '../lib/appTableGridShell';
import {
  APP_TABLE_GRID_HEADER_CELL_CLASS,
  APP_TABLE_GRID_HERO_HEADER_CELL_CLASS,
  APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CELL_CLASS,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  ICON_ACTION_CONFIRM_CLASS,
} from './surfaceClasses';
import { useAppTableGridScrollChrome } from './AppTableGridScrollChromeContext';

export { APP_TABLE_GRID_HEADER_CELL_CLASS };

export const GRID_QUERY_ICON_STROKE_CLIENT = 1.25;
export const GRID_QUERY_ICON_STROKE_SERVER = 2.75;

/** Column layout menu sits outside the shared query + resize end band. */
const APP_TABLE_GRID_HEADER_LAYOUT_MENU_END_CLASS = 'end-7';
const APP_TABLE_GRID_HEADER_END_BAND_INSET_CLASS = 'end-0';
/** Space between sort/filter icons and the resize stripe. */
const APP_TABLE_GRID_HEADER_QUERY_TO_RESIZE_GAP_CLASS = 'gap-2';
/** Apply on the header `<tr>` so the active sort column can reveal on any header hover. */
export const APP_TABLE_GRID_HEADER_ROW_GROUP_CLASS = 'group/header-row';

const APP_TABLE_GRID_HEADER_END_HOVER_REVEAL_CLASS =
  'opacity-0 transition-opacity duration-150 pointer-events-none group-hover/th:opacity-100 group-hover/th:pointer-events-auto group-focus-within/th:opacity-100 group-focus-within/th:pointer-events-auto';

/** Active sort column: also reveal sort/filter band when the pointer is over any header in the row. */
const APP_TABLE_GRID_HEADER_SORT_ACTIVE_ROW_HOVER_REVEAL_CLASS =
  'group-hover/header-row:opacity-100 group-hover/header-row:pointer-events-auto group-focus-within/header-row:opacity-100 group-focus-within/header-row:pointer-events-auto';
const APP_TABLE_GRID_HEADER_RESIZE_HANDLE_CLASS =
  'w-1 shrink-0 self-stretch cursor-col-resize touch-none select-none bg-indigo-200/50 group-hover/th:bg-indigo-200/80 hover:bg-indigo-300/90';

function resolveHeaderEndBandInsetClass(headerEndSlot?: React.ReactNode): string {
  return headerEndSlot
    ? APP_TABLE_GRID_HEADER_LAYOUT_MENU_END_CLASS
    : APP_TABLE_GRID_HEADER_END_BAND_INSET_CLASS;
}

type AppTableGridColumnHeaderProps = {
  column: AppTableGridColumnDef<unknown>;
  query: GridQueryState;
  gridQueryMode?: GridColumnQueryMode;
  onSortToggle: (columnId: string) => void;
  onFilterCommit: (columnId: string, filter: GridFilterValue) => void;
  resizable?: boolean;
  onResizeStart?: (columnId: string, event: React.PointerEvent<HTMLSpanElement>) => void;
  onResizeAutoFit?: (columnId: string) => void;
  headerEndSlot?: React.ReactNode;
  /**
   * Explicit column width, overriding the `column.width`-only fallback below. Callers that also
   * apply a computed width to body cells (e.g. an even auto-share percentage for columns with no
   * explicit width) must pass the *same* style here too — otherwise header and body only agree on
   * width by accident, via a shared `<colgroup>` in a normal `<table>` layout. That accidental
   * agreement breaks entirely once a caller uses the `display:table`-per-row "contained scroll"
   * hack (e.g. DesignerDataGridTable's sticky-header mode), where each row is its own independent
   * table and the outer `<colgroup>` no longer reaches any of them.
   */
  style?: React.CSSProperties;
  chrome?: AppTableGridChrome;
  queryControlsVisibility?: AppTableGridHeaderQueryControlsVisibility;
  isLastColumn?: boolean;
};

function getQueryModeStrokeWidth(mode: GridColumnQueryMode): number {
  return mode === 'server' ? GRID_QUERY_ICON_STROKE_SERVER : GRID_QUERY_ICON_STROKE_CLIENT;
}

function getSortDirectionForColumn(query: GridQueryState, columnId: string): GridSortDirection | null {
  if (!query.sort || query.sort.columnId !== columnId) {
    return null;
  }
  return query.sort.direction;
}

function formatQueryModeLabel(mode: GridColumnQueryMode, t: TranslationFn): string {
  return mode === 'server' ? t('grid.hint.serverSide') : t('grid.hint.clientSide');
}

function FilterPopoverContent({
  column,
  activeFilter,
  onCommit,
  onClose,
  t,
}: {
  column: AppTableGridColumnDef<unknown>;
  activeFilter: GridFilterValue | undefined;
  onCommit: (filter: GridFilterValue) => void;
  onClose: () => void;
  t: TranslationFn;
}) {
  if (!column.filter) {
    return null;
  }

  const filterType = column.filter.type;
  const multiple = column.filter.multiple ?? false;
  const initialValue = activeFilter ?? createEmptyFilterValue(filterType, multiple);
  const [draft, setDraft] = React.useState<GridFilterValue>(initialValue);

  React.useEffect(() => {
    setDraft(activeFilter ?? createEmptyFilterValue(filterType, multiple));
  }, [activeFilter, filterType, multiple]);

  const applyDraft = () => {
    onCommit(draft);
    onClose();
  };

  const cancelDraft = () => {
    setDraft(activeFilter ?? createEmptyFilterValue(filterType, multiple));
    onClose();
  };

  return (
    <>
      {filterType === 'text' ? (
        <div className="flex flex-col gap-[2px]">
          <label className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t('grid.filter.label')}
          </label>
          <UiInput
            size="sm"
            ariaLabel={`${t('grid.filter.label')} ${String(column.id)}`}
            placeholder={column.filter.placeholder ?? t('grid.filter.contains')}
            value={draft.type === 'text' ? draft.value : ''}
            onChange={(event) => {
              setDraft({ type: 'text', value: event.target.value });
            }}
          />
        </div>
      ) : null}

      {filterType === 'boolean' ? (
        <div className="flex flex-col gap-[2px]">
          <label className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t('grid.filter.value')}
          </label>
          <UiSelect
            size="sm"
            nested
            ariaLabel={`${t('grid.filter.label')} ${String(column.id)}`}
            value={draft.type === 'boolean' ? draft.value : 'all'}
            onChange={(event) => {
              const value = event.target.value as 'all' | 'true' | 'false';
              setDraft({ type: 'boolean', value });
            }}
          >
            <option value="all">{t('grid.filter.all')}</option>
            <option value="true">{t('grid.filter.true')}</option>
            <option value="false">{t('grid.filter.false')}</option>
          </UiSelect>
        </div>
      ) : null}

      {filterType === 'select' && !multiple ? (
        <div className="flex flex-col gap-[2px]">
          <label className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t('grid.filter.value')}
          </label>
          <UiSelect
            size="sm"
            nested
            ariaLabel={`${t('grid.filter.label')} ${String(column.id)}`}
            value={draft.type === 'select' && !Array.isArray(draft.value) ? draft.value : ''}
            onChange={(event) => {
              setDraft({ type: 'select', value: event.target.value });
            }}
          >
            <option value="">{t('grid.filter.all')}</option>
            {(column.filter.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </UiSelect>
        </div>
      ) : null}

      {filterType === 'select' && multiple ? (
        <div className="flex flex-col gap-2">
          <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t('grid.filter.values')}
          </span>
          {(column.filter.options ?? []).map((option) => {
            const selected = draft.type === 'select' && Array.isArray(draft.value)
              ? draft.value
              : [];
            const checked = selected.includes(option.value);
            return (
              <UiCheckbox
                key={option.value}
                checked={checked}
                onChange={(event) => {
                  const current = draft.type === 'select' && Array.isArray(draft.value)
                    ? draft.value
                    : [];
                  const next = event.target.checked
                    ? [...current, option.value]
                    : current.filter((value) => value !== option.value);
                  setDraft({ type: 'select', value: next });
                }}
              >
                {option.label}
              </UiCheckbox>
            );
          })}
        </div>
      ) : null}

      {filterType === 'dateRange' ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {t('grid.filter.from')}
            </label>
            <UiInput
              size="sm"
              type="date"
              ariaLabel={`${t('grid.filter.label')} ${String(column.id)} ${t('grid.filter.from')}`}
              value={draft.type === 'dateRange' ? (draft.from ?? '') : ''}
              onChange={(event) => {
                const from = event.target.value || null;
                const to = draft.type === 'dateRange' ? draft.to : null;
                setDraft({ type: 'dateRange', from, to });
              }}
            />
          </div>
          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {t('grid.filter.to')}
            </label>
            <UiInput
              size="sm"
              type="date"
              ariaLabel={`${t('grid.filter.label')} ${String(column.id)} ${t('grid.filter.to')}`}
              value={draft.type === 'dateRange' ? (draft.to ?? '') : ''}
              onChange={(event) => {
                const to = event.target.value || null;
                const from = draft.type === 'dateRange' ? draft.from : null;
                setDraft({ type: 'dateRange', from, to });
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end gap-1">
        <NativeButton
          type="button"
          className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CONFIRM_CLASS, 'cursor-pointer')}
          aria-label={t('grid.applyFilter')}
          title={t('grid.apply')}
          onClick={applyDraft}
        >
          <Check className="h-3.5 w-3.5" />
        </NativeButton>
        <NativeButton
          type="button"
          className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, 'cursor-pointer')}
          aria-label={t('grid.cancelFilter')}
          title={t('actions.cancel')}
          onClick={cancelDraft}
        >
          <X className="h-3.5 w-3.5" />
        </NativeButton>
      </div>
    </>
  );
}

export const AppTableGridColumnHeader: React.FC<AppTableGridColumnHeaderProps> = ({
  column,
  query,
  gridQueryMode = 'client',
  onSortToggle,
  onFilterCommit,
  resizable = false,
  onResizeStart,
  onResizeAutoFit,
  headerEndSlot,
  style,
  chrome,
  queryControlsVisibility: queryControlsVisibilityProp,
  isLastColumn = false,
}) => {
  const t = useCultureT();
  const cultureDirection = useAppTableGridCultureDirection();
  const scrollChrome = useAppTableGridScrollChrome();
  const directionChrome = resolveAppTableGridColumnDirectionChrome(column, cultureDirection);
  const effectiveHeaderClassName = directionChrome.headerClassName ?? column.headerClassName;
  const columnPin = resolveColumnLayoutOptions(column.layout).pinned;
  const queryControlsVisibility = resolveAppTableGridHeaderQueryControlsVisibility(
    queryControlsVisibilityProp,
  );
  const useHoverQueryControls = queryControlsVisibility === 'hover';
  const sortable = isSortableColumn(column);
  const filterable = isFilterableColumn(column);
  const sortMode = resolveColumnMode(column, 'sort', gridQueryMode);
  const filterMode = resolveColumnMode(column, 'filter', gridQueryMode);
  const sortStrokeWidth = sortMode ? getQueryModeStrokeWidth(sortMode) : GRID_QUERY_ICON_STROKE_CLIENT;
  const filterStrokeWidth = filterMode ? getQueryModeStrokeWidth(filterMode) : GRID_QUERY_ICON_STROKE_CLIENT;
  const sortDirection = getSortDirectionForColumn(query, column.id);
  const activeFilter = query.filters[column.id];
  const filterActive = isFilterActive(activeFilter);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [resizeInteractionPinned, setResizeInteractionPinned] = React.useState(false);
  const filterTriggerRef = React.useRef<HTMLDivElement | null>(null);
  const filterPanelRef = React.useRef<HTMLDivElement | null>(null);
  const filterPanelStyle = useFixedDropDownMenuStyle(isFilterOpen, filterTriggerRef, {
    align: 'start',
    minWidth: 192,
    flip: true,
    panelRef: filterPanelRef,
  });
  const filterHint = t('grid.hint.filter').replace('{mode}', formatQueryModeLabel(filterMode ?? 'client', t));
  const filterPanelMotion = overlayMotionPanelProps({
    kind: 'popover',
    origin: overlayOriginFromFixedMenuStyle(filterPanelStyle),
    dir: overlayMotionDocumentDir(),
  });

  React.useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (filterTriggerRef.current?.contains(target) || filterPanelRef.current?.contains(target)) {
        return;
      }
      if (
        target instanceof Element
        && target.closest('[role="listbox"], [role="option"], [data-slot="popover"], [data-react-aria-top-layer]')
      ) {
        return;
      }
      setIsFilterOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen]);

  React.useEffect(() => {
    if (!resizeInteractionPinned) {
      return;
    }
    const releaseResizePin = () => setResizeInteractionPinned(false);
    window.addEventListener('pointerup', releaseResizePin);
    window.addEventListener('pointercancel', releaseResizePin);
    return () => {
      window.removeEventListener('pointerup', releaseResizePin);
      window.removeEventListener('pointercancel', releaseResizePin);
    };
  }, [resizeInteractionPinned]);

  const widthStyle = style ?? buildAppTableGridColumnWidthStyle(column);

  const filterPanel = isFilterOpen ? (
    <div
      ref={filterPanelRef}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'min-w-[12rem] p-3', filterPanelMotion.className)}
      data-overlay-kind={filterPanelMotion['data-overlay-kind']}
      data-overlay-origin={filterPanelMotion['data-overlay-origin']}
      data-overlay-dir={filterPanelMotion['data-overlay-dir']}
      style={filterPanelStyle}
      role="dialog"
      aria-label={filterHint}
    >
      <FilterPopoverContent
        column={column}
        activeFilter={activeFilter}
        onCommit={(filter) => onFilterCommit(column.id, filter)}
        onClose={() => setIsFilterOpen(false)}
        t={t}
      />
    </div>
  ) : null;

  const queryControlsPinned = Boolean(filterActive || isFilterOpen);
  const headerEndChromePinned = queryControlsPinned || resizeInteractionPinned;
  const showQueryControls = sortable || filterable;

  const sortControl = sortable ? (
    <NativeButton
      type="button"
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent transition-colors cursor-pointer',
        sortDirection ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
      )}
      aria-label={
        sortDirection === 'asc'
          ? t('grid.hint.sortAscending').replace('{mode}', formatQueryModeLabel(sortMode ?? 'client', t))
          : sortDirection === 'desc'
            ? t('grid.hint.sortDescending').replace('{mode}', formatQueryModeLabel(sortMode ?? 'client', t))
            : t('grid.hint.sort').replace('{mode}', formatQueryModeLabel(sortMode ?? 'client', t))
      }
      title={
        sortDirection === 'asc'
          ? t('grid.hint.sortAscending').replace('{mode}', formatQueryModeLabel(sortMode ?? 'client', t))
          : sortDirection === 'desc'
            ? t('grid.hint.sortDescending').replace('{mode}', formatQueryModeLabel(sortMode ?? 'client', t))
            : t('grid.hint.sort').replace('{mode}', formatQueryModeLabel(sortMode ?? 'client', t))
      }
      onClick={() => onSortToggle(column.id)}
    >
      {sortDirection === 'asc' ? (
        <ArrowUpAZ className="h-3.5 w-3.5" strokeWidth={sortStrokeWidth} />
      ) : sortDirection === 'desc' ? (
        <ArrowDownAZ className="h-3.5 w-3.5" strokeWidth={sortStrokeWidth} />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={sortStrokeWidth} />
      )}
    </NativeButton>
  ) : null;

  const filterControl = filterable ? (
    <div ref={filterTriggerRef} className="relative shrink-0">
      <NativeButton
        type="button"
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-sm border-0 bg-transparent transition-colors cursor-pointer',
          filterActive ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
        )}
        aria-label={filterHint}
        title={filterHint}
        aria-haspopup="dialog"
        aria-expanded={isFilterOpen}
        onClick={() => setIsFilterOpen((previous) => !previous)}
      >
        <Filter className="h-3.5 w-3.5" strokeWidth={filterStrokeWidth} />
      </NativeButton>
      {filterPanel && typeof document !== 'undefined'
        ? createPortal(filterPanel, document.body)
        : filterPanel}
    </div>
  ) : null;

  const queryControls = showQueryControls ? (
    <>
      {sortControl}
      {filterControl}
    </>
  ) : null;

  const headerEndBandInsetClass = resolveHeaderEndBandInsetClass(headerEndSlot);
  const showHeaderEndChrome = Boolean(queryControls || (resizable && onResizeStart));

  const renderResizeHandle = (revealWithHeaderHover: boolean) => {
    if (!resizable || !onResizeStart) {
      return null;
    }
    return (
      <span
        role="separator"
        aria-hidden="true"
        aria-orientation="vertical"
        title={[
          t('grid.hint.resizeColumn').replace('{column}', String(column.id)),
          t('grid.hint.autoFitColumn').replace('{column}', String(column.id)),
        ].join(' ')}
        className={cn(
          'z-10',
          APP_TABLE_GRID_HEADER_RESIZE_HANDLE_CLASS,
          revealWithHeaderHover && APP_TABLE_GRID_HEADER_END_HOVER_REVEAL_CLASS,
          resizeInteractionPinned && 'opacity-100 pointer-events-auto bg-indigo-200/80',
        )}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onResizeAutoFit?.(column.id);
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button === 0 && event.detail >= 2) {
            return;
          }
          setResizeInteractionPinned(true);
          onResizeStart(column.id, event);
        }}
      />
    );
  };

  const headerEndChromeContent = (() => {
    const resizeInHoverBand = renderResizeHandle(false);
    const resizeWithOwnReveal = renderResizeHandle(true);

    if (queryControls && useHoverQueryControls) {
      return (
        <div
          className={cn(
            'pointer-events-auto flex h-full items-center ps-8',
            APP_TABLE_GRID_HEADER_QUERY_TO_RESIZE_GAP_CLASS,
            'bg-gradient-to-l from-slate-100 from-55% via-slate-100/95 to-transparent',
            APP_TABLE_GRID_HEADER_END_HOVER_REVEAL_CLASS,
            sortDirection && APP_TABLE_GRID_HEADER_SORT_ACTIVE_ROW_HOVER_REVEAL_CLASS,
            headerEndChromePinned ? 'opacity-100 pointer-events-auto' : 'pointer-events-none',
          )}
        >
          <div className="flex items-center gap-1">
            {queryControls}
          </div>
          {resizeInHoverBand}
        </div>
      );
    }

    if (queryControls) {
      return (
        <div
          className={cn(
            'pointer-events-auto flex shrink-0 items-center',
            APP_TABLE_GRID_HEADER_QUERY_TO_RESIZE_GAP_CLASS,
          )}
        >
          <div className="flex items-center gap-1">
            {queryControls}
          </div>
          {resizeWithOwnReveal}
        </div>
      );
    }

    if (resizeWithOwnReveal) {
      return (
        <div
          className={cn(
            'pointer-events-auto flex h-full items-stretch',
            APP_TABLE_GRID_HEADER_END_HOVER_REVEAL_CLASS,
            headerEndChromePinned && 'opacity-100 pointer-events-auto',
          )}
        >
          {resizeWithOwnReveal}
        </div>
      );
    }

    return null;
  })();

  return (
    <th
      dir={directionChrome.headerDir}
      className={cn(
        isAppTableGridHeroChrome(chrome)
          ? APP_TABLE_GRID_HERO_HEADER_CELL_CLASS
          : APP_TABLE_GRID_HEADER_CELL_CLASS,
        effectiveHeaderClassName,
        isLastColumn
          && scrollChrome.lastColumnOverlayInset
          && APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CELL_CLASS,
        (showHeaderEndChrome || headerEndSlot) && 'relative',
        ((resizable && onResizeStart) || (useHoverQueryControls && showQueryControls)) && 'group/th overflow-visible',
      )}
      style={widthStyle}
      data-column-id={column.id}
      data-pinned={columnPin}
      data-header-query-controls={queryControlsVisibility}
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-1',
          effectiveHeaderClassName?.includes('text-center') && 'w-full',
          resolveAppTableGridHeaderFlexJustify(effectiveHeaderClassName),
        )}
      >
        <span className={resolveAppTableGridHeaderLabelClassName(effectiveHeaderClassName)}>{column.label}</span>
      </div>
      {showHeaderEndChrome ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 z-10 flex items-stretch',
            headerEndBandInsetClass,
          )}
        >
          {headerEndChromeContent}
        </div>
      ) : null}
      {headerEndSlot ? (
        <div className="pointer-events-auto absolute top-0.5 end-1 z-20">
          {headerEndSlot}
        </div>
      ) : null}
    </th>
  );
};
