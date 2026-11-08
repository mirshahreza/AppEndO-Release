import * as React from 'react';
import { createPortal } from 'react-dom';
import { Columns3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  resolveUiSpreadsheetWorkbookSettings,
  resolveUiSpreadsheetDirection,
  UI_SPREADSHEET_ROW_GROW_BATCH,
  UI_SPREADSHEET_ROW_GROW_REMAINING_PX,
  UI_SPREADSHEET_ROW_HEADER_WIDTH,
  resolveUiSpreadsheetHostStatBar,
  type UiSpreadsheetDirection,
  type UiSpreadsheetSettingsInput,
  type UiSpreadsheetWorkbookSettings,
} from './uiSpreadsheetSettings';
import './uiSpreadsheetHost.css';

export type {
  UiSpreadsheetLang,
  UiSpreadsheetToolbarPreset,
  UiSpreadsheetMenuPreset,
  UiSpreadsheetSheetMenuPreset,
  UiSpreadsheetPixelRatio,
  UiSpreadsheetCurrency,
  UiSpreadsheetStatBar,
  UiSpreadsheetDirection,
  UiSpreadsheetWorkbookSettings,
  UiSpreadsheetSettingsInput,
} from './uiSpreadsheetSettings';
export {
  resolveUiSpreadsheetWorkbookSettings,
  resolveUiSpreadsheetHostStatBar,
  resolveUiSpreadsheetDirection,
  UI_SPREADSHEET_DIRECTIONS,
  UI_SPREADSHEET_DEFAULT_DIRECTION,
  resolveSpreadsheetToolbarItems,
  resolveSpreadsheetCellContextMenu,
  resolveSpreadsheetHeaderContextMenu,
  resolveSpreadsheetSheetTabContextMenu,
  resolveSpreadsheetFilterContextMenu,
  UI_SPREADSHEET_LANGS,
  UI_SPREADSHEET_TOOLBAR_PRESETS,
  UI_SPREADSHEET_MENU_PRESETS,
  UI_SPREADSHEET_SHEET_MENU_PRESETS,
  UI_SPREADSHEET_PIXEL_RATIOS,
  UI_SPREADSHEET_CURRENCIES,
  UI_SPREADSHEET_STAT_BARS,
  UI_SPREADSHEET_DEFAULT_STAT_BAR,
  UI_SPREADSHEET_TOOLBAR_FULL,
  UI_SPREADSHEET_CELL_MENU_FULL,
  UI_SPREADSHEET_HEADER_MENU_FULL,
  UI_SPREADSHEET_SHEET_TAB_MENU_FULL,
  UI_SPREADSHEET_FILTER_MENU_FULL,
  UI_SPREADSHEET_DEFAULT_ROW_COUNT,
  UI_SPREADSHEET_DEFAULT_COLUMN_COUNT,
  UI_SPREADSHEET_DEFAULT_ADD_ROWS,
  UI_SPREADSHEET_ADD_COLUMNS_COUNT,
} from './uiSpreadsheetSettings';

export type UiSpreadsheetCellValue = {
  v?: unknown;
  m?: string;
  f?: string;
  bl?: number;
  bg?: string;
  ct?: { fa?: string; t?: string };
};

export type UiSpreadsheetCell = {
  r: number;
  c: number;
  v: UiSpreadsheetCellValue;
};

export type UiSpreadsheetSheet = {
  name: string;
  id?: string;
  order?: number;
  status?: number;
  row?: number;
  column?: number;
  celldata?: UiSpreadsheetCell[];
  /** FortuneSheet runtime matrix; omitted when persisting. */
  data?: Array<Array<UiSpreadsheetCellValue | null | undefined>>;
  showGridLines?: number | boolean;
  defaultRowHeight?: number;
  defaultColWidth?: number;
  zoomRatio?: number;
};

export type UiSpreadsheetSelection = {
  row: number[];
  column: number[];
};

export type UiSpreadsheetSheetInfo = {
  id?: string;
  name: string;
};

export type UiSpreadsheetMergeType = 'merge-all' | 'merge-horizontal' | 'merge-vertical';

