import React from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Infinity as InfinityIcon,
  List,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import {
  formatCultureGridInfiniteRange,
  formatCultureGridShowingRange,
  formatCulturePageSizeLabel,
} from '../../core/culture/cultureGridLabels';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../core/culture/cultureShellKeys';
import {
  GRID_LIST_MODE_OPTIONS,
  GRID_PAGE_SIZES,
  type GridListMode,
} from '../lib/gridPagingConstants';
import { formatGridInfiniteRange } from '../lib/useGridListPresentation';
import { NativeButton } from './NativeButton';
import { FooterLabelDropdown } from './FooterLabelDropdown';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { useIsInsideDialogHost } from './dialog/DialogHostContext';
import {
  CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS,
  GRID_PAGING_FOOTER_CLASS,
  GRID_PAGING_FOOTER_CONTROLS_CLASS,
  GRID_PAGING_FOOTER_NAV_CLASS,
  GRID_PAGING_FOOTER_SEPARATOR_CLASS,
  HERO_TABLE_PAGING_FOOTER_CLASS,
} from './surfaceClasses';

export type GridPagingFooterChrome = 'page' | 'hero';

const PAGE_NAV_BUTTON_CLASS =
  'h-8 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer';

/** Match WorkspaceBack / wizard chevrons: flip in RTL so prev/next point along reading direction. */
const PAGE_NAV_ICON_CLASS = 'h-4 w-4 shrink-0 rtl:rotate-180';

export type GridPagingNavButtonLabelMode = 'icon' | 'iconAndLabel';

type PageNavButtonProps = {
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
  className?: string;
  labelMode: GridPagingNavButtonLabelMode;
  label: string;
  icon: React.ReactNode;
};

function PageNavButton({
  ariaLabel,
  disabled,
  onClick,
  className,
  labelMode,
  label,
  icon,
}: PageNavButtonProps) {
  const iconOnly = labelMode === 'icon';
  return (
    <NativeButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        PAGE_NAV_BUTTON_CLASS,
        'inline-flex gap-1.5',
        iconOnly ? 'min-w-8 w-8 px-0' : 'px-2 sm:px-2',
        className,
      )}
      aria-label={ariaLabel}
      title={iconOnly ? ariaLabel : undefined}
    >
      {icon}
      {iconOnly ? null : <span>{label}</span>}
    </NativeButton>
  );
}

export type GridPagingSortOption<TSort extends string> = {
  value: TSort;
  label: string;
};

type FooterMoreMenuProps = {
  ariaLabel: string;
  children: React.ReactNode;
};

