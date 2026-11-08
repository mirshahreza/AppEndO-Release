/** Shared compact sizing tokens for the dashboard surface. */
export const DASHBOARD_PAGE_PADDING_CLASS = 'p-4 lg:p-5';
export const DASHBOARD_PAGE_GAP_CLASS = 'gap-4';
const DASHBOARD_GRID_GAP_CLASS = 'gap-4';
export const DASHBOARD_MASONRY_GAP_CLASS = 'gap-4';
const DASHBOARD_MASONRY_TILE_CLASS = 'mb-4 break-inside-avoid';
export const DASHBOARD_WIDGET_MOVE_TRANSITION =
  'top 200ms ease, inset-inline-start 200ms ease, width 200ms ease';
export const DASHBOARD_DRAG_GRID_CLASS =
  'pointer-events-none absolute inset-0 grid grid-cols-12 gap-4';
export const DASHBOARD_DRAG_GRID_TRACK_CLASS = 'h-full rounded-2xl bg-slate-900/[0.035]';
export const DASHBOARD_DROP_PLACEHOLDER_CLASS =
  'pointer-events-none rounded-3xl border-2 border-dashed border-primary-400/50 bg-primary-500/[0.06]';

/** Linear/Stripe card elevation — hairline slate, white fill, soft dual shadow. */
export const DASHBOARD_SURFACE_CLASS =
  'overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_-1px_rgba(0,0,0,0.05)] transition-[box-shadow] duration-200 ease-out hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.08)] select-none';

export const DASHBOARD_WIDGET_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 bg-white px-3 py-2.5';
export const DASHBOARD_WIDGET_INLINE_HEADER_CLASS = 'mb-2 flex min-w-0 items-center px-1';

export const DASHBOARD_WIDGET_TITLE_CLASS = 'text-sm font-semibold leading-tight tracking-tight text-slate-900';
export const DASHBOARD_WIDGET_SUBTITLE_CLASS = 'mt-0.5 text-xs leading-tight text-slate-500';

/** Theme ink on small chrome — follows operator accent, never a card fill. */
const DASHBOARD_THEME_INK_CLASS = 'text-primary-700';
const DASHBOARD_THEME_MUTED_INK_CLASS = 'text-primary-600';
const DASHBOARD_NEUTRAL_WELL_CLASS = 'bg-slate-100';
const DASHBOARD_THEME_TINT_CLASS = DASHBOARD_NEUTRAL_WELL_CLASS;
const DASHBOARD_THEME_WELL_CLASS = `${DASHBOARD_NEUTRAL_WELL_CLASS} ${DASHBOARD_THEME_INK_CLASS}`;
const DASHBOARD_COMPLEMENT_INK_CLASS = 'text-slate-600';
const DASHBOARD_COMPLEMENT_TINT_CLASS = DASHBOARD_NEUTRAL_WELL_CLASS;
const DASHBOARD_COMPLEMENT_WELL_CLASS = `${DASHBOARD_COMPLEMENT_TINT_CLASS} ${DASHBOARD_COMPLEMENT_INK_CLASS}`;
const DASHBOARD_TERTIARY_INK_CLASS = 'text-slate-600';
const DASHBOARD_TERTIARY_TINT_CLASS = DASHBOARD_NEUTRAL_WELL_CLASS;
const DASHBOARD_TERTIARY_WELL_CLASS = `${DASHBOARD_TERTIARY_TINT_CLASS} ${DASHBOARD_TERTIARY_INK_CLASS}`;

export const DASHBOARD_HEADER_ICON_WELL_CLASS =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 [&_svg]:shrink-0';
export const DASHBOARD_HEADER_ICON_CLASS = 'h-3.5 w-3.5 text-primary-700';
export const DASHBOARD_INLINE_ICON_CLASS = 'h-3 w-3';
const DASHBOARD_TILE_ICON_CLASS = 'h-3.5 w-3.5';
const DASHBOARD_QUICK_ACTION_ICON_CLASS = 'h-4 w-4 text-primary-700';
export const DASHBOARD_QUICK_ACTION_ICON_WELL_CLASS =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100';
export const DASHBOARD_QUICK_ACTION_CARD_CLASS =
  'group flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50';
export const DASHBOARD_ICON_ONLY_TILE_CLASS =
  'group flex aspect-square w-full items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50';
export const DASHBOARD_ICON_ONLY_WELL_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition-colors group-hover:bg-white';
/** Icon + faint caption — no nested tile border/well. */
export const DASHBOARD_CAPTION_ACTION_CLASS =
  'group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-lg border border-slate-100 px-0.5 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50';
