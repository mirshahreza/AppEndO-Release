/**
 * FortuneSheet Workbook Settings wrappers.
 * Arrays match `@fortune-sheet/core` `defaultSettings` (v1.0.4).
 */

export type UiSpreadsheetLang = 'en' | 'zh' | 'zh_tw' | 'es' | 'hi' | 'ru';
export type UiSpreadsheetToolbarPreset = 'full' | 'compact' | 'format' | 'none';
export type UiSpreadsheetMenuPreset = 'full' | 'edit' | 'none';
export type UiSpreadsheetSheetMenuPreset = 'full' | 'none';
export type UiSpreadsheetPixelRatio = 'auto' | 1 | 2;
export type UiSpreadsheetCurrency = 'USD' | 'EUR' | 'CNY' | 'GBP';
export type UiSpreadsheetStatBar = 'tabs' | 'footer' | 'hidden';
/** Host chrome only. FortuneSheet canvas stays LTR. Toolbar and formula bar stay LTR. */
export type UiSpreadsheetDirection = 'ltr' | 'rtl';

export const UI_SPREADSHEET_LANGS: readonly UiSpreadsheetLang[] = ['en', 'zh', 'zh_tw', 'es', 'hi', 'ru'];
export const UI_SPREADSHEET_TOOLBAR_PRESETS: readonly UiSpreadsheetToolbarPreset[] = ['full', 'compact', 'format', 'none'];
export const UI_SPREADSHEET_MENU_PRESETS: readonly UiSpreadsheetMenuPreset[] = ['full', 'edit', 'none'];
export const UI_SPREADSHEET_SHEET_MENU_PRESETS: readonly UiSpreadsheetSheetMenuPreset[] = ['full', 'none'];
export const UI_SPREADSHEET_PIXEL_RATIOS: readonly UiSpreadsheetPixelRatio[] = ['auto', 1, 2];
export const UI_SPREADSHEET_CURRENCIES: readonly UiSpreadsheetCurrency[] = ['USD', 'EUR', 'CNY', 'GBP'];
export const UI_SPREADSHEET_STAT_BARS: readonly UiSpreadsheetStatBar[] = ['tabs', 'footer', 'hidden'];
export const UI_SPREADSHEET_DEFAULT_STAT_BAR: UiSpreadsheetStatBar = 'tabs';
export const UI_SPREADSHEET_DIRECTIONS: readonly UiSpreadsheetDirection[] = ['ltr', 'rtl'];
export const UI_SPREADSHEET_DEFAULT_DIRECTION: UiSpreadsheetDirection = 'ltr';

export const UI_SPREADSHEET_ROW_HEADER_WIDTH = 46;
export const UI_SPREADSHEET_COLUMN_HEADER_HEIGHT = 20;
export const UI_SPREADSHEET_DEFAULT_ROW_COUNT = 200;
export const UI_SPREADSHEET_DEFAULT_COLUMN_COUNT = 50;
export const UI_SPREADSHEET_DEFAULT_ADD_ROWS = 0;
export const UI_SPREADSHEET_ADD_COLUMNS_COUNT = 50;
export const UI_SPREADSHEET_ROW_GROW_BATCH = 50;
export const UI_SPREADSHEET_ROW_GROW_REMAINING_PX = 96;

/** Full FortuneSheet toolbar (defaultSettings.toolbarItems). */
export const UI_SPREADSHEET_TOOLBAR_FULL = [
  'undo', 'redo', 'format-painter', 'clear-format', '|',
  'currency-format', 'percentage-format', 'number-decrease', 'number-increase', 'format', '|',
  'font', '|', 'font-size', '|',
  'bold', 'italic', 'strike-through', 'underline', '|',
  'font-color', 'background', 'border', 'merge-cell', '|',
  'horizontal-align', 'vertical-align', 'text-wrap', 'text-rotation', '|',
  'freeze', 'conditionFormat', 'filter', 'link', 'image', 'comment', 'quick-formula',
  'dataVerification', 'splitColumn', 'locationCondition', 'screenshot', 'search',
] as const;

export const UI_SPREADSHEET_TOOLBAR_COMPACT = [
  'undo', 'redo', '|',
  'bold', 'italic', 'underline', '|',
  'merge-cell', 'freeze', 'filter', 'search',
] as const;

export const UI_SPREADSHEET_TOOLBAR_FORMAT = [
  'currency-format', 'percentage-format', 'number-decrease', 'number-increase', 'format', 'font-size', '|',
  'bold', 'italic', 'font-color', 'background', 'border', 'merge-cell', 'horizontal-align',
] as const;

export const UI_SPREADSHEET_CELL_MENU_FULL = [
  'copy', 'paste', '|',
  'insert-row', 'insert-column', 'delete-row', 'delete-column', 'delete-cell',
  'hide-row', 'hide-column', 'set-row-height', 'set-column-width', '|',
  'clear', 'sort', 'orderAZ', 'orderZA', 'filter', 'chart', 'image', 'link', 'data', 'cell-format',
] as const;

