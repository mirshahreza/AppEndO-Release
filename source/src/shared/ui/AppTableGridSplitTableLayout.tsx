import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { resolveSplitTableHeaderTransform } from '../lib/appTableGridHorizontalScroll';
import { cn } from '../../lib/utils';
import type { AppTableGridColumnDef } from '../lib/appTableGridQuery';
import {
  buildAppTableGridColumnWidthStyle,
  type GridColumnLayoutState,
} from '../lib/appTableGridColumnLayout';

export function buildAppTableGridColGroup<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  layout: GridColumnLayoutState,
): React.ReactNode {
  return (
    <colgroup>
      {columns.map((column) => {
        const style = buildAppTableGridColumnWidthStyle(column, layout);
        return <col key={column.id} style={style} />;
      })}
    </colgroup>
  );
}

/**
 * Fill + clip only — header chrome (bg, bottom rule) comes from `theadClassName`.
 * Pinned header cells inherit `--app-table-grid-pin-bg` so they match the band (body pins stay white).
 */
const HEADER_BAND_CLASS =
  'w-full shrink-0 overflow-hidden bg-slate-100 [--app-table-grid-pin-bg:theme(colors.slate.100)] [&_th]:bg-[var(--app-table-grid-pin-bg,theme(colors.slate.100))]';

export function syncSplitHeaderTableWidth(
  body: HTMLElement | null,
  headerTable: HTMLTableElement | null,
): void {
  if (!body || !headerTable) {
    return;
  }
  const bodyTable = body.querySelector('table');
  if (!bodyTable) {
    return;
  }
  // Body table keeps `w-full` from APP_TABLE_GRID_TABLE_CLASS — do not set inline width on it
  // or table-fixed stops expanding the flex column to the scrollport (Roles-style fill).
  bodyTable.style.removeProperty('width');
  bodyTable.style.minWidth = '100%';

  const width = Math.max(
    body.clientWidth,
    bodyTable.getBoundingClientRect().width,
    bodyTable.scrollWidth,
  );
  if (width <= 0) {
    return;
  }
  const widthPx = `${width}px`;
  headerTable.style.width = widthPx;
  headerTable.style.minWidth = widthPx;
}

export function syncSplitHeaderScrollbarGutter(
  body: HTMLElement | null,
  headerBand: HTMLElement | null,
): void {
  if (!body || !headerBand) {
    return;
  }
  const gutter = Math.max(0, body.offsetWidth - body.clientWidth);
  headerBand.style.paddingInlineEnd = gutter > 0 ? `${gutter}px` : '';
}

export type AppTableGridSplitTableLayoutProps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  bodyScrollClassName: string;
  tableClassName: string;
  tableAriaLabel?: string;
  tableWidthClassName?: string;
  colGroup?: React.ReactNode;
  theadClassName: string;
  headerRow: React.ReactNode;
  tbodyClassName?: string;
  tbodyProps?: React.ComponentPropsWithoutRef<'tbody'>;
  children: React.ReactNode;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  bodyRole?: React.AriaRole;
  bodyTabIndex?: number;
  bodyAriaLabel?: string;
  bodyDataScrollOwner?: string;
  /** Overlay thumbs (native bars hidden on the viewport). */
  scrollOverlay?: React.ReactNode;
  /** Pad the header band when native scrollbars consume body width. */
  syncHeaderScrollbarGutter?: boolean;
};

export function AppTableGridSplitTableLayout({
  scrollRef,
  bodyScrollClassName,
  tableClassName,
  tableAriaLabel,
  tableWidthClassName,
  colGroup,
  theadClassName,
  headerRow,
  tbodyClassName,
  tbodyProps,
  children,
  onScroll,
  onMouseEnter,
  onMouseLeave,
  bodyRole,
  bodyTabIndex,
  bodyAriaLabel,
  bodyDataScrollOwner,
  scrollOverlay,
  syncHeaderScrollbarGutter = false,
}: AppTableGridSplitTableLayoutProps) {
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const headerBandRef = useRef<HTMLDivElement>(null);

  const syncHeaderLayout = useCallback(() => {
    const body = scrollRef.current;
    const headerTable = headerBandRef.current?.querySelector('table');
    if (headerTable instanceof HTMLTableElement) {
      syncSplitHeaderTableWidth(body, headerTable);
    }
    if (!syncHeaderScrollbarGutter) {
      if (headerBandRef.current) {
        headerBandRef.current.style.paddingInlineEnd = '';
      }
      return;
    }
    syncSplitHeaderScrollbarGutter(body, headerBandRef.current);
  }, [scrollRef, syncHeaderScrollbarGutter]);

  useLayoutEffect(() => {
    syncHeaderLayout();
    const body = scrollRef.current;
    if (!body || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => syncHeaderLayout());
    observer.observe(body);
    const bodyTable = body.querySelector('table');
    if (bodyTable) {
      observer.observe(bodyTable);
    }
    return () => observer.disconnect();
  }, [syncHeaderLayout, children]);

  const syncHeaderScrollTransform = useCallback((scrollHost: HTMLDivElement | null) => {
    if (!headerInnerRef.current || !scrollHost) {
      return;
    }
    headerInnerRef.current.style.transform = resolveSplitTableHeaderTransform(scrollHost);
  }, []);

  useLayoutEffect(() => {
    syncHeaderScrollTransform(scrollRef.current);
  }, [children, scrollRef, syncHeaderScrollTransform]);

  const handleBodyScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    syncHeaderScrollTransform(event.currentTarget);
    onScroll?.(event);
  }, [onScroll, syncHeaderScrollTransform]);

  const resolvedTableClassName = cn(
    tableClassName,
    'table-fixed',
    tableWidthClassName,
    tableWidthClassName && '!w-max',
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      data-table-grid-split-scroll="true"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        ref={headerBandRef}
        className={cn(HEADER_BAND_CLASS, theadClassName)}
        data-table-grid-header-band="true"
      >
        <div ref={headerInnerRef} className="w-full min-w-0">
          <table className={cn(resolvedTableClassName, 'min-w-full')}>
            {colGroup}
            <thead>
              {headerRow}
            </thead>
          </table>
        </div>
      </div>
      {scrollOverlay ? (
        <div className="relative min-h-0 min-w-0 flex flex-1 flex-col">
          <div
            ref={scrollRef}
            className={bodyScrollClassName}
            role={bodyRole}
            tabIndex={bodyTabIndex}
            aria-label={bodyAriaLabel}
            data-table-grid-scroll-owner={bodyDataScrollOwner}
            onScroll={handleBodyScroll}
          >
            <table className={cn(resolvedTableClassName, 'min-w-full')} aria-label={tableAriaLabel}>
              {colGroup}
              <tbody className={tbodyClassName} {...tbodyProps}>
                {children}
              </tbody>
            </table>
          </div>
          {scrollOverlay}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={bodyScrollClassName}
          role={bodyRole}
          tabIndex={bodyTabIndex}
          aria-label={bodyAriaLabel}
          data-table-grid-scroll-owner={bodyDataScrollOwner}
          onScroll={handleBodyScroll}
        >
          <table className={cn(resolvedTableClassName, 'min-w-full')} aria-label={tableAriaLabel}>
            {colGroup}
            <tbody className={tbodyClassName} {...tbodyProps}>
              {children}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
