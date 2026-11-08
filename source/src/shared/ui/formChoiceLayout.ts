import { cn } from '../../lib/utils';
import { UI_CHOICE_STACK_GAP_CLASS } from './HeroFieldControls';

/** Two-column pair grid for related fields (e.g. name + environment). */
export const UI_FORM_FIELD_PAIR_GRID_CLASS = 'grid grid-cols-1 gap-2 sm:gap-x-4';

export const UI_FORM_FIELD_PAIR_GRID_TWO_COL_CLASS = 'sm:grid-cols-2 sm:items-stretch';

export const resolveFormFieldPairGridClass = (bothColumns: boolean) => cn(
  UI_FORM_FIELD_PAIR_GRID_CLASS,
  bothColumns ? UI_FORM_FIELD_PAIR_GRID_TWO_COL_CLASS : 'sm:grid-cols-1',
);

/** Bordered host for stacked checkbox/radio option rows inside a form section. */
export const UI_CHOICE_BOX_SHELL_CLASS = cn(
  'flex h-full w-full min-w-0 flex-col rounded-[6px] border border-slate-300 bg-white px-3 py-1.5 shadow-sm',
  UI_CHOICE_STACK_GAP_CLASS,
);

export const resolveChoiceBoxShellClass = (disabled?: boolean) => cn(
  UI_CHOICE_BOX_SHELL_CLASS,
  disabled && 'opacity-60',
);

/**
 * Reserved label slot matching `AiContextSuggestLabelButton` (h-3 w-3).
 * Pass as `FormField` `labelExtra` when a plain field sits beside `AiAssistFormField` in a pair grid.
 */
export const AI_FIELD_LABEL_EXTRA_PLACEHOLDER_CLASS = 'inline-block h-3 w-3 shrink-0';
