export { DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE } from '../../shared/lib/gridPagingConstants';

export const CACHE_SORT_OPTIONS = [
  { value: 'cacheKey', label: 'Cache Key' },
  { value: 'sizeBytes', label: 'Size' },
  { value: 'hitCount', label: 'Hits' },
  { value: 'createdAt', label: 'Created' },
] as const;

export type CacheSortField = (typeof CACHE_SORT_OPTIONS)[number]['value'];

export const CACHE_SORT_FIELDS = CACHE_SORT_OPTIONS.map((option) => option.value);

export const CACHE_METRIC_COLUMN_WIDTH = 100;

export const ACTION_TOOL_COUNT = 2;
export const ACTION_SLOT_WIDTH = 20;
export const ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const ACTION_CELL_HORIZONTAL_PADDING = 3;
export const ACTION_COLUMN_WIDTH =
  ACTION_CELL_HORIZONTAL_PADDING * 2
  + (ACTION_SLOT_WIDTH * ACTION_TOOL_COUNT)
  + (ACTION_SEPARATOR_SLOT_WIDTH * (ACTION_TOOL_COUNT - 1));

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center transition-colors disabled:text-slate-400 disabled:cursor-not-allowed';
