import { describe, expect, it } from 'vitest';
import type { SchemaFieldInfo } from '../../../../shared/api/queries/data-sources';
import {
  getInputFieldColumnsForOption,
  isSchemaFieldWritableForRequest,
  suggestFieldsForOption,
} from '../dataApiRouteMethods';

const sampleColumns: SchemaFieldInfo[] = [
  {
    name: 'id',
    dataType: 'INTEGER',
    suggestedFieldType: 'integer',
    nullable: false,
    isPrimaryKey: true,
  },
  {
    name: 'email',
    dataType: 'TEXT',
    suggestedFieldType: 'string',
    nullable: false,
    isPrimaryKey: false,
  },
  {
    name: 'status',
    dataType: 'TEXT',
    suggestedFieldType: 'string',
    nullable: true,
    isPrimaryKey: false,
  },
];

describe('dataApiRouteMethods field selection', () => {
  it('excludes db-generated primary key from writable request fields', () => {
    expect(isSchemaFieldWritableForRequest(sampleColumns[0], 'id')).toBe(false);
    expect(isSchemaFieldWritableForRequest(sampleColumns[1], 'id')).toBe(true);
  });

  it('suggests create input fields without primary key', () => {
    const fields = suggestFieldsForOption('POST', 'TABLE', sampleColumns, 'id');
    expect(fields.map((field) => field.name)).toEqual(['email', 'status']);
  });

  it('limits selectable input columns for create', () => {
    const columns = getInputFieldColumnsForOption('POST', 'TABLE', sampleColumns, 'id');
    expect(columns.map((column) => column.name)).toEqual(['email', 'status']);
  });

  it('returns no input columns for read methods', () => {
    expect(getInputFieldColumnsForOption('GET_LIST', 'TABLE', sampleColumns, 'id')).toEqual([]);
  });
});