/** Curated FortuneSheet WorkbookInstance actions used by product code. */
export type UiSpreadsheetHandle = {
  getCellValue: (row: number, column: number) => unknown;
  setCellValue: (row: number, column: number, value: unknown) => void;
  clearCell: (row: number, column: number) => void;
  setCellFormat: (row: number, column: number, attr: string, value: unknown) => void;
  getSelection: () => UiSpreadsheetSelection[] | undefined;
  getSelectionCoordinates: () => string[];
  setSelection: (rowStart: number, rowEnd: number, columnStart: number, columnEnd: number) => void;
  getHtmlByRange: () => string | null;
  getSheets: () => UiSpreadsheetSheetInfo[];
  getSheet: () => UiSpreadsheetSheet | undefined;
  getPersistedSheets: () => UiSpreadsheetSheet[];
  addSheet: () => void;
  deleteSheet: (id?: string) => void;
  activateSheet: (id: string) => void;
  setSheetName: (name: string) => void;
  insertRows: (index?: number, count?: number) => void;
  insertColumns: (index?: number, count?: number) => void;
  deleteRows: (start?: number, end?: number) => void;
  deleteColumns: (start?: number, end?: number) => void;
  hideRows: (rows?: number[]) => void;
  hideColumns: (columns?: number[]) => void;
  showRows: (rows?: number[]) => void;
  showColumns: (columns?: number[]) => void;
  setRowHeight: (row: number, height: number) => void;
  setColumnWidth: (column: number, width: number) => void;
  freeze: (type: 'row' | 'column' | 'both', row?: number, column?: number) => void;
  mergeCells: (type?: UiSpreadsheetMergeType) => void;
  unmergeCells: () => void;
  scrollTo: (row: number, column: number) => void;
  undo: () => void;
  redo: () => void;
  calculateFormula: () => void;
};

export type UiSpreadsheetProps = UiSpreadsheetSettingsInput & {
  data?: UiSpreadsheetSheet[];
  onChange?: (sheets: UiSpreadsheetSheet[]) => void;
  showGridLines?: boolean;
  /** Pixel height, or `full` to fill the parent (`height: 100%`). */
  height?: UiSpreadsheetHeight;
  /**
   * Sheet chrome only (headers, tabs, scrollbars, cell editor).
   * Toolbar and formula bar stay LTR. Canvas cells stay LTR.
   */
  direction?: UiSpreadsheetDirection;
  className?: string;
  style?: React.CSSProperties;
};

export type UiSpreadsheetHeight = number | 'full';

export const UI_SPREADSHEET_DEFAULT_HEIGHT: UiSpreadsheetHeight = 'full';

export const isSpreadsheetFillHeight = (height: UiSpreadsheetHeight): height is 'full' =>
  height === 'full';

export const resolveSpreadsheetHeightStyle = (
  height: UiSpreadsheetHeight,
): { className: string; style: React.CSSProperties } => {
  if (isSpreadsheetFillHeight(height)) {
    return {
      className: 'h-full min-h-0 flex-1',
      style: { height: '100%', minHeight: 0 },
    };
  }
  return {
    className: '',
    style: { height, minHeight: height },
  };
};

const SPREADSHEET_FULL_HEIGHT_FLOOR_PX = 320;

export const resolveSpreadsheetHostStyle = (
  height: UiSpreadsheetHeight,
  style?: React.CSSProperties,
): React.CSSProperties => ({
  ...style,
  ...resolveSpreadsheetHeightStyle(height).style,
  ...(isSpreadsheetFillHeight(height) ? { minHeight: SPREADSHEET_FULL_HEIGHT_FLOOR_PX } : {}),
});

export const notifyFortuneSheetHostResized = (): void => {
  window.dispatchEvent(new Event('resize'));
};

const HEADER: UiSpreadsheetCellValue = { bl: 1, bg: '#e2e8f0' };

const textCell = (r: number, c: number, value: string, extra?: UiSpreadsheetCellValue): UiSpreadsheetCell => ({
  r,
  c,
  v: { v: value, m: value, ...extra },
});

const numberCell = (r: number, c: number, value: number): UiSpreadsheetCell => ({
  r,
  c,
  v: { v: value, m: String(value), ct: { fa: 'General', t: 'n' } },
});

const formulaCell = (r: number, c: number, formula: string): UiSpreadsheetCell => ({
  r,
  c,
  v: { f: formula, v: 0, m: '0', ct: { fa: 'General', t: 'n' } },
});