export const UI_SPREADSHEET_CELL_MENU_EDIT = [
  'copy', 'paste', '|',
  'insert-row', 'insert-column', 'delete-row', 'delete-column', 'clear',
] as const;

export const UI_SPREADSHEET_HEADER_MENU_FULL = [
  'copy', 'paste', '|',
  'insert-row', 'insert-column', 'delete-row', 'delete-column', 'delete-cell',
  'hide-row', 'hide-column', 'set-row-height', 'set-column-width', '|',
  'clear', 'sort', 'orderAZ', 'orderZA',
] as const;

export const UI_SPREADSHEET_HEADER_MENU_EDIT = [
  'copy', 'paste', '|',
  'insert-row', 'insert-column', 'delete-row', 'delete-column',
] as const;

export const UI_SPREADSHEET_SHEET_TAB_MENU_FULL = [
  'delete', 'copy', 'rename', 'color', 'hide', '|', 'move',
] as const;

export const UI_SPREADSHEET_FILTER_MENU_FULL = [
  'sort-by-asc', 'sort-by-desc', '|', 'filter-by-color', '|', 'filter-by-value',
] as const;

export const UI_SPREADSHEET_CURRENCY_SYMBOL: Record<UiSpreadsheetCurrency, string> = {
  USD: '$',
  EUR: '€',
  CNY: '¥',
  GBP: '£',
};

export const resolveSpreadsheetToolbarItems = (
  showToolbar: boolean,
  preset: UiSpreadsheetToolbarPreset,
  override?: readonly string[],
): string[] => {
  if (override) {
    return [...override];
  }
  if (!showToolbar || preset === 'none') {
    return [];
  }
  if (preset === 'compact') {
    return [...UI_SPREADSHEET_TOOLBAR_COMPACT];
  }
  if (preset === 'format') {
    return [...UI_SPREADSHEET_TOOLBAR_FORMAT];
  }
  return [...UI_SPREADSHEET_TOOLBAR_FULL];
};

const resolveMenuItems = (
  preset: UiSpreadsheetMenuPreset | UiSpreadsheetSheetMenuPreset,
  full: readonly string[],
  edit?: readonly string[],
): string[] => {
  if (preset === 'none') {
    return [];
  }
  if (preset === 'edit' && edit) {
    return [...edit];
  }
  return [...full];
};

export const resolveSpreadsheetCellContextMenu = (
  preset: UiSpreadsheetMenuPreset,
  override?: readonly string[],
): string[] => override ? [...override] : resolveMenuItems(preset, UI_SPREADSHEET_CELL_MENU_FULL, UI_SPREADSHEET_CELL_MENU_EDIT);

export const resolveSpreadsheetHeaderContextMenu = (
  preset: UiSpreadsheetMenuPreset,
  override?: readonly string[],
): string[] => override ? [...override] : resolveMenuItems(preset, UI_SPREADSHEET_HEADER_MENU_FULL, UI_SPREADSHEET_HEADER_MENU_EDIT);

export const resolveSpreadsheetSheetTabContextMenu = (
  preset: UiSpreadsheetSheetMenuPreset,
  override?: readonly string[],
): string[] => override ? [...override] : resolveMenuItems(preset, UI_SPREADSHEET_SHEET_TAB_MENU_FULL);

export const resolveSpreadsheetFilterContextMenu = (
  preset: UiSpreadsheetSheetMenuPreset,
  override?: readonly string[],
): string[] => override ? [...override] : resolveMenuItems(preset, UI_SPREADSHEET_FILTER_MENU_FULL);

export const resolveSpreadsheetHeaderWidth = (
  show: boolean,
  override?: number,
): number => override ?? (show ? UI_SPREADSHEET_ROW_HEADER_WIDTH : 0);

export const resolveSpreadsheetHeaderHeight = (
  show: boolean,
  override?: number,
): number => override ?? (show ? UI_SPREADSHEET_COLUMN_HEADER_HEIGHT : 0);

export const resolveSpreadsheetDevicePixelRatio = (
  value: UiSpreadsheetPixelRatio,
): number | undefined => (value === 'auto' ? undefined : value);

export type UiSpreadsheetWorkbookSettings = {
  showToolbar: boolean;
  showFormulaBar: boolean;
  showSheetTabs: boolean;
  allowEdit: boolean;
  lang: UiSpreadsheetLang;
  row: number;
  column: number;
  addRows: number;
  addColumns: number;
  showAddColumns: boolean;
  statBar: UiSpreadsheetStatBar;
  defaultFontSize: number;
  defaultRowHeight: number;
  defaultColWidth: number;
  rowHeaderWidth: number;
  columnHeaderHeight: number;
  forceCalculation: boolean;
  currency: string;
  devicePixelRatio?: number;
  toolbarItems: string[];
  cellContextMenu: string[];
  headerContextMenu: string[];
  sheetTabContextMenu: string[];
  filterContextMenu: string[];
};

