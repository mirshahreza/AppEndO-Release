export {
  DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  GRID_PAGE_SIZES as PAGE_SIZES,
} from '@/src/shared/lib/gridPagingConstants';

export const SORT_OPTIONS = [
  { value: 'updated_at', label: 'Updated' },
  { value: 'created_at', label: 'Created' },
  { value: 'title', label: 'Title' },
  { value: 'username', label: 'User' },
  { value: 'id', label: 'ID' },
] as const;

export const CHAT_HISTORY_SORT_FIELDS = SORT_OPTIONS.map((option) => option.value);

export const ACTION_TOOL_COUNT = 2;
export const ACTION_SLOT_WIDTH = 20;
export const ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const ACTION_CELL_HORIZONTAL_PADDING = 3;
export const ACTION_COLUMN_WIDTH =
  ACTION_CELL_HORIZONTAL_PADDING * 2 +
  (ACTION_SLOT_WIDTH * ACTION_TOOL_COUNT) +
  (ACTION_SEPARATOR_SLOT_WIDTH * (ACTION_TOOL_COUNT - 1));

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';