export const DASHBOARD_CAPTION_ACTION_ICON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-md';
export const DASHBOARD_CAPTION_ACTION_GLYPH_CLASS = 'h-4 w-4 text-primary-700';
export const DASHBOARD_CAPTION_ACTION_LABEL_CLASS =
  'w-full text-center text-[10px] font-medium leading-snug text-slate-600 line-clamp-2 group-hover:text-slate-800';
export const DASHBOARD_CAPTION_ACTION_LABEL_DANGER_CLASS =
  'text-rose-600 group-hover:text-rose-700';
export const DASHBOARD_CAPTION_ACTION_LABEL_MUTED_CLASS =
  'text-slate-600 group-hover:text-slate-800';
export const DASHBOARD_KPI_STATUS_VALUE_CLASS =
  'text-lg font-semibold leading-snug tracking-tight text-slate-800';
export const DASHBOARD_BODY_PAD_STRIP_CLASS = 'px-3 py-2 pb-3';
export const DASHBOARD_HEADER_ACTIONS_CLASS = 'flex h-8 items-center gap-2 leading-none';
export const DASHBOARD_HEADER_CHIP_CLASS =
  'inline-flex h-8 min-h-8 max-h-8 shrink-0 box-border items-center justify-center gap-1.5 rounded-md px-2.5 py-0 text-xs font-semibold leading-none whitespace-nowrap transition-colors';
export const DASHBOARD_HEADER_DIVIDER_CLASS = 'h-4 w-px shrink-0 self-center rounded-full bg-border-divider';
const DASHBOARD_STACK_COLUMN_CLASS = 'flex min-h-0 flex-1 flex-col gap-4 self-stretch';
const DASHBOARD_STACK_ITEM_CLASS = 'flex min-h-0 flex-1 flex-col [&>*]:h-full [&>*]:min-h-0';

export const DASHBOARD_BODY_PAD_CLASS = 'p-4';
const DASHBOARD_BODY_PAD_COMPACT_CLASS = 'p-4';

export const DASHBOARD_LIST_DIVIDER_CLASS = 'divide-y divide-slate-100';
export const DASHBOARD_LIST_ROW_CLASS = 'px-4 py-3 text-xs';
export const DASHBOARD_LIST_ROW_HOVER_CLASS = 'transition-colors hover:bg-slate-50';
export const DASHBOARD_EMPTY_STATE_CLASS =
  'flex h-full min-h-[4.5rem] items-center justify-center px-4 py-5 text-center text-xs text-slate-500';

export const DASHBOARD_META_LINK_CLASS = 'text-xs font-semibold text-primary-600 hover:text-primary-700';
export const DASHBOARD_BADGE_CLASS = 'text-xs font-semibold leading-none';
export const DASHBOARD_COUNT_BADGE_CLASS = 'px-1.5 py-0.5 text-[10px] font-semibold';

const DASHBOARD_CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs';
const DASHBOARD_CHIP_THEME_ACTIVE_CLASS =
  'border-primary-500/20 bg-slate-100 text-primary-700';
const DASHBOARD_CHIP_THEME_IDLE_CLASS =
  'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800';
const DASHBOARD_CHIP_COMPLEMENT_ACTIVE_CLASS =
  'border-slate-200 bg-slate-100 text-slate-700';
const DASHBOARD_CHIP_COMPLEMENT_IDLE_CLASS =
  'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800';

export const DASHBOARD_KPI_STACK_GRID_CLASS = `grid auto-rows-fr grid-cols-1 items-stretch ${DASHBOARD_GRID_GAP_CLASS}`;
export const DASHBOARD_KPI_QUAD_GRID_CLASS = `grid auto-rows-fr grid-cols-2 items-stretch ${DASHBOARD_GRID_GAP_CLASS}`;
export const DASHBOARD_KPI_ROW3_GRID_CLASS = `grid auto-rows-fr grid-cols-3 items-stretch ${DASHBOARD_GRID_GAP_CLASS}`;
export const DASHBOARD_KPI_ROW4_GRID_CLASS = `grid auto-rows-fr grid-cols-4 items-stretch ${DASHBOARD_GRID_GAP_CLASS}`;
export const DASHBOARD_KPI_GRID_CLASS = `grid grid-cols-12 grid-rows-2 items-stretch ${DASHBOARD_GRID_GAP_CLASS}`;
export const DASHBOARD_KPI_FEATURED_SPAN_CLASS = 'col-span-6 row-span-2';
export const DASHBOARD_KPI_SECONDARY_SPAN_CLASS = 'col-span-6';
export const DASHBOARD_KPI_TERTIARY_SPAN_CLASS = 'col-span-3';
export const DASHBOARD_KPI_PAD_CLASS = 'flex h-full flex-col justify-center gap-1 px-3 py-2';
export const DASHBOARD_KPI_FEATURED_PAD_CLASS = 'flex h-full flex-col justify-center gap-2 px-5 py-4';
export const DASHBOARD_KPI_VALUE_CLASS = 'text-2xl font-bold tabular-nums leading-none tracking-tight text-slate-900';
export const DASHBOARD_KPI_FEATURED_VALUE_CLASS = 'text-4xl font-bold tabular-nums leading-none tracking-tight text-slate-900';
export const DASHBOARD_KPI_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wider text-slate-500';
export const DASHBOARD_KPI_HINT_CLASS = 'text-xs text-slate-500';
export const DASHBOARD_KPI_SKELETON_HEIGHT_CLASS = 'h-24';
export const DASHBOARD_KPI_FEATURED_SKELETON_CLASS = 'row-span-2 min-h-[13rem]';

