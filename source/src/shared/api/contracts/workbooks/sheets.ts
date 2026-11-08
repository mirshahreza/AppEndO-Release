import type { WorkbookSheet, WorkbookSheetCell, WorkbookSheetCellValue } from './types';

const HEADER: WorkbookSheetCellValue = { bl: 1, bg: '#e2e8f0' };

export const textCell = (
  r: number,
  c: number,
  value: string,
  extra?: WorkbookSheetCellValue,
): WorkbookSheetCell => ({
  r,
  c,
  v: { v: value, m: value, ...extra },
});

export const numberCell = (r: number, c: number, value: number): WorkbookSheetCell => ({
  r,
  c,
  v: { v: value, m: String(value), ct: { fa: 'General', t: 'n' } },
});

export const formulaCell = (r: number, c: number, formula: string): WorkbookSheetCell => ({
  r,
  c,
  v: { f: formula, v: 0, m: '0', ct: { fa: 'General', t: 'n' } },
});

export const headerCell = (r: number, c: number, value: string): WorkbookSheetCell =>
  textCell(r, c, value, HEADER);

export const cellDisplay = (cell: WorkbookSheetCell | undefined): string => {
  if (!cell) {
    return '';
  }
  if (typeof cell.v.m === 'string') {
    return cell.v.m;
  }
  if (cell.v.v == null) {
    return '';
  }
  return String(cell.v.v);
};

export const buildSheet = (
  name: string,
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
  options?: { id?: string; order?: number; status?: number },
): WorkbookSheet => {
  const celldata: WorkbookSheetCell[] = headers.map((header, column) => headerCell(0, column, header));
  rows.forEach((row, rowIndex) => {
    row.forEach((value, column) => {
      if (value == null || value === '') {
        return;
      }
      if (typeof value === 'number') {
        celldata.push(numberCell(rowIndex + 1, column, value));
        return;
      }
      celldata.push(textCell(rowIndex + 1, column, value));
    });
  });
  return {
    id: options?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    order: options?.order ?? 0,
    status: options?.status ?? (options?.order === 0 || options?.order == null ? 1 : 0),
    row: Math.max(36, rows.length + 12),
    column: Math.max(12, headers.length + 2),
    celldata,
  };
};

export const readSheetTable = (
  sheet: WorkbookSheet | undefined,
): { headers: string[]; rows: string[][] } => {
  const cells = sheet?.celldata ?? [];
  if (cells.length === 0) {
    return { headers: [], rows: [] };
  }
  const maxRow = cells.reduce((max, cell) => Math.max(max, cell.r), 0);
  const maxCol = cells.reduce((max, cell) => Math.max(max, cell.c), 0);
  const grid: Array<Array<WorkbookSheetCell | undefined>> = Array.from({ length: maxRow + 1 }, () =>
    Array.from({ length: maxCol + 1 }),
  );
  for (const cell of cells) {
    const row = grid[cell.r];
    if (row) {
      row[cell.c] = cell;
    }
  }
  const headers = (grid[0] ?? []).map((cell) => cellDisplay(cell).trim());
  const lastHeader = headers.reduce((last, header, index) => (header ? index : last), -1);
  const headerCount = lastHeader + 1;
  const rows: string[][] = [];
  for (let rowIndex = 1; rowIndex < grid.length; rowIndex += 1) {
    const values = (grid[rowIndex] ?? []).slice(0, headerCount).map((cell) => cellDisplay(cell).trim());
    if (values.every((value) => value === '')) {
      continue;
    }
    rows.push(values);
  }
  return { headers: headers.slice(0, headerCount), rows };
};

export const objectsFromSheet = (
  sheet: WorkbookSheet | undefined,
): Array<Record<string, string>> => {
  const { headers, rows } = readSheetTable(sheet);
  return rows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) {
        record[header] = row[index] ?? '';
      }
    });
    return record;
  });
};

export const sheetFromObjects = (
  name: string,
  headers: readonly string[],
  records: ReadonlyArray<Record<string, unknown>>,
  options?: { id?: string; order?: number; status?: number },
): WorkbookSheet => {
  const rows = records.map((record) =>
    headers.map((header) => {
      const value = record[header];
      if (typeof value === 'number') {
        return value;
      }
      if (value == null) {
        return '';
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    }),
  );
  return buildSheet(name, headers, rows, options);
};