function FooterMoreMenu({ ariaLabel, children }: FooterMoreMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative md:hidden">
      <NativeButton
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </NativeButton>
      {isOpen ? (
        <div
          className="absolute bottom-full end-0 z-20 mb-1 flex min-w-[10rem] flex-col gap-2 rounded-md border border-slate-200 bg-white p-2.5 shadow-md"
          role="menu"
          aria-label={ariaLabel}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type GridPagingFooterProps<TSort extends string> = {
  totalCount: number;
  safePage: number;
  pageSize: number;
  pageSizes?: readonly number[];
  onPageSizeChange: (size: number) => void;
  sortBy: TSort;
  sortOptions: ReadonlyArray<GridPagingSortOption<TSort>>;
  onSortByChange: (value: TSort) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSortDirection: () => void;
  totalPages: number;
  pageNumbers: number[];
  onPageChange: (page: number) => void;
  listMode?: GridListMode;
  onListModeChange?: (mode: GridListMode) => void;
  visibleInfiniteCount?: number;
  trailing?: React.ReactNode;
  showSortControls?: boolean;
  /** Page-size dropdown. Default on. Catalogs that lock size omit this. */
  showPageSizeControls?: boolean;
  showSummary?: boolean;
  showFirstLast?: boolean;
  showPageNumbers?: boolean;
  responsiveMode?: 'desktop' | 'tablet' | 'phone';
  /**
   * Force dialog inset chrome (10px from window L/R). When omitted, auto-applies inside
   * AppDialogShell / CreateEditModalShell via DialogHostContext.
   */
  edgeAlignInDialog?: boolean;
  /**
   * `page` — CRUD grey page-list band. `hero` — classic controls, hero body fill.
   * Outer rounded line is HERO_TABLE_JOINED_SHELL_CLASS on AppTableGrid chrome=hero.
   * Hero chrome never uses dialog page-list inset.
   */
  chrome?: GridPagingFooterChrome;
  /** First/prev/next/last: icon-only (default) or icon plus translated label. */
  navButtonLabelMode?: GridPagingNavButtonLabelMode;
  /** Merged onto the footer shell (e.g. flush paging band inside a full-bleed modal grid). */
  className?: string;
};

export function formatGridShowingRange(totalCount: number, safePage: number, pageSize: number): string {
  if (totalCount === 0) {
    return 'Showing 0-0 of 0';
  }

  const start = ((safePage - 1) * pageSize) + 1;
  const end = Math.min(totalCount, safePage * pageSize);
  return `Showing ${start}-${end} of ${totalCount}`;
}

export function GridPagingFooter<TSort extends string>({
  totalCount,
  safePage,
  pageSize,
  pageSizes = GRID_PAGE_SIZES,
  onPageSizeChange,
  sortBy,
  sortOptions,
  onSortByChange,
  sortDirection,
  onToggleSortDirection,
  totalPages,
  pageNumbers,
  onPageChange,
  listMode,
  onListModeChange,
  visibleInfiniteCount,
  trailing,
  showSortControls = true,
  showPageSizeControls = true,
  showSummary = true,
  showFirstLast = true,
  showPageNumbers = true,
  responsiveMode,
  edgeAlignInDialog,
  chrome = 'page',
  navButtonLabelMode = 'icon',
  className,
}: GridPagingFooterProps<TSort>) {
  const insideDialog = useIsInsideDialogHost();
  const isHeroChrome = chrome === 'hero';
  const useDialogInset = !isHeroChrome && (
    edgeAlignInDialog === true || (edgeAlignInDialog !== false && insideDialog)
  );
  const footerShellClass = isHeroChrome
    ? HERO_TABLE_PAGING_FOOTER_CLASS
    : useDialogInset
      ? CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS
      : GRID_PAGING_FOOTER_CLASS;
  const culture = useOptionalCulture();
  const label = React.useCallback((key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  ), [culture?.ready, culture?.t]);

  const pageSizeOptions = pageSizes.map((size) => ({
    value: size,
    label: culture?.ready
      ? formatCulturePageSizeLabel(culture.t, size)
      : `${size} / page`,
  }));
  const isInfiniteMode = listMode === 'infinite';
  const rangeLabel = isInfiniteMode
    ? (culture?.ready
      ? formatCultureGridInfiniteRange(
        culture.t,
        visibleInfiniteCount ?? totalCount,
        totalCount,
      )
      : formatGridInfiniteRange(visibleInfiniteCount ?? totalCount, totalCount))
    : (culture?.ready
      ? formatCultureGridShowingRange(culture.t, totalCount, safePage, pageSize)
      : formatGridShowingRange(totalCount, safePage, pageSize));

  const listModeOptions = GRID_LIST_MODE_OPTIONS.map((option) => ({
    value: option.value,
    label: label(option.value === 'paging' ? 'grid.paging' : 'grid.infinite'),
  }));

  const pageSizeControl = showPageSizeControls ? (
    <FooterLabelDropdown
      value={pageSize}
      options={pageSizeOptions}
      onChange={onPageSizeChange}
      ariaLabel={label('grid.itemsPerPage')}
      activeLabel={culture?.ready
        ? formatCulturePageSizeLabel(culture.t, pageSize)
        : `${pageSize} / page`}
    />
  ) : null;

  const sortControls = showSortControls ? (
    <div className="flex items-center gap-1">
      <FooterLabelDropdown
        value={sortBy}
        options={sortOptions}
        onChange={onSortByChange}
        ariaLabel={label('grid.orderBy')}
      />
      <NativeButton
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm border-0 bg-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
        aria-label={sortDirection === 'asc' ? label('grid.sortAscending') : label('grid.sortDescending')}
        title={sortDirection === 'asc' ? label('grid.sortAscShort') : label('grid.sortDescShort')}
        onClick={onToggleSortDirection}
      >
        {sortDirection === 'asc'
          ? <ArrowUpAZ className="h-3.5 w-3.5" />
          : <ArrowDownAZ className="h-3.5 w-3.5" />}
      </NativeButton>
    </div>
  ) : null;

  const listModeControl = listMode && onListModeChange ? (
    <div className="flex items-center gap-1">
      {listMode === 'paging'
        ? <List className="h-3.5 w-3.5 text-slate-500" />
        : <InfinityIcon className="h-3.5 w-3.5 text-slate-500" />}
      <FooterLabelDropdown
        value={listMode}
        options={listModeOptions}
        onChange={onListModeChange}
        ariaLabel={label('grid.listMode')}
      />
    </div>
  ) : null;

  const leftControlParts = [
    pageSizeControl,
    sortControls,
    listModeControl,
    trailing,
  ].filter((part): part is React.ReactNode => part != null && part !== false);

  const renderSeparatedControls = (parts: React.ReactNode[]) => parts.map((part, index) => (
    <React.Fragment key={`footer-control-${index}`}>
      {index > 0 ? (
        <span className={GRID_PAGING_FOOTER_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      {part}
    </React.Fragment>
  ));

  const hasOverflowControls = leftControlParts.length > 0;

  return (
    <div
      className={cn(footerShellClass, !isHeroChrome && 'min-h-11', className)}
      data-grid-paging-chrome={chrome}
      {...pageGuideLocalProps(
        PAGE_GUIDE_EN['pageGuide.page.paging.title'],
        PAGE_GUIDE_EN['pageGuide.page.paging.hint'],
        24,
      )}
    >
      <div className={GRID_PAGING_FOOTER_CONTROLS_CLASS}>
        {showSummary ? <span className="font-medium text-slate-600">{rangeLabel}</span> : null}
        {showSummary && leftControlParts.length > 0 ? (
          <span
            className={cn(
              GRID_PAGING_FOOTER_SEPARATOR_CLASS,
              responsiveMode === 'phone' ? 'hidden' : responsiveMode ? undefined : 'hidden md:block',
            )}
            aria-hidden="true"
          />
        ) : null}
        <div className={cn(
          'items-center gap-2 flex-wrap',
          responsiveMode === 'phone' ? 'hidden' : responsiveMode ? 'flex' : 'hidden md:flex',
        )}>
          {renderSeparatedControls(leftControlParts)}
        </div>
        {hasOverflowControls && (responsiveMode === 'phone' || responsiveMode == null) ? (
          <FooterMoreMenu ariaLabel={label('grid.moreOptions')}>
            {pageSizeControl}
            {sortControls}
            {listModeControl}
            {trailing}
          </FooterMoreMenu>
        ) : null}
      </div>

      {!isInfiniteMode ? (
        <div className={GRID_PAGING_FOOTER_NAV_CLASS}>
          {showFirstLast ? (
            <PageNavButton
              ariaLabel={label('grid.first')}
              label={label('grid.first')}
              labelMode={navButtonLabelMode}
              icon={<ChevronsLeft className={PAGE_NAV_ICON_CLASS} aria-hidden="true" />}
              onClick={() => onPageChange(1)}
              disabled={safePage <= 1}
              className={responsiveMode === 'desktop' ? undefined : responsiveMode ? 'hidden' : 'hidden md:inline-flex'}
            />
          ) : null}
          <PageNavButton
            ariaLabel={label('grid.prev')}
            label={label('grid.prev')}
            labelMode={navButtonLabelMode}
            icon={<ChevronLeft className={PAGE_NAV_ICON_CLASS} aria-hidden="true" />}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className={navButtonLabelMode === 'icon' ? undefined : 'flex-1 sm:flex-none'}
          />
          {showPageNumbers ? <div className={cn(
            'items-center gap-1.5',
            responsiveMode === 'desktop' ? 'flex' : responsiveMode ? 'hidden' : 'hidden lg:flex',
          )}>
            {pageNumbers.map((pageNumber) => (
              <NativeButton
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                className={cn(
                  PAGE_NAV_BUTTON_CLASS,
                  'min-w-8 px-2',
                  pageNumber === safePage
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : undefined,
                )}
              >
                {pageNumber}
              </NativeButton>
            ))}
          </div> : null}
          <span className={cn(
            'px-1 text-[11px] font-semibold text-slate-500',
            responsiveMode === 'desktop' && showPageNumbers ? 'hidden' : responsiveMode ? 'inline' : 'lg:hidden',
          )}>
            {safePage}
            /
            {Math.max(totalPages, 1)}
          </span>
          <PageNavButton
            ariaLabel={label('grid.next')}
            label={label('grid.next')}
            labelMode={navButtonLabelMode}
            icon={<ChevronRight className={PAGE_NAV_ICON_CLASS} aria-hidden="true" />}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className={navButtonLabelMode === 'icon' ? undefined : 'flex-1 sm:flex-none'}
          />
          {showFirstLast ? (
            <PageNavButton
              ariaLabel={label('grid.last')}
              label={label('grid.last')}
              labelMode={navButtonLabelMode}
              icon={<ChevronsRight className={PAGE_NAV_ICON_CLASS} aria-hidden="true" />}
              onClick={() => onPageChange(totalPages)}
              disabled={safePage >= totalPages}
              className={responsiveMode === 'desktop' ? undefined : responsiveMode ? 'hidden' : 'hidden md:inline-flex'}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
