import type { GridListMode } from '@/src/shared/lib/gridPagingConstants';
import type { LogLevel } from './types';

export { DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE } from '@/src/shared/lib/gridPagingConstants';
export const DEFAULT_LIST_MODE: GridListMode = 'infinite';

export {
  DEFAULT_LEVEL_FILTERS,
  DEFAULT_VISIBLE_LEVELS,
  LOG_LEVELS,
} from '@/src/shared/api/contracts/logs/constants';

export const levelBadgeClass: Record<LogLevel, string> = {
  INFO: 'bg-blue-100 text-blue-700',
  WARN: 'bg-amber-100 text-amber-800',
  ERROR: 'bg-red-100 text-red-700',
  DEBUG: 'bg-slate-100 text-slate-700',
};

export const ACTION_TOOL_COUNT = 1;
export const ACTION_SLOT_WIDTH = 20;
export const ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const ACTION_CELL_HORIZONTAL_PADDING = 3;
export const ACTION_COLUMN_WIDTH =
  ACTION_CELL_HORIZONTAL_PADDING * 2 +
  (ACTION_SLOT_WIDTH * ACTION_TOOL_COUNT) +
  (ACTION_SEPARATOR_SLOT_WIDTH * (ACTION_TOOL_COUNT - 1));

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';
