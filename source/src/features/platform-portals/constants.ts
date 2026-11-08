export const APPLICATION_ACTION_TOOL_COUNT = 2;
export const APPLICATION_ACTION_SLOT_WIDTH = 20;
export const APPLICATION_ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const APPLICATION_ACTION_CELL_HORIZONTAL_PADDING = 3;
export const APPLICATION_ACTION_COLUMN_WIDTH =
  APPLICATION_ACTION_CELL_HORIZONTAL_PADDING * 2
  + (APPLICATION_ACTION_SLOT_WIDTH * APPLICATION_ACTION_TOOL_COUNT)
  + (APPLICATION_ACTION_SEPARATOR_SLOT_WIDTH * (APPLICATION_ACTION_TOOL_COUNT - 1));

export const APPLICATION_GRID_ACTION_BUTTON_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';