export const createDemoSpreadsheetSheets = (): UiSpreadsheetSheet[] => [
  {
    id: 'sales',
    name: 'Sales',
    order: 0,
    status: 1,
    row: 36,
    column: 12,
    celldata: [
      textCell(0, 0, 'Product', HEADER),
      textCell(0, 1, 'Q1', HEADER),
      textCell(0, 2, 'Q2', HEADER),
      textCell(0, 3, 'Q3', HEADER),
      textCell(0, 4, 'Total', HEADER),
      textCell(1, 0, 'Alpha'),
      numberCell(1, 1, 12),
      numberCell(1, 2, 18),
      numberCell(1, 3, 9),
      formulaCell(1, 4, '=SUM(B2:D2)'),
      textCell(2, 0, 'Beta'),
      numberCell(2, 1, 7),
      numberCell(2, 2, 14),
      numberCell(2, 3, 21),
      formulaCell(2, 4, '=SUM(B3:D3)'),
      textCell(3, 0, 'Gamma'),
      numberCell(3, 1, 16),
      numberCell(3, 2, 11),
      numberCell(3, 3, 8),
      formulaCell(3, 4, '=SUM(B4:D4)'),
      textCell(4, 0, 'Total', { bl: 1 }),
      formulaCell(4, 1, '=SUM(B2:B4)'),
      formulaCell(4, 2, '=SUM(C2:C4)'),
      formulaCell(4, 3, '=SUM(D2:D4)'),
      formulaCell(4, 4, '=SUM(E2:E4)'),
    ],
  },
  {
    id: 'notes',
    name: 'Notes',
    order: 1,
    status: 0,
    row: 36,
    column: 12,
    celldata: [
      textCell(0, 0, 'Note', HEADER),
      textCell(1, 0, 'UiSpreadsheet wraps FortuneSheet Workbook.'),
      textCell(2, 0, 'Use the action API for sheets, cells, freeze, and merge.'),
    ],
  },
];

export const isBrowserSpreadsheetAvailable = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return !/jsdom|HappyDOM/i.test(userAgent);
};

export const applySpreadsheetGridLines = (
  sheets: UiSpreadsheetSheet[],
  showGridLines: boolean,
): UiSpreadsheetSheet[] =>
  sheets.map((sheet) => ({ ...sheet, showGridLines: showGridLines ? 1 : 0 }));

export const applySpreadsheetMinimumGrid = (
  sheets: UiSpreadsheetSheet[],
  rowCount: number,
  columnCount: number,
): UiSpreadsheetSheet[] =>
  sheets.map((sheet) => ({
    ...sheet,
    row: Math.max(sheet.row ?? 0, rowCount),
    column: Math.max(sheet.column ?? 0, columnCount),
  }));

export const spreadsheetCellHasContent = (
  value: UiSpreadsheetCellValue | null | undefined,
): boolean => {
  if (value == null) {
    return false;
  }
  if (value.v != null && value.v !== '') {
    return true;
  }
  if (typeof value.f === 'string' && value.f.trim() !== '') {
    return true;
  }
  if (typeof value.m === 'string' && value.m.trim() !== '') {
    return true;
  }
  if (value.bl || value.bg) {
    return true;
  }
  const extra = value as Record<string, unknown>;
  return Boolean(extra.fc || extra.ff || extra.it || extra.cl || extra.un || extra.ht || extra.vt || extra.mc);
};

export const spreadsheetDataToCelldata = (
  data: UiSpreadsheetSheet['data'],
): UiSpreadsheetCell[] => {
  if (!data) {
    return [];
  }
  const cells: UiSpreadsheetCell[] = [];
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) {
      continue;
    }
    for (let c = 0; c < row.length; c += 1) {
      const value = row[c];
      if (spreadsheetCellHasContent(value)) {
        cells.push({ r, c, v: value as UiSpreadsheetCellValue });
      }
    }
  }
  return cells;
};

export const toPersistedSpreadsheetSheets = (sheets: UiSpreadsheetSheet[]): UiSpreadsheetSheet[] =>
  sheets.map((sheet, index) => {
    const fromData = spreadsheetDataToCelldata(sheet.data);
    const fromCells = (sheet.celldata ?? []).filter((cell) => spreadsheetCellHasContent(cell.v));
    return {
      id: sheet.id,
      name: sheet.name,
      order: sheet.order ?? index,
      status: sheet.status,
      row: sheet.row ?? sheet.data?.length,
      column: sheet.column ?? sheet.data?.[0]?.length,
      celldata: fromData.length > 0 ? fromData : fromCells,
    };
  });

