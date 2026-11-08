import type { CSSProperties } from 'react';

/** Vertical scroll ownership — `panel` grows with rows so an outer shell scrolls. */
export type AppTableGridScrollOwner = 'self' | 'panel';

/**
 * Scrollbar layout on grid scrollports (`scrollOwner="self"`).
 * `overlay` — custom thumbs over the grid; native bars hidden (no width gutter on load).
 * `native` — OS scrollbars; split sticky header syncs header padding to the vertical gutter.
 */
export type AppTableGridScrollGutter = 'overlay' | 'native';

export const DEFAULT_APP_TABLE_GRID_SCROLL_GUTTER: AppTableGridScrollGutter = 'overlay';

export function resolveAppTableGridScrollGutter(
  scrollGutter: AppTableGridScrollGutter | undefined,
): AppTableGridScrollGutter {
  return scrollGutter === 'native' ? 'native' : DEFAULT_APP_TABLE_GRID_SCROLL_GUTTER;
}

/**
 * Visual treatment on AppTableGrid.
 * `classic` is the flush page-list default. `hero` is the joined card + airy rows.
 */
export type AppTableGridChrome = 'classic' | 'hero';

export const APP_TABLE_GRID_MARGIN_OPTIONS = [0, 4, 8, 12, 16] as const;
export type AppTableGridMarginPx = (typeof APP_TABLE_GRID_MARGIN_OPTIONS)[number];
/** Page lists stay flush; pass a positive inset for embedded cards. */
export const DEFAULT_APP_TABLE_GRID_MARGIN_PX = 0;
/** Hero chrome card inset from the parent. */
export const DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX = 4;

export const APP_TABLE_GRID_BORDER_WIDTH_OPTIONS = [0, 1, 2, 3, 4, 5] as const;
export type AppTableGridBorderWidthPx = (typeof APP_TABLE_GRID_BORDER_WIDTH_OPTIONS)[number];
const APP_TABLE_GRID_BORDER_WIDTH_MAX_PX =
  APP_TABLE_GRID_BORDER_WIDTH_OPTIONS[APP_TABLE_GRID_BORDER_WIDTH_OPTIONS.length - 1];
/** Page lists use the table's own edge; pass a positive width for a joined card outline. */
export const DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX = 0;
/** Hero chrome outline around grid + paging. */
export const DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX = 5;

/** Left/right cell padding (inline-start and inline-end). Default 5px on every column. */
export const APP_TABLE_GRID_CELL_PADDING_X_OPTIONS = [0, 2, 3, 4, 5, 8, 12] as const;
export type AppTableGridCellPaddingXPx = (typeof APP_TABLE_GRID_CELL_PADDING_X_OPTIONS)[number];
export const DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX = 5;
export const APP_TABLE_GRID_CELL_PADDING_X_VAR = '--app-table-grid-cell-px';

function resolvePositivePx(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.round(value);
}

export function resolveAppTableGridMarginPx(
  margin: number | undefined,
  fallback: number = DEFAULT_APP_TABLE_GRID_MARGIN_PX,
): number {
  return resolvePositivePx(margin, fallback);
}

export function resolveAppTableGridBorderWidthPx(
  borderWidth: number | undefined,
  fallback: number = DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX,
): number {
  return Math.min(APP_TABLE_GRID_BORDER_WIDTH_MAX_PX, resolvePositivePx(borderWidth, fallback));
}

export function resolveAppTableGridCellPaddingXPx(
  cellPaddingX?: number,
  fallback: number = DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX,
): number {
  return resolvePositivePx(cellPaddingX, fallback);
}

export function appTableGridCellPaddingXStyle(cellPaddingXPx: number): CSSProperties {
  return { [APP_TABLE_GRID_CELL_PADDING_X_VAR]: `${cellPaddingXPx}px` };
}

const APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR = '--app-table-grid-last-column-overlay-inset';

export function appTableGridOverlayScrollInsetStyle(
  insetPx: number = 13,
): CSSProperties {
  return { [APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR]: `${insetPx}px` };
}

export function usesAppTableGridOverlayScrollInset(
  scrollOwner: AppTableGridScrollOwner | undefined,
  scrollGutter: AppTableGridScrollGutter | undefined,
): boolean {
  return (scrollOwner ?? 'self') !== 'panel' && resolveAppTableGridScrollGutter(scrollGutter) === 'overlay';
}

/** Height 100% only applies when this grid owns vertical overflow. */
export function resolveAppTableGridFillHost(
  scrollOwner: AppTableGridScrollOwner | undefined,
  fillHeight: boolean | undefined,
): boolean {
  return (scrollOwner ?? 'self') === 'self' && fillHeight !== false;
}

export function resolveAppTableGridChrome(
  chrome: AppTableGridChrome | undefined,
): AppTableGridChrome {
  return chrome === 'hero' ? 'hero' : 'classic';
}

export function isAppTableGridHeroChrome(chrome: AppTableGridChrome | undefined): boolean {
  return resolveAppTableGridChrome(chrome) === 'hero';
}

/** Hero chrome uses the joined-card inset unless the caller set margin. */
export function resolveAppTableGridChromeMarginPx(
  chrome: AppTableGridChrome | undefined,
  margin?: number,
): number {
  return resolveAppTableGridMarginPx(
    margin,
    isAppTableGridHeroChrome(chrome)
      ? DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX
      : DEFAULT_APP_TABLE_GRID_MARGIN_PX,
  );
}

/** Hero chrome uses the joined-card outline unless the caller set borderWidth. */
export function resolveAppTableGridChromeBorderWidthPx(
  chrome: AppTableGridChrome | undefined,
  borderWidth?: number,
): number {
  return resolveAppTableGridBorderWidthPx(
    borderWidth,
    isAppTableGridHeroChrome(chrome)
      ? DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX
      : DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX,
  );
}

/** Map grid chrome onto GridPagingFooter so the joined card and footer band match. */
export function resolveGridPagingFooterChrome(
  chrome: AppTableGridChrome | undefined,
): 'page' | 'hero' {
  return isAppTableGridHeroChrome(chrome) ? 'hero' : 'page';
}

/** Column-header sort/filter affordances: inline in the header row, or revealed on hover overlay. */
export type AppTableGridHeaderQueryControlsVisibility = 'always' | 'hover';

export const DEFAULT_APP_TABLE_GRID_HEADER_QUERY_CONTROLS_VISIBILITY: AppTableGridHeaderQueryControlsVisibility =
  'hover';

export function resolveAppTableGridHeaderQueryControlsVisibility(
  visibility: AppTableGridHeaderQueryControlsVisibility | undefined,
): AppTableGridHeaderQueryControlsVisibility {
  return visibility === 'always' ? 'always' : DEFAULT_APP_TABLE_GRID_HEADER_QUERY_CONTROLS_VISIBILITY;
}