/** Pick a column count that fills the widget without a leftover empty cell. */
export const dashboardQuickActionGridClass = (count: number): string => {
  if (count <= 3) {
    return `grid h-full auto-rows-fr grid-cols-1 ${DASHBOARD_GRID_GAP_CLASS}`;
  }
  if (count % 2 === 0) {
    return `grid h-full auto-rows-fr grid-cols-1 sm:grid-cols-2 ${DASHBOARD_GRID_GAP_CLASS}`;
  }
  return `grid h-full auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 ${DASHBOARD_GRID_GAP_CLASS}`;
};

/** Personal account shortcuts stay on one or two columns so half-width Home tiles stay readable. */
export const dashboardMyLinksGridClass = (count: number): string => {
  if (count <= 2) {
    return `grid h-full auto-rows-fr grid-cols-1 ${DASHBOARD_GRID_GAP_CLASS}`;
  }
  return `grid h-full auto-rows-fr grid-cols-1 sm:grid-cols-2 ${DASHBOARD_GRID_GAP_CLASS}`;
};

const DASHBOARD_FIT_GRID_CLASS = {
  1: `grid auto-rows-fr grid-cols-1 ${DASHBOARD_GRID_GAP_CLASS}`,
  2: `grid auto-rows-fr grid-cols-2 ${DASHBOARD_GRID_GAP_CLASS}`,
  3: `grid auto-rows-fr grid-cols-3 ${DASHBOARD_GRID_GAP_CLASS}`,
  4: `grid auto-rows-fr grid-cols-4 ${DASHBOARD_GRID_GAP_CLASS}`,
} as const;

const DASHBOARD_FIT_ICON_GRID_CLASS = {
  3: `grid grid-cols-3 ${DASHBOARD_GRID_GAP_CLASS}`,
  4: `grid grid-cols-4 ${DASHBOARD_GRID_GAP_CLASS}`,
  5: `grid grid-cols-5 ${DASHBOARD_GRID_GAP_CLASS}`,
  6: `grid grid-cols-6 ${DASHBOARD_GRID_GAP_CLASS}`,
} as const;

const DASHBOARD_FIT_CAPTION_GRID_CLASS = {
  3: 'grid grid-cols-3 gap-1',
  4: 'grid grid-cols-4 gap-1',
  5: 'grid grid-cols-5 gap-1',
  6: 'grid grid-cols-6 gap-1',
} as const;

/** Inner grids follow the tile's measured width, not the page breakpoint. */
const dashboardFitGridClass = (columns: 1 | 2 | 3 | 4): string =>
  DASHBOARD_FIT_GRID_CLASS[columns];

const dashboardFitIconGridClass = (columns: 3 | 4 | 5 | 6): string =>
  DASHBOARD_FIT_ICON_GRID_CLASS[columns];

const dashboardFitActionGridClass = (
  showLabels: boolean,
  columns: 1 | 2 | 3 | 4,
  iconColumns: 3 | 4 | 5 | 6,
): string => (showLabels ? dashboardFitGridClass(columns) : dashboardFitIconGridClass(iconColumns));

export const dashboardFitCaptionGridClass = (iconColumns: 3 | 4 | 5 | 6): string =>
  DASHBOARD_FIT_CAPTION_GRID_CLASS[iconColumns];

const DASHBOARD_STAT_VALUE_CLASS = 'text-xl font-bold tabular-nums tracking-tight text-slate-900';
const DASHBOARD_STAT_LABEL_CLASS = 'text-xs text-slate-500';

/** Page fill tracks `--app-shell-bg` so Theme Designer chrome isolation stays in sync. */
export const DASHBOARD_WORKSPACE_BG_CLASS = 'select-none bg-surface-shell';