export const spreadsheetSheetsSignature = (sheets: UiSpreadsheetSheet[]): string =>
  JSON.stringify(toPersistedSpreadsheetSheets(sheets));

export const isSpreadsheetScrollNearEnd = (
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  remainingPx: number = UI_SPREADSHEET_ROW_GROW_REMAINING_PX,
): boolean => {
  if (scrollHeight <= clientHeight) {
    return false;
  }
  return scrollHeight - (scrollTop + clientHeight) <= remainingPx;
};

export const resolveSpreadsheetLastIndex = (count: number): number => Math.max(count - 1, 0);

export const summarizeSpreadsheetSheets = (sheets: UiSpreadsheetSheet[]): string[] =>
  sheets.flatMap((sheet) => {
    const cells = (sheet.celldata ?? []).slice(0, 6).map((cell) => {
      const label = cell.v.m ?? String(cell.v.v ?? cell.v.f ?? '');
      return `${sheet.name} ${String.fromCharCode(65 + cell.c)}${cell.r + 1}: ${label}`;
    });
    return cells.length > 0 ? cells : [`${sheet.name}: empty`];
  });

type FortuneWorkbookApi = {
  getCellValue: (row: number, column: number) => unknown;
  setCellValue: (row: number, column: number, value: unknown) => void;
  clearCell: (row: number, column: number) => void;
  setCellFormat: (row: number, column: number, attr: string, value: unknown) => void;
  getSelection: () => UiSpreadsheetSelection[] | undefined;
  getSelectionCoordinates: () => string[];
  setSelection: (range: UiSpreadsheetSelection[]) => void;
  getHtmlByRange: (range: UiSpreadsheetSelection[]) => string | null;
  getAllSheets: () => UiSpreadsheetSheet[];
  getSheet: () => UiSpreadsheetSheet & { data?: unknown[][] };
  addSheet: () => void;
  deleteSheet: (options?: { id?: string }) => void;
  activateSheet: (options?: { id?: string }) => void;
  setSheetName: (name: string) => void;
  insertRowOrColumn: (type: 'row' | 'column', index: number, count: number) => void;
  deleteRowOrColumn: (type: 'row' | 'column', start: number, end: number) => void;
  hideRowOrColumn: (rowOrColInfo: string[], type: 'row' | 'column') => void;
  showRowOrColumn: (rowOrColInfo: string[], type: 'row' | 'column') => void;
  setRowHeight: (rowInfo: Record<string, number>) => void;
  setColumnWidth: (columnInfo: Record<string, number>) => void;
  freeze: (type: 'row' | 'column' | 'both', range: { row: number; column: number }) => void;
  mergeCells: (ranges: UiSpreadsheetSelection[], type: string) => void;
  cancelMerge: (ranges: UiSpreadsheetSelection[]) => void;
  scroll: (options: { targetRow?: number; targetColumn?: number }) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  calculateFormula: () => void;
};

type FortuneCustomToolbarItem = {
  key: string;
  tooltip?: string;
  icon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
};

type FortuneWorkbookProps = Omit<
  UiSpreadsheetWorkbookSettings,
  'devicePixelRatio' | 'addColumns' | 'showAddColumns' | 'statBar'
> & {
  data: UiSpreadsheetSheet[];
  onChange?: (sheets: UiSpreadsheetSheet[]) => void;
  customToolbarItems?: FortuneCustomToolbarItem[];
  devicePixelRatio?: number;
};

type FortuneWorkbookComponent = React.ForwardRefExoticComponent<
  FortuneWorkbookProps & React.RefAttributes<FortuneWorkbookApi>
>;

let fortuneWorkbookPromise: Promise<FortuneWorkbookComponent | null> | null = null;

const loadFortuneWorkbook = async (): Promise<FortuneWorkbookComponent | null> => {
  if (!isBrowserSpreadsheetAvailable()) {
    return null;
  }
  fortuneWorkbookPromise ??= import('./fortuneSheetRuntime')
    .then((mod) => (mod.Workbook as FortuneWorkbookComponent | undefined) ?? null)
    .catch((error: unknown) => {
      fortuneWorkbookPromise = null;
      throw error;
    });
  return fortuneWorkbookPromise;
};

