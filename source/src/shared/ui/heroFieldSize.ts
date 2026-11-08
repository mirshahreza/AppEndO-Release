/** Canonical form-control sizes for HeroUI field wrappers (project-defined via Tailwind). */
export type HeroUiFieldSize = 'xs' | 'sm' | 'md' | 'lg';

export const HERO_UI_FIELD_SIZES: HeroUiFieldSize[] = ['xs', 'sm', 'md', 'lg'];

/** Preferred defaults for routine product UI — not a hard limit. */
export const HERO_UI_FIELD_PREFERRED_SIZES: HeroUiFieldSize[] = ['sm', 'md'];

/** Start-aligned field value text — canonical for all HeroUI field wrappers. */
export const HERO_UI_FIELD_TEXT_ALIGN_CLASS = 'text-start';

/** Typed/displayed field values (inputs, selects, textareas). */
export const HERO_UI_FIELD_VALUE_CLASS =
  'font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400';

export type HeroUiFieldSizeTokens = {
  controlHeightClass: string;
  controlMaxHeightClass: string;
  controlRowHeightClass: string;
  nativeSelectHeightClass: string;
  textClass: string;
  checkboxControlClass: string;
  choiceLabelClass: string;
  radioControlClass: string;
};

const HERO_UI_FIELD_SIZE_TOKENS: Record<HeroUiFieldSize, HeroUiFieldSizeTokens> = {
  xs: {
    controlHeightClass: '!h-7 !min-h-7',
    controlMaxHeightClass: '!max-h-7',
    controlRowHeightClass: 'h-7',
    nativeSelectHeightClass: 'h-7',
    textClass: 'text-[11px]',
    checkboxControlClass: 'size-3',
    choiceLabelClass: 'text-[11px] text-slate-700',
    radioControlClass: 'size-3',
  },
  sm: {
    controlHeightClass: '!h-8 !min-h-8',
    controlMaxHeightClass: '!max-h-8',
    controlRowHeightClass: 'h-8',
    nativeSelectHeightClass: 'h-8',
    textClass: 'text-xs',
    checkboxControlClass: 'size-3.5',
    choiceLabelClass: 'text-xs text-slate-700',
    radioControlClass: 'size-3.5',
  },
  md: {
    controlHeightClass: '!h-9 !min-h-9',
    controlMaxHeightClass: '!max-h-9',
    controlRowHeightClass: 'h-9',
    nativeSelectHeightClass: 'h-9',
    textClass: 'text-sm',
    checkboxControlClass: 'size-4',
    choiceLabelClass: 'text-sm text-slate-700',
    radioControlClass: 'size-4',
  },
  lg: {
    controlHeightClass: '!h-10 !min-h-10',
    controlMaxHeightClass: '!max-h-10',
    controlRowHeightClass: 'h-10',
    nativeSelectHeightClass: 'h-10',
    textClass: 'text-sm',
    checkboxControlClass: 'size-4.5',
    choiceLabelClass: 'text-sm text-slate-700',
    radioControlClass: 'size-4.5',
  },
};

export const isHeroUiFieldSize = (value: string): value is HeroUiFieldSize =>
  (HERO_UI_FIELD_SIZES as string[]).includes(value);

export const resolveHeroUiFieldSizeTokens = (
  size: HeroUiFieldSize = 'sm',
): HeroUiFieldSizeTokens => HERO_UI_FIELD_SIZE_TOKENS[size];
