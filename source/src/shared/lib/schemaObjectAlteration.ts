import type { EdgeModelColumn } from '../api/contracts/data-api';
import { assertSchemaObjectName } from './schemaObjectName';

export type AddColumnDefinition = Pick<EdgeModelColumn, 'name' | 'dataType' | 'allowNull'>;

const quotePg = (name: string) => `"${name.replace(/"/g, '""')}"`;

export const buildAddColumnStatement = (
  sourceType: string,
  tableName: string,
  column: AddColumnDefinition,
): string => {
  const table = assertSchemaObjectName(tableName);
  const columnName = assertSchemaObjectName(column.name);
  const dataType = column.dataType.trim();

  if (!dataType) {
    throw new Error(`Column "${columnName}" requires a data type.`);
  }

  const nullability = column.allowNull ? 'NULL' : 'NOT NULL';
  const dialect = sourceType.trim();

  if (dialect === 'PostgreSQL') {
    return `ALTER TABLE ${quotePg(table)} ADD COLUMN ${quotePg(columnName)} ${dataType} ${nullability}`;
  }

  if (dialect === 'SQLite') {
    return `ALTER TABLE ${table} ADD COLUMN ${columnName} ${dataType}${column.allowNull ? '' : ' NOT NULL'}`;
  }

  if (dialect === 'MySQL') {
    return `ALTER TABLE ${table} ADD COLUMN ${columnName} ${dataType} ${nullability}`;
  }

  if (dialect === 'SQL Server') {
    return `ALTER TABLE ${table} ADD ${columnName} ${dataType} ${nullability}`;
  }

  throw new Error(`Adding columns is not supported for ${dialect} yet.`);
};

export const buildAddColumnStatements = (
  sourceType: string,
  tableName: string,
  columns: AddColumnDefinition[],
): string[] => columns.map((column) => buildAddColumnStatement(sourceType, tableName, column));

export const buildDropColumnStatement = (
  sourceType: string,
  tableName: string,
  columnName: string,
): string => {
  const table = assertSchemaObjectName(tableName);
  const column = assertSchemaObjectName(columnName);
  const dialect = sourceType.trim();

  if (dialect === 'PostgreSQL') {
    return `ALTER TABLE ${quotePg(table)} DROP COLUMN ${quotePg(column)}`;
  }

  if (dialect === 'SQLite') {
    return `ALTER TABLE ${table} DROP COLUMN ${column}`;
  }

  if (dialect === 'MySQL') {
    return `ALTER TABLE ${table} DROP COLUMN ${column}`;
  }

  if (dialect === 'SQL Server') {
    return `ALTER TABLE ${table} DROP COLUMN ${column}`;
  }

  throw new Error(`Dropping columns is not supported for ${dialect} yet.`);
};

export const resolveNewTableColumns = (
  desiredColumns: EdgeModelColumn[],
  existingColumnNames: ReadonlySet<string>,
): EdgeModelColumn[] => (
  desiredColumns.filter((column) => !existingColumnNames.has(column.name))
);

/** Column names present in the database but missing from the desired Edge model shape. */
export const resolveRemovedTableColumnNames = (
  desiredColumns: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>,
  existingColumnNames: ReadonlySet<string>,
): string[] => {
  const desiredNames = new Set(desiredColumns.map((column) => column.name));
  return [...existingColumnNames]
    .filter((name) => !desiredNames.has(name))
    .sort((left, right) => left.localeCompare(right));
};