export const isSpreadsheetRtlRowGutter = (
  direction: UiSpreadsheetDirection,
  rowHeaderWidth: number,
): boolean => direction === 'rtl' && rowHeaderWidth > 0;

const SpreadsheetRtlRowGutter: React.FC<{
  hostRef: React.RefObject<HTMLDivElement | null>;
  rowCount: number;
  rowHeight: number;
  columnHeaderHeight: number;
  readRowCount: () => number;
}> = ({ hostRef, rowCount, rowHeight, columnHeaderHeight, readRowCount }) => {
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const [mountNode, setMountNode] = React.useState<Element | null>(null);
  const [visibleRowCount, setVisibleRowCount] = React.useState(rowCount);

  React.useEffect(() => {
    setVisibleRowCount(rowCount);
  }, [rowCount]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const find = (): Element | null => host.querySelector('.fortune-sheet-container');
    const existing = find();
    if (existing) {
      setMountNode(existing);
      return undefined;
    }
    const observer = new MutationObserver(() => {
      const next = find();
      if (next) {
        setMountNode(next);
        observer.disconnect();
      }
    });
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [hostRef]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !mountNode) {
      return undefined;
    }
    let bar: HTMLElement | null = null;
    const sync = () => {
      const nextBar = host.querySelector<HTMLElement>('.luckysheet-scrollbar-y');
      if (nextBar && nextBar !== bar) {
        bar?.removeEventListener('scroll', sync);
        bar = nextBar;
        bar.addEventListener('scroll', sync);
      }
      if (bar && bodyRef.current) {
        bodyRef.current.scrollTop = bar.scrollTop;
      }
      const nextCount = readRowCount();
      if (nextCount > 0) {
        setVisibleRowCount((current) => (current === nextCount ? current : nextCount));
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      bar?.removeEventListener('scroll', sync);
    };
  }, [hostRef, mountNode, readRowCount]);

  if (!mountNode) {
    return null;
  }

  return createPortal(
    <div
      className="ui-spreadsheet-rtl-row-gutter"
      style={{ width: UI_SPREADSHEET_ROW_HEADER_WIDTH }}
      aria-hidden="true"
    >
      <div
        className="ui-spreadsheet-rtl-row-gutter-corner"
        style={{ height: columnHeaderHeight }}
      />
      <div ref={bodyRef} className="ui-spreadsheet-rtl-row-gutter-body">
        {Array.from({ length: visibleRowCount }, (_, index) => (
          <div
            key={index}
            className="ui-spreadsheet-rtl-row-gutter-row"
            style={{ height: rowHeight }}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>,
    mountNode,
  );
};

const toFortuneWorkbookProps = (
  settings: UiSpreadsheetWorkbookSettings,
): Omit<UiSpreadsheetWorkbookSettings, 'devicePixelRatio' | 'addColumns' | 'showAddColumns' | 'statBar'> & {
  devicePixelRatio?: number;
} => {
  const {
    devicePixelRatio,
    addColumns: _addColumns,
    showAddColumns: _showAddColumns,
    statBar: _statBar,
    ...rest
  } = settings;
  if (devicePixelRatio == null) {
    return rest;
  }
  return { ...rest, devicePixelRatio };
};

class SpreadsheetRuntimeBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return null;
    }
    return this.props.children;
  }
}

const SpreadsheetFallback: React.FC<{
  sheets: UiSpreadsheetSheet[];
  height: UiSpreadsheetHeight;
  direction: UiSpreadsheetDirection;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  error?: string;
}> = ({ sheets, height, direction, className, style, loading = false, error }) => {
  const box = resolveSpreadsheetHeightStyle(height);
  return (
  <div
    className={cn(box.className, className)}
    style={{ ...style, ...box.style }}
    dir={direction}
    data-ui-spreadsheet=""
    data-spreadsheet-direction={direction}
    data-spreadsheet-height={isSpreadsheetFillHeight(height) ? 'full' : String(height)}
    data-spreadsheet-fallback={loading ? 'loading' : 'true'}
  >
    <div className="mb-2 ps-[4px] text-sm font-semibold text-slate-800">
      {loading ? 'Loading spreadsheet' : 'Spreadsheet'}
    </div>
    <ul className="m-0 list-disc space-y-1 ps-5 text-xs text-slate-600">
      {loading ? (
        <li>FortuneSheet is starting…</li>
      ) : error ? (
        <li>{error}</li>
      ) : (
        summarizeSpreadsheetSheets(sheets).map((line) => <li key={line}>{line}</li>)
      )}
    </ul>
  </div>
  );
};

