export const BASE_ROLES = ['ADMIN', 'USER', 'DEVELOPER'] as const;

/** Roles that cannot self-delete their account (profile → Delete Account). */
export const NON_SELF_DELETABLE_ROLES = ['ADMIN', 'DEVELOPER'] as const;

export {
  DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  GRID_PAGE_SIZES as PAGE_SIZES,
} from '@/src/shared/lib/gridPagingConstants';

export const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'id', label: 'ID' },
  { value: 'name', label: 'Name' },
  { value: 'note', label: 'Note' },
] as const;

export const ROLE_SORT_FIELDS = SORT_OPTIONS.map((option) => option.value);

export const EMPTY_ROLE_FORM = { name: '', note: '' };

export const ACTION_TOOL_COUNT = 4;
export const ACTION_SLOT_WIDTH = 20;
export const ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const ACTION_CELL_HORIZONTAL_PADDING = 3;
export const ACTION_COLUMN_WIDTH =
  ACTION_CELL_HORIZONTAL_PADDING * 2 +
  (ACTION_SLOT_WIDTH * ACTION_TOOL_COUNT) +
  (ACTION_SEPARATOR_SLOT_WIDTH * (ACTION_TOOL_COUNT - 1));

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';
