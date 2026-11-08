export const ACTION_COLUMN_WIDTH = 3 * 2 + 20 * 2 + 7 * (2 - 1);

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';

export const EMPTY_SETTINGS_ATTRIBUTE_FORM = {
  key: '',
  label: '',
  sourceType: 'CUSTOM' as const,
  baseInfoRootId: '',
  profileField: '',
  dataType: 'string' as const,
  cardinality: 'single' as const,
  minSelections: '',
  maxSelections: '',
  visibility: 'BOTH' as const,
  isRequired: false,
  isActive: true,
  userEditable: false,
  userEditPolicy: 'NONE',
  viewOrder: '0',
};
