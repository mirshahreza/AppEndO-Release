import {
  FORM_SECTION_BODY_STACK_CLASS,
  FORM_SECTION_DIVIDED_CLASS,
} from '../../shared/ui/FormSection';
import { APP_SURFACE_BOX_BODY_CLASS } from '../../shared/ui/surfaceClasses';

/** Shared compact layout tokens for baseComponents configurator forms. */
export const BASE_COMPONENTS_CONFIGURATOR_SHELL_CLASS =
  'flex h-full min-h-0 w-full max-w-3xl flex-col';

/** Stacked (overlay) configurator host — accordion owns the inner Scroll Area. */
export const BASE_COMPONENTS_STACKED_WORKSPACE_CLASS = 'min-h-0 flex-1 overflow-hidden';

/**
 * Preview pane body — uniform inset/stack for split and overlay demos.
 * Edge-to-edge data hosts (grid / treegrid / spreadsheet) omit this.
 */
export const BASE_COMPONENTS_PREVIEW_BODY_CLASS =
  'flex h-full min-h-0 flex-1 flex-col gap-3 px-[10px] py-3';

/** Narrow teaching preview (form-fields family / relations) — body + max width. */
export const BASE_COMPONENTS_PREVIEW_SHELL_CLASS = `${BASE_COMPONENTS_PREVIEW_BODY_CLASS} max-w-2xl`;

/**
 * Split preview + options host.
 * Mobile: stacked (options above preview), one outer scroll.
 * Desktop: preview fills the start column; options rail is end/right,
 * flush (`gap-0`), with a start border. The open accordion panel uses Scroll Area.
 * When the options rail is undocked (`data-bc-config-mode="floating"`), the grid
 * collapses to a single preview column.
 */
export const BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS =
  'grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,17.5rem)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:has-[[data-bc-config-mode=floating]]:grid-cols-[minmax(0,1fr)] xl:has-[[data-bc-config-mode=floating]]:grid-cols-[minmax(0,1fr)]';

/** Options rail — fill-height accordion on the right (`lg+`); the open panel uses Scroll Area. */
export const BASE_COMPONENTS_CONFIG_COLUMN_CLASS =
  'flex min-h-0 min-w-0 flex-col overflow-hidden lg:col-start-2 lg:row-start-1 lg:h-full lg:border-s lg:border-[color:var(--app-accent-border-strong)] has-[[data-bc-config-mode=floating]]:hidden';

/** Compact AppSearchBox sizing for the properties rail / floating properties window. */
export const BASE_COMPONENTS_CONFIG_SEARCH_INPUT_CLASS =
  '!min-h-0 w-full gap-1.5 !border-0 !bg-transparent !px-2 !py-1 [&>svg:first-child]:h-3 [&>svg:first-child]:w-3';

/**
 * Inset inside every options accordion section body.
 * Same `p-3` as `APP_SURFACE_BOX_BODY_CLASS`; field stack matches FormSection.
 */
export const BASE_COMPONENTS_CONFIG_ACCORDION_BODY_CLASS =
  `${FORM_SECTION_BODY_STACK_CLASS} ${APP_SURFACE_BOX_BODY_CLASS}`;

/**
 * Vertical stack between nested groups *inside* one accordion panel
 * (e.g. wizard steps, dialog bands). Top-level configurator groups use
 * `BaseComponentsConfigAccordion`.
 */
export const BASE_COMPONENTS_CONFIG_SECTION_STACK_CLASS = 'flex flex-col gap-4';

/**
 * Uniform field grid for full-width configurators.
 * Always 2 columns from `sm` — avoids empty third cells that looked “misaligned”.
 */
export const BASE_COMPONENTS_CONFIG_FIELDS_CLASS =
  'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2';

/** Vertical field stack for split-panel configurators (side label + control). */
export const BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS = FORM_SECTION_BODY_STACK_CLASS;

/** Chrome fields share the same single-column stack as other split options. */
export const BASE_COMPONENTS_CONFIG_CHROME_ROW_CLASS = BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS;

/** Field cell inside grid — fill column. */
export const BASE_COMPONENTS_CONFIG_CHROME_FIELD_CLASS = 'min-w-0';

/** Select/input fill the grid cell (equal block sizes). */
export const BASE_COMPONENTS_CONFIG_CHROME_SELECT_CLASS = 'w-full';

/** Hex input beside color swatch. */
export const BASE_COMPONENTS_CONFIG_CHROME_HEX_INPUT_CLASS = 'min-w-0 flex-1';

export const BASE_COMPONENTS_CONFIG_FIELD_CLASS = 'min-w-0';

/** Control fills its grid/stack cell — equal widths in a row. */
export const BASE_COMPONENTS_CONFIG_SELECT_CLASS = 'w-full';

/** Text input width matching select. */
export const BASE_COMPONENTS_CONFIG_INPUT_CLASS = BASE_COMPONENTS_CONFIG_SELECT_CLASS;

/** Alias — prefer `BASE_COMPONENTS_CONFIG_INPUT_CLASS` for new fields. */
export const BASE_COMPONENTS_CONFIG_INPUT_WIDE_CLASS = BASE_COMPONENTS_CONFIG_INPUT_CLASS;

/** Full-width select inside narrow split config column. */
export const BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS = 'w-full';

/** Text input width matching select in narrow split-panel configurators. */
export const BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS = BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS;

export const BASE_COMPONENTS_CONFIG_SUBSECTION_CLASS = FORM_SECTION_BODY_STACK_CLASS;

export const BASE_COMPONENTS_CONFIG_SUBSECTION_DIVIDER_CLASS =
  `${FORM_SECTION_BODY_STACK_CLASS} ${FORM_SECTION_DIVIDED_CLASS}`;

/** In-group subsection label — matches settings subsection typography. */
export const BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS =
  'text-[11px] font-bold uppercase tracking-wider text-slate-500 ps-[4px]';

/**
 * Default FormSection tone for baseComponents configurators — neutral so section
 * titles/accent bars share one alignment/color ladder. Use colored tones only
 * when the section is teaching that tone (e.g. Surface box preview).
 */
export const BASE_COMPONENTS_CONFIG_SECTION_TONE = 'slate' as const;
