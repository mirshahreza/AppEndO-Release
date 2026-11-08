export const ACTION_TOOL_COUNT = 3;
export const ACTION_SLOT_WIDTH = 20;
export const ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const ACTION_CELL_HORIZONTAL_PADDING = 3;
export const ACTION_COLUMN_WIDTH =
  ACTION_CELL_HORIZONTAL_PADDING * 2 +
  (ACTION_SLOT_WIDTH * ACTION_TOOL_COUNT) +
  (ACTION_SEPARATOR_SLOT_WIDTH * (ACTION_TOOL_COUNT - 1));

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';
