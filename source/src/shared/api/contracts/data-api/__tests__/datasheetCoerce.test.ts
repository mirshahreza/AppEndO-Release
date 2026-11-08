import { describe, expect, it } from 'vitest';
import type { EdgeModelColumn } from '../types';
import { coerceDatasheetCell, DatasheetCellError, firstDatasheetRowError } from '../datasheetCoerce';

const column = (overrides: Partial<EdgeModelColumn>): EdgeModelColumn => ({
  name: 'Amount',
  field: 'amount',
  dataType: 'int',
  sequelizeType: 'INTEGER',
  allowNull: true,
  isPrimaryKey: false,
  isForeignKey: false,
  ...overrides,
});

describe('coerceDatasheetCell', () => {
  it('rejects a string in a numeric field', () => {
    expect(() => coerceDatasheetCell(column({}), 'abc')).toThrow(DatasheetCellError);
    expect(() => coerceDatasheetCell(column({}), 'abc')).toThrow(/whole number/);
  });

  it('rejects a decimal in an integer field', () => {
    expect(() => coerceDatasheetCell(column({}), '12.5')).toThrow(/whole number/);
  });

  it('accepts a whole number', () => {
    expect(coerceDatasheetCell(column({}), '42')).toBe(42);
  });

  it('rejects a string in a float field', () => {
    const price = column({
      name: 'Price',
      field: 'price',
      dataType: 'decimal',
      sequelizeType: 'DECIMAL',
    });
    expect(() => coerceDatasheetCell(price, 'free')).toThrow(/must be a number/);
    expect(coerceDatasheetCell(price, '12.5')).toBe(12.5);
  });

  it('requires non-null columns', () => {
    const name = column({
      name: 'Title',
      field: 'title',
      dataType: 'nvarchar',
      sequelizeType: 'STRING',
      allowNull: false,
    });
    expect(() => coerceDatasheetCell(name, '')).toThrow(/required/);
  });
});

describe('firstDatasheetRowError', () => {
  it('returns the first invalid field', () => {
    const columns = [
      column({ name: 'Id', field: 'id', isPrimaryKey: true, allowNull: false }),
      column({ name: 'Qty', field: 'qty', allowNull: false }),
    ];
    const error = firstDatasheetRowError(columns, { id: '1', qty: 'nope' }, { omitEmptyPrimaryKey: true });
    expect(error).toEqual({ field: 'qty', message: 'Qty must be a whole number.' });
  });
});
