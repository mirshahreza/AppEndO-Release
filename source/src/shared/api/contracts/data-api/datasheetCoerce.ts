import type { EdgeModelColumn } from './types';

const INTEGER_RE = /^-?\d+$/;
const NUMBER_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

export class DatasheetCellError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'DatasheetCellError';
    this.field = field;
  }
}

export function isBooleanColumn(column: EdgeModelColumn): boolean {
  return column.sequelizeType === 'BOOLEAN' || /\bBOOL/i.test(column.dataType);
}

export function isIntegerColumn(column: EdgeModelColumn): boolean {
  if (column.sequelizeType === 'INTEGER' || column.sequelizeType === 'BIGINT') {
    return true;
  }
  return /\b(BIGINT|SMALLINT|TINYINT|INT)\b/i.test(column.dataType)
    && !/\bINTERVAL\b/i.test(column.dataType);
}

export function isFloatColumn(column: EdgeModelColumn): boolean {
  if (
    column.sequelizeType === 'FLOAT'
    || column.sequelizeType === 'DOUBLE'
    || column.sequelizeType === 'DECIMAL'
    || column.sequelizeType === 'REAL'
  ) {
    return true;
  }
  return /\b(DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE|MONEY)\b/i.test(column.dataType);
}

const isEmptyCell = (raw: unknown): boolean => (
  raw === '' || raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')
);

export function coerceDatasheetCell(column: EdgeModelColumn, raw: unknown): unknown {
  if (isEmptyCell(raw)) {
    if (!column.allowNull && !column.isPrimaryKey) {
      throw new DatasheetCellError(column.field, `${column.name} is required.`);
    }
    return null;
  }

  const text = String(raw).trim();

  if (isBooleanColumn(column)) {
    const token = text.toLowerCase();
    if (token === 'true' || token === '1' || token === 'yes') {
      return true;
    }
    if (token === 'false' || token === '0' || token === 'no') {
      return false;
    }
    throw new DatasheetCellError(column.field, `${column.name} must be true or false.`);
  }

  if (isIntegerColumn(column)) {
    if (!INTEGER_RE.test(text)) {
      throw new DatasheetCellError(column.field, `${column.name} must be a whole number.`);
    }
    if (column.sequelizeType === 'BIGINT' || /\bBIGINT\b/i.test(column.dataType)) {
      return text;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      throw new DatasheetCellError(column.field, `${column.name} must be a whole number.`);
    }
    return parsed;
  }

  if (isFloatColumn(column)) {
    if (!NUMBER_RE.test(text)) {
      throw new DatasheetCellError(column.field, `${column.name} must be a number.`);
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      throw new DatasheetCellError(column.field, `${column.name} must be a number.`);
    }
    return parsed;
  }

  return typeof raw === 'string' ? raw : text;
}

export type CoerceDatasheetRowOptions = {
  omitEmptyPrimaryKey?: boolean;
  omitPrimaryKey?: boolean;
};

export function coerceDatasheetRow(
  columns: EdgeModelColumn[],
  values: Record<string, unknown>,
  options: CoerceDatasheetRowOptions = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const column of columns) {
    if (options.omitPrimaryKey && column.isPrimaryKey) {
      continue;
    }
    const value = values[column.field] ?? values[column.name];
    if (value === undefined) {
      continue;
    }
    if (options.omitEmptyPrimaryKey && column.isPrimaryKey && isEmptyCell(value)) {
      continue;
    }
    payload[column.field] = coerceDatasheetCell(column, value);
  }
  return payload;
}

export function firstDatasheetRowError(
  columns: EdgeModelColumn[],
  values: Record<string, unknown>,
  options: CoerceDatasheetRowOptions = {},
): { field: string; message: string } | null {
  try {
    coerceDatasheetRow(columns, values, options);
    return null;
  } catch (error) {
    if (error instanceof DatasheetCellError) {
      return { field: error.field, message: error.message };
    }
    throw error;
  }
}
