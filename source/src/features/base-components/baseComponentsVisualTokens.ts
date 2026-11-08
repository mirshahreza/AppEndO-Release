import { cn } from '../../lib/utils';
import { TYPE_CAPTION_CLASS, TYPE_PAGE_TITLE_CLASS } from '../../shared/ui/typographyRoles';

/**
 * BaseComponents chrome tokens — aligned with docs/standards/data-studio-modeler.md
 * (neutral large surfaces, soft selection, dashed empties). Keep in sync with
 * modelerChipStyles.ts when those studio rules change.
 */

/** Page / rail wash */
export const BASE_COMPONENTS_PAGE_SURFACE_CLASS = 'bg-slate-50 text-slate-900';

/** Content header title (PageHeaderToolbar) */
export const BASE_COMPONENTS_TITLE_CLASS =
  `${TYPE_PAGE_TITLE_CLASS} text-slate-800`;

export const BASE_COMPONENTS_CAPTION_CLASS =
  `${TYPE_CAPTION_CLASS} leading-snug text-slate-500`;

/** Dashed empty CTA — no indigo/violet hover wash */
export const BASE_COMPONENTS_EMPTY_STATE_CLASS = cn(
  'flex w-full min-w-0 flex-col items-start gap-1 rounded-md',
  'border border-dashed border-slate-200 bg-white px-2.5 py-3 text-start',
  'transition-colors hover:border-slate-300 hover:bg-slate-50/80',
);

/** Soft selected chip/row (icon grid, size pickers) */
export const BASE_COMPONENTS_OPTION_SELECTED_CLASS =
  'border-slate-300 bg-slate-100 text-slate-900 shadow-sm ring-1 ring-slate-200';

export const BASE_COMPONENTS_OPTION_IDLE_CLASS =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80';

/** Soft status / category pills — small-area only */
export const BASE_COMPONENTS_BADGE_SOFT_CLASS =
  'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide';

/**
 * Floating-panel border presets that mirror Data Studio modeler windows
 * (preview demos only — not BaseComponents page chrome).
 */
export const BASE_COMPONENTS_STUDIO_PANEL_BORDER = {
  column: 'border-2 border-indigo-200/70',
  relation: 'border-2 border-violet-200/70',
  designer: 'border-2 border-slate-300/90',
  default: '',
} as const;

export const BASE_COMPONENTS_STUDIO_PANEL_HEADER_CLASS =
  'h-9 border-b border-slate-200 bg-white px-3';

export const BASE_COMPONENTS_STUDIO_PANEL_TITLE_CLASS =
  'text-xs font-semibold tracking-tight text-slate-800';

export const BASE_COMPONENTS_STUDIO_PANEL_HEADER_BAND_CLASS =
  'flex min-h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5';

export type BaseComponentsStudioPanelChrome = keyof typeof BASE_COMPONENTS_STUDIO_PANEL_BORDER;