export type UiSpreadsheetSettingsInput = {
  showToolbar?: boolean;
  showFormulaBar?: boolean;
  showSheetTabs?: boolean;
  allowEdit?: boolean;
  lang?: UiSpreadsheetLang;
  row?: number;
  column?: number;
  addRows?: number;
  addColumns?: number;
  showAddColumns?: boolean;
  statBar?: UiSpreadsheetStatBar;
  defaultFontSize?: number;
  defaultRowHeight?: number;
  defaultColWidth?: number;
  showRowHeader?: boolean;
  showColumnHeader?: boolean;
  rowHeaderWidth?: number;
  columnHeaderHeight?: number;
  forceCalculation?: boolean;
  currency?: UiSpreadsheetCurrency;
  devicePixelRatio?: UiSpreadsheetPixelRatio;
  toolbarPreset?: UiSpreadsheetToolbarPreset;
  toolbarItems?: readonly string[];
  cellMenuPreset?: UiSpreadsheetMenuPreset;
  cellContextMenu?: readonly string[];
  headerMenuPreset?: UiSpreadsheetMenuPreset;
  headerContextMenu?: readonly string[];
  sheetTabMenuPreset?: UiSpreadsheetSheetMenuPreset;
  sheetTabContextMenu?: readonly string[];
  filterMenuPreset?: UiSpreadsheetSheetMenuPreset;
  filterContextMenu?: readonly string[];
};

export const resolveUiSpreadsheetWorkbookSettings = (
  input: UiSpreadsheetSettingsInput,
): UiSpreadsheetWorkbookSettings => {
  const showToolbar = input.showToolbar ?? true;
  const toolbarPreset = input.toolbarPreset ?? 'full';
  const allowEdit = input.allowEdit ?? true;
  return {
    showToolbar: showToolbar && toolbarPreset !== 'none',
    showFormulaBar: input.showFormulaBar ?? true,
    showSheetTabs: input.showSheetTabs ?? true,
    allowEdit,
    lang: input.lang ?? 'en',
    row: input.row ?? UI_SPREADSHEET_DEFAULT_ROW_COUNT,
    column: input.column ?? UI_SPREADSHEET_DEFAULT_COLUMN_COUNT,
    addRows: input.addRows ?? UI_SPREADSHEET_DEFAULT_ADD_ROWS,
    addColumns: input.addColumns ?? UI_SPREADSHEET_ADD_COLUMNS_COUNT,
    showAddColumns: input.showAddColumns ?? allowEdit,
    statBar: input.statBar ?? UI_SPREADSHEET_DEFAULT_STAT_BAR,
    defaultFontSize: input.defaultFontSize ?? 11,
    defaultRowHeight: input.defaultRowHeight ?? 19,
    defaultColWidth: input.defaultColWidth ?? 73,
    rowHeaderWidth: resolveSpreadsheetHeaderWidth(input.showRowHeader ?? true, input.rowHeaderWidth),
    columnHeaderHeight: resolveSpreadsheetHeaderHeight(input.showColumnHeader ?? true, input.columnHeaderHeight),
    forceCalculation: input.forceCalculation ?? false,
    currency: UI_SPREADSHEET_CURRENCY_SYMBOL[input.currency ?? 'USD'],
    devicePixelRatio: resolveSpreadsheetDevicePixelRatio(input.devicePixelRatio ?? 'auto'),
    toolbarItems: resolveSpreadsheetToolbarItems(showToolbar, toolbarPreset, input.toolbarItems),
    cellContextMenu: resolveSpreadsheetCellContextMenu(input.cellMenuPreset ?? 'full', input.cellContextMenu),
    headerContextMenu: resolveSpreadsheetHeaderContextMenu(input.headerMenuPreset ?? 'full', input.headerContextMenu),
    sheetTabContextMenu: resolveSpreadsheetSheetTabContextMenu(input.sheetTabMenuPreset ?? 'full', input.sheetTabContextMenu),
    filterContextMenu: resolveSpreadsheetFilterContextMenu(input.filterMenuPreset ?? 'full', input.filterContextMenu),
  };
};

export const resolveUiSpreadsheetHostStatBar = (
  statBar: UiSpreadsheetStatBar,
  showSheetTabs: boolean,
): UiSpreadsheetStatBar => (statBar === 'tabs' && !showSheetTabs ? 'hidden' : statBar);

export const resolveUiSpreadsheetDirection = (
  direction?: UiSpreadsheetDirection,
): UiSpreadsheetDirection => (direction === 'rtl' ? 'rtl' : UI_SPREADSHEET_DEFAULT_DIRECTION);