const resolveSelection = (api: FortuneWorkbookApi | null): UiSpreadsheetSelection[] => {
  const selection = api?.getSelection();
  if (selection && selection.length > 0) {
    return selection;
  }
  return [{ row: [0, 0], column: [0, 0] }];
};

export const UiSpreadsheet = React.forwardRef<UiSpreadsheetHandle, UiSpreadsheetProps>(
  function UiSpreadsheet(
    {
      data,
      onChange,
      showGridLines = true,
      height = UI_SPREADSHEET_DEFAULT_HEIGHT,
      direction: directionInput,
      className,
      style,
      ...settingsInput
    },
    ref,
  ) {
    const direction = resolveUiSpreadsheetDirection(directionInput);
    const settings = resolveUiSpreadsheetWorkbookSettings(settingsInput);
    const showRtlRowGutter = isSpreadsheetRtlRowGutter(direction, settings.rowHeaderWidth);
    const workbookSettings = toFortuneWorkbookProps(
      showRtlRowGutter ? { ...settings, rowHeaderWidth: 0 } : settings,
    );
    const sheets = applySpreadsheetMinimumGrid(
      applySpreadsheetGridLines(
        data && data.length > 0 ? data : createDemoSpreadsheetSheets(),
        showGridLines,
      ),
      settings.row,
      settings.column,
    );
    const initialSheetsRef = React.useRef(sheets);
    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;
    const emitChange = React.useCallback((next: UiSpreadsheetSheet[]) => {
      onChangeRef.current?.(toPersistedSpreadsheetSheets(next));
    }, []);
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const workbookRef = React.useRef<FortuneWorkbookApi | null>(null);
    const growingRowsRef = React.useRef(false);
    const [runtime, setRuntime] = React.useState<{ Workbook: FortuneWorkbookComponent } | null>(null);
    const [phase, setPhase] = React.useState<'loading' | 'ready' | 'fallback'>(
      isBrowserSpreadsheetAvailable() ? 'loading' : 'fallback',
    );
    const [loadError, setLoadError] = React.useState<string | undefined>(undefined);

    const failSpreadsheet = React.useCallback((error?: unknown) => {
      const message = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'FortuneSheet failed to start.';
      setLoadError(message);
      setPhase('fallback');
    }, []);

    React.useEffect(() => {
      let cancelled = false;
      void loadFortuneWorkbook()
        .then((component) => {
          if (cancelled) {
            return;
          }
          if (!component) {
            failSpreadsheet();
            return;
          }
          setRuntime({ Workbook: component });
          setPhase('ready');
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            failSpreadsheet(error);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [failSpreadsheet]);

    React.useImperativeHandle(ref, () => ({
      getCellValue: (cellRow, cellColumn) => workbookRef.current?.getCellValue(cellRow, cellColumn),
      setCellValue: (cellRow, cellColumn, value) => {
        workbookRef.current?.setCellValue(cellRow, cellColumn, value);
      },
      clearCell: (cellRow, cellColumn) => {
        workbookRef.current?.clearCell(cellRow, cellColumn);
      },
      setCellFormat: (cellRow, cellColumn, attr, value) => {
        workbookRef.current?.setCellFormat(cellRow, cellColumn, attr, value);
      },
      getSelection: () => workbookRef.current?.getSelection(),
      getSelectionCoordinates: () => workbookRef.current?.getSelectionCoordinates() ?? [],
      setSelection: (rowStart, rowEnd, columnStart, columnEnd) => {
        workbookRef.current?.setSelection([{ row: [rowStart, rowEnd], column: [columnStart, columnEnd] }]);
      },
      getHtmlByRange: () => {
        const api = workbookRef.current;
        if (!api) {
          return null;
        }
        return api.getHtmlByRange(resolveSelection(api));
      },
      getSheets: () =>
        (workbookRef.current?.getAllSheets() ?? []).map((sheet) => ({ id: sheet.id, name: sheet.name })),
      getSheet: () => workbookRef.current?.getSheet(),
      getPersistedSheets: () => toPersistedSpreadsheetSheets(workbookRef.current?.getAllSheets() ?? []),
      addSheet: () => {
        workbookRef.current?.addSheet();
      },
      deleteSheet: (id) => {
        workbookRef.current?.deleteSheet(id ? { id } : undefined);
      },
      activateSheet: (id) => {
        workbookRef.current?.activateSheet({ id });
      },
      setSheetName: (name) => {
        workbookRef.current?.setSheetName(name);
      },
      insertRows: (index = 0, count = 1) => {
        workbookRef.current?.insertRowOrColumn('row', index, count);
      },
      insertColumns: (index = 0, count = 1) => {
        workbookRef.current?.insertRowOrColumn('column', index, count);
      },
      deleteRows: (start = 0, end = start) => {
        workbookRef.current?.deleteRowOrColumn('row', start, end);
      },
      deleteColumns: (start = 0, end = start) => {
        workbookRef.current?.deleteRowOrColumn('column', start, end);
      },
      hideRows: (rows = [0]) => {
        workbookRef.current?.hideRowOrColumn(rows.map(String), 'row');
      },
      hideColumns: (columns = [0]) => {
        workbookRef.current?.hideRowOrColumn(columns.map(String), 'column');
      },
      showRows: (rows = [0]) => {
        workbookRef.current?.showRowOrColumn(rows.map(String), 'row');
      },
      showColumns: (columns = [0]) => {
        workbookRef.current?.showRowOrColumn(columns.map(String), 'column');
      },
      setRowHeight: (cellRow, rowHeight) => {
        workbookRef.current?.setRowHeight({ [String(cellRow)]: rowHeight });
      },
      setColumnWidth: (cellColumn, columnWidth) => {
        workbookRef.current?.setColumnWidth({ [String(cellColumn)]: columnWidth });
      },
      freeze: (type, freezeRow = 0, freezeColumn = 0) => {
        workbookRef.current?.freeze(type, { row: freezeRow, column: freezeColumn });
      },
      mergeCells: (type = 'merge-all') => {
        const api = workbookRef.current;
        if (!api) {
          return;
        }
        api.mergeCells(resolveSelection(api), type);
      },
      unmergeCells: () => {
        const api = workbookRef.current;
        if (!api) {
          return;
        }
        api.cancelMerge(resolveSelection(api));
      },
      scrollTo: (cellRow, cellColumn) => {
        workbookRef.current?.scroll({ targetRow: cellRow, targetColumn: cellColumn });
      },
      undo: () => {
        workbookRef.current?.handleUndo();
      },
      redo: () => {
        workbookRef.current?.handleRedo();
      },
      calculateFormula: () => {
        workbookRef.current?.calculateFormula();
      },
    }), []);

    const insertAtEnd = React.useCallback((type: 'row' | 'column', count: number) => {
      const api = workbookRef.current;
      if (!api) {
        return;
      }
      const sheet = api.getSheet();
      const current = type === 'row'
        ? (sheet?.row ?? sheet?.data?.length ?? 0)
        : (sheet?.column ?? sheet?.data?.[0]?.length ?? 0);
      if (current <= 0) {
        return;
      }
      api.insertRowOrColumn(type, resolveSpreadsheetLastIndex(current), count);
    }, []);

    const readRtlRowCount = React.useCallback((): number => {
      const sheet = workbookRef.current?.getSheet();
      return sheet?.row ?? sheet?.data?.length ?? settings.row;
    }, [settings.row]);

    const growRowsIfNearEnd = React.useCallback(() => {
      if (growingRowsRef.current || settings.addRows !== 0 || !settings.allowEdit) {
        return;
      }
      const bar = hostRef.current?.querySelector<HTMLElement>('.luckysheet-scrollbar-y');
      if (!bar || !isSpreadsheetScrollNearEnd(bar.scrollTop, bar.clientHeight, bar.scrollHeight)) {
        return;
      }
      growingRowsRef.current = true;
      insertAtEnd('row', UI_SPREADSHEET_ROW_GROW_BATCH);
      window.setTimeout(() => {
        growingRowsRef.current = false;
      }, 250);
    }, [insertAtEnd, settings.addRows, settings.allowEdit]);

    React.useEffect(() => {
      if (phase !== 'ready' || settings.addRows !== 0 || !settings.allowEdit) {
        return undefined;
      }
      const host = hostRef.current;
      if (!host) {
        return undefined;
      }
      let unbindScroll: (() => void) | undefined;
      const bindScrollbar = () => {
        if (unbindScroll) {
          return;
        }
        const bar = host.querySelector<HTMLElement>('.luckysheet-scrollbar-y');
        if (!bar) {
          return;
        }
        bar.addEventListener('scroll', growRowsIfNearEnd);
        unbindScroll = () => bar.removeEventListener('scroll', growRowsIfNearEnd);
      };
      bindScrollbar();
      const observer = new MutationObserver(bindScrollbar);
      observer.observe(host, { childList: true, subtree: true });
      host.addEventListener('wheel', growRowsIfNearEnd, { passive: true });
      return () => {
        observer.disconnect();
        unbindScroll?.();
        host.removeEventListener('wheel', growRowsIfNearEnd);
      };
    }, [growRowsIfNearEnd, phase, settings.addRows, settings.allowEdit]);

    React.useEffect(() => {
      if (phase !== 'ready' || typeof ResizeObserver === 'undefined') {
        return undefined;
      }
      const host = hostRef.current;
      if (!host) {
        return undefined;
      }
      let lastWidth = 0;
      let lastHeight = 0;
      const notifyIfSized = () => {
        const width = host.clientWidth;
        const heightPx = host.clientHeight;
        if (width === lastWidth && heightPx === lastHeight) {
          return;
        }
        lastWidth = width;
        lastHeight = heightPx;
        if (width > 0 && heightPx > 0) {
          notifyFortuneSheetHostResized();
        }
      };
      notifyIfSized();
      const resizeObserver = new ResizeObserver(notifyIfSized);
      resizeObserver.observe(host);
      return () => resizeObserver.disconnect();
    }, [phase]);

    const customToolbarItems = React.useMemo((): FortuneCustomToolbarItem[] | undefined => {
      if (!settings.showAddColumns || !settings.allowEdit || !settings.showToolbar) {
        return undefined;
      }
      return [
        {
          key: 'add-columns',
          tooltip: `Add ${settings.addColumns} columns`,
          icon: <Columns3 width={24} height={24} />,
          onClick: () => {
            insertAtEnd('column', settings.addColumns);
          },
        },
      ];
    }, [insertAtEnd, settings.addColumns, settings.allowEdit, settings.showAddColumns, settings.showToolbar]);

    const box = resolveSpreadsheetHeightStyle(height);
    const hostStyle = resolveSpreadsheetHostStyle(height, style);
    const Workbook = runtime?.Workbook;
    const showLoadingFallback = phase !== 'fallback' && (phase === 'loading' || !Workbook);

    if (phase === 'fallback' || !Workbook) {
      return (
        <SpreadsheetFallback
          sheets={sheets}
          height={height}
          direction={direction}
          className={className}
          style={style}
          loading={showLoadingFallback}
          error={phase === 'fallback' ? loadError : undefined}
        />
      );
    }

    return (
      <div
        ref={hostRef}
        className={cn(
          'relative flex min-h-0 w-full flex-col overflow-hidden [&>*]:h-full [&>*]:min-h-0 [&>*]:w-full',
          box.className,
          className,
        )}
        style={hostStyle}
        dir={direction}
        data-ui-spreadsheet=""
        data-spreadsheet-direction={direction}
        data-spreadsheet-height={isSpreadsheetFillHeight(height) ? 'full' : String(height)}
        data-spreadsheet-edit={settings.allowEdit ? 'true' : 'false'}
        data-spreadsheet-add-rows={String(settings.addRows)}
        data-spreadsheet-stat={resolveUiSpreadsheetHostStatBar(settings.statBar, settings.showSheetTabs)}
      >
        <SpreadsheetRuntimeBoundary onError={failSpreadsheet}>
          <Workbook
            ref={workbookRef}
            data={initialSheetsRef.current}
            onChange={emitChange}
            {...workbookSettings}
            customToolbarItems={customToolbarItems}
          />
        </SpreadsheetRuntimeBoundary>
        {showRtlRowGutter ? (
          <SpreadsheetRtlRowGutter
            hostRef={hostRef}
            rowCount={settings.row}
            rowHeight={settings.defaultRowHeight}
            columnHeaderHeight={settings.columnHeaderHeight}
            readRowCount={readRtlRowCount}
          />
        ) : null}
      </div>
    );
  },
);
