import { cn } from '../../../lib/utils';
import { TYPE_CAPTION_CLASS, TYPE_PAGE_TITLE_CLASS } from '../../../shared/ui/typographyRoles';
/** Modeler panel page wash — slate-50 / #F8FAFC */
export const MODELER_PAGE_SURFACE_CLASS = 'bg-slate-50 text-slate-900';

/** Group / section card — white with neutral border #E2E8F0 */
export const MODELER_CARD_SURFACE_CLASS = cn(
  'rounded-lg border border-slate-200 bg-white',
);

/** Thin start accent on named groups — pair with a `text-*` color class + `bg-current`. */
export const MODELER_GROUP_ACCENT_BAR_CLASS =
  'pointer-events-none absolute inset-y-0 start-0 w-0.5 rounded-s-lg bg-current';

/** Field chips (Columns) — slate-100 / slate-900; roman medium for identifiers */
export const MODELER_FIELD_CHIP_CLASS = cn(
  'border-slate-200 bg-slate-100 font-medium not-italic text-slate-900',
  'hover:border-slate-300 hover:bg-slate-100/90',
);

/** Relation cards — white shell; soft slate hover (no indigo wash) */
export const MODELER_RELATION_CHIP_CLASS = cn(
  'border-slate-200 bg-white not-italic text-slate-900',
  'hover:border-slate-300 hover:bg-slate-50',
);

/** Relation name — roman emphasis; badges stay roman */
export const MODELER_RELATION_TITLE_CLASS =
  'min-w-0 flex-1 truncate text-xs font-semibold leading-tight not-italic';

/** Shared focus ring for modeler chips */
export const MODELER_CHIP_FOCUS_CLASS = 'focus-visible:ring-2 focus-visible:ring-slate-300';

/** Icons / status marks — single neutral #94A3B8 */
export const MODELER_NEUTRAL_ICON_CLASS = 'text-slate-400';

/** Typography ladder for modeler chrome (title → body → caption). */
export const MODELER_TITLE_CLASS =
  `m-0 truncate font-mono leading-none text-slate-800 ${TYPE_PAGE_TITLE_CLASS}`;

export const MODELER_SUBTITLE_CLASS =
  `min-w-0 truncate leading-none text-slate-500 ${TYPE_CAPTION_CLASS}`;

export const MODELER_CAPTION_CLASS =
  `${TYPE_CAPTION_CLASS} leading-snug text-slate-500`;

/** Dashed empty-state shell — Story / Columns / Relations / APIs. */
export const MODELER_EMPTY_STATE_CLASS = cn(
  'flex w-full min-w-0 flex-col items-start gap-1 rounded-md',
  'border border-dashed border-slate-200 bg-white px-2.5 py-3 text-start',
  'transition-colors hover:border-slate-300 hover:bg-slate-50/80',
);

/** Inspector Relations / APIs: show this many rows, then a caption "and N more" link. */
export const MODELER_INSPECTOR_LIST_PREVIEW_COUNT = 5;

/** Tiny disclosure link under a collapsed inspector list — not an AppButton chip. */
export const MODELER_INSPECTOR_MORE_LINK_CLASS = cn(
  MODELER_CAPTION_CLASS,
  MODELER_CHIP_FOCUS_CLASS,
  'h-auto min-h-0 px-0 py-0.5 ps-[4px] text-start font-normal text-slate-500',
  'underline-offset-2 hover:text-slate-700 hover:underline',
  'focus-visible:outline-none',
);

/**
 * Unified floating-panel chrome — border-2 + neutral header; semantic accent on
 * icon/title only (not large body washes).
 */
export const MODELER_FLOATING_PANEL_HEADER_CLASS =
  'h-9 border-b border-slate-200 bg-white px-3';
export const MODELER_FLOATING_PANEL_TITLE_CLASS =
  'text-xs font-semibold tracking-tight text-slate-800';
export const MODELER_FLOATING_PANEL_HEADER_BAND_CLASS =
  'flex min-h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5';

/** Thin semantic border accents for sibling studio windows. */
export const MODELER_PANEL_BORDER_COLUMN_CLASS = 'border-2 border-indigo-200/70';
export const MODELER_PANEL_BORDER_RELATION_CLASS = 'border-2 border-violet-200/70';
