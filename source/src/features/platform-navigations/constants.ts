const NAVIGATIONS_ACTION_TOOL_COUNT = 2;
const NAVIGATIONS_ACTION_SLOT_WIDTH = 20;
const NAVIGATIONS_ACTION_SEPARATOR_SLOT_WIDTH = 7;
const NAVIGATIONS_ACTION_CELL_HORIZONTAL_PADDING = 3;

export const NAVIGATIONS_ACTION_COLUMN_WIDTH =
  NAVIGATIONS_ACTION_CELL_HORIZONTAL_PADDING * 2
  + NAVIGATIONS_ACTION_SLOT_WIDTH * NAVIGATIONS_ACTION_TOOL_COUNT
  + NAVIGATIONS_ACTION_SEPARATOR_SLOT_WIDTH * (NAVIGATIONS_ACTION_TOOL_COUNT - 1);

export const NAVIGATIONS_GRID_ACTION_BUTTON_CLASS =
  "h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent";

export const NAVIGATION_EDITOR_ID_CLASS =
  "flex h-8 min-w-0 flex-1 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-mono text-slate-700";

/** Edit manifest tree mode — property panel width (50% wider than the original 340px). */
export const NAVIGATION_EDITOR_SIDE_PANEL_CLASS =
  "flex w-[510px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-slate-50/40 p-4";

export const NAV_DEFAULT_LABEL_COLOR = "text-text-nav";
export const NAV_DEFAULT_ICON_COLOR = "text-indigo-500";

export const NAVIGATION_SORT_OPTIONS = [
  { value: "id", label: "Id" },
  { value: "groups", label: "Groups" },
  { value: "items", label: "Items" },
] as const;

export const NAVIGATION_SORT_FIELDS = NAVIGATION_SORT_OPTIONS.map(
  (option) => option.value,
);

export const EMPTY_NAVIGATION_MANIFEST = {
  id: "",
  version: "1",
  groups: [],
} as const;
