import {
  FORM_SECTION_BODY_STACK_CLASS,
} from '../../shared/ui/FormSection';

/** Layout tokens for the Developer Reference page — standalone, not shared with the Base Components catalog. */
export const DEV_REFERENCE_WORKSPACE_INSET_CLASS = 'p-3 sm:p-4';

/**
 * Preview pane body — stack only.
 * Inset comes from `DEV_REFERENCE_SPLIT_WORKSPACE_CLASS` / GuidePanel host so content
 * does not stick to topic chrome or column edges.
 */
export const DEV_REFERENCE_PREVIEW_BODY_CLASS =
  'flex min-h-0 flex-1 flex-col gap-3';

/**
 * Split configurator + preview host.
 * Mobile: whole stack scrolls (`overflow-auto`, auto rows).
 * Desktop: one `minmax(0,1fr)` row fills the pane (`lg:overflow-hidden`);
 * config / preview columns scroll independently (`min-h-0` + overflow-auto).
 * Inset lives on this host (not the nav+content row) so both panes clear chrome borders.
 */
export const DEV_REFERENCE_SPLIT_WORKSPACE_CLASS =
  `grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] ${DEV_REFERENCE_WORKSPACE_INSET_CLASS}`;

/** Left configurator column — scrolls when fields exceed the pane. */
export const DEV_REFERENCE_COLUMN_CLASS = 'flex min-h-0 min-w-0 flex-col overflow-auto';

/** Vertical stack between top-level FormSection groups. */
export const DEV_REFERENCE_SECTION_STACK_CLASS = 'flex flex-col gap-4';

/** Vertical field stack for narrow split-panel configurators. */
export const DEV_REFERENCE_FIELDS_STACK_CLASS = FORM_SECTION_BODY_STACK_CLASS;

/** Field cell inside grid — fill column. */
export const DEV_REFERENCE_FIELD_CLASS = 'min-w-0';

/** Text input width matching select in narrow split-panel configurators. */
export const DEV_REFERENCE_SPLIT_INPUT_CLASS = 'w-full';

/** In-group subsection label — matches settings subsection typography. */
export const DEV_REFERENCE_SUBSECTION_LABEL_CLASS =
  'text-[11px] font-bold uppercase tracking-wider text-slate-500 ps-[4px]';
