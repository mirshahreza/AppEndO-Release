export type FilterMatchLogic = 'or' | 'and';

export const DEFAULT_FILTER_MATCH_LOGIC: FilterMatchLogic = 'or';

export type FilterMatchLogicOption = {
  value: FilterMatchLogic;
  label: string;
  description: string;
};

export const FILTER_MATCH_LOGIC_OPTIONS: ReadonlyArray<FilterMatchLogicOption> = [
  { value: 'or', label: 'OR', description: 'Match any selected value.' },
  { value: 'and', label: 'AND', description: 'Require every selected value.' },
];

const MATCH_LOGIC_LABEL_KEYS: Record<FilterMatchLogic, string> = {
  or: 'grid.filter.matchLogic.or',
  and: 'grid.filter.matchLogic.and',
};

const MATCH_LOGIC_DESCRIPTION_KEYS: Record<FilterMatchLogic, string> = {
  or: 'grid.filter.matchLogic.or.description',
  and: 'grid.filter.matchLogic.and.description',
};

export type FilterMatchLogicTranslate = (
  key: string,
  options?: { missing?: 'silent' },
) => string;

const resolveTranslated = (
  translate: FilterMatchLogicTranslate | undefined,
  key: string,
  fallback: string,
): string => {
  if (!translate) {
    return fallback;
  }
  const translated = translate(key, { missing: 'silent' });
  return translated !== key ? translated : fallback;
};

/** Toolbar AND/OR control labels + helper line under segmented control. */
export const resolveFilterMatchLogicOptions = (
  translate?: FilterMatchLogicTranslate,
): ReadonlyArray<FilterMatchLogicOption> => (
  (['or', 'and'] as const).map((value) => {
    const fallback = FILTER_MATCH_LOGIC_OPTIONS.find((option) => option.value === value)
      ?? FILTER_MATCH_LOGIC_OPTIONS[0];
    return {
      value,
      label: resolveTranslated(translate, MATCH_LOGIC_LABEL_KEYS[value], fallback.label),
      description: resolveTranslated(translate, MATCH_LOGIC_DESCRIPTION_KEYS[value], fallback.description),
    };
  })
);

export function parseFilterMatchLogic(raw: unknown): FilterMatchLogic {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'and') {
    return value;
  }
  return DEFAULT_FILTER_MATCH_LOGIC;
}

export function getFilterMatchLogicOption(value: FilterMatchLogic): FilterMatchLogicOption {
  return FILTER_MATCH_LOGIC_OPTIONS.find((option) => option.value === value)
    ?? FILTER_MATCH_LOGIC_OPTIONS[0];
}

export function getLocalizedFilterMatchLogicOption(
  value: FilterMatchLogic,
  translate?: FilterMatchLogicTranslate,
): FilterMatchLogicOption {
  return resolveFilterMatchLogicOptions(translate).find((option) => option.value === value)
    ?? getFilterMatchLogicOption(value);
}
