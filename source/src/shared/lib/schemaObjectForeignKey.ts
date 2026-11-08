import { isControlPlaneSchemaObjectName } from './controlPlaneSchemaObjects';
import { assertSchemaObjectName } from './schemaObjectName';
import type { FkReferentialAction } from '../api/contracts/data-sources/foreignKeyConstraint';

export type AddForeignKeyDefinition = {
  tableName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName?: string;
  onDelete?: FkReferentialAction;
  onUpdate?: FkReferentialAction;
};

export type DropForeignKeyDefinition = {
  tableName: string;
  constraintName: string;
};

const quotePg = (name: string) => `"${name.replace(/"/g, '""')}"`;
const quoteMysql = (name: string) => `\`${name.replace(/`/g, '``')}\``;
const quoteMssql = (name: string) => `[${name.replace(/]/g, ']]')}]`;

const supportsPhysicalForeignKeyAlter = (sourceType: string): boolean => {
  const dialect = sourceType.trim();
  return dialect === 'PostgreSQL' || dialect === 'MySQL' || dialect === 'SQL Server';
};

export const assertPhysicalForeignKeyAlterSupported = (sourceType: string): void => {
  const dialect = sourceType.trim();
  if (supportsPhysicalForeignKeyAlter(dialect)) {
    return;
  }
  if (dialect === 'SQLite') {
    throw new Error(
      'SQLite cannot add or drop foreign-key constraints on existing tables without rebuilding the table. Use logical relations on the Relations diagram for metadata-only links, or recreate the table with the constraint.',
    );
  }
  throw new Error(`Adding or dropping foreign-key constraints is not supported for ${dialect || 'this data source'} yet.`);
};

export const suggestForeignKeyConstraintName = (
  tableName: string,
  columnName: string,
): string => {
  const raw = `fk_${tableName}_${columnName}`.replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
  const trimmed = raw.slice(0, 63).replace(/_+$/g, '');
  return assertSchemaObjectName(trimmed || 'fk_relation');
};

const assertEdgeTableName = (tableName: string, fieldLabel: string): string => {
  const trimmed = String(tableName || '').trim();
  if (isControlPlaneSchemaObjectName(trimmed)) {
    throw new Error(`${fieldLabel} "${trimmed}" is a platform table and cannot be altered here.`);
  }
  return assertSchemaObjectName(trimmed);
};

const appendReferentialActions = (
  parts: string[],
  onDelete?: FkReferentialAction,
  onUpdate?: FkReferentialAction,
): void => {
  if (onDelete) {
    parts.push(`ON DELETE ${onDelete}`);
  }
  if (onUpdate) {
    parts.push(`ON UPDATE ${onUpdate}`);
  }
};

export const buildAddForeignKeyStatement = (
  sourceType: string,
  definition: AddForeignKeyDefinition,
): string => {
  assertPhysicalForeignKeyAlterSupported(sourceType);

  // Only the FK-owning table is altered — referencing a platform `base_*` table is allowed.
  const tableName = assertEdgeTableName(definition.tableName, 'Table');
  const columnName = assertSchemaObjectName(definition.columnName, { fieldLabel: 'Column name' });
  const referencedTable = assertSchemaObjectName(definition.referencedTable, {
    fieldLabel: 'Referenced table',
    rejectBasePrefix: false,
  });
  const referencedColumn = assertSchemaObjectName(definition.referencedColumn, {
    fieldLabel: 'Referenced column',
    rejectBasePrefix: false,
  });
  const constraintName = assertSchemaObjectName(
    definition.constraintName?.trim()
      || suggestForeignKeyConstraintName(tableName, columnName),
    { fieldLabel: 'Constraint name' },
  );

  if (tableName === referencedTable && columnName === referencedColumn) {
    throw new Error('A foreign key cannot reference the same column.');
  }

  const dialect = sourceType.trim();
  const actions: string[] = [];
  appendReferentialActions(actions, definition.onDelete, definition.onUpdate);
  const actionSql = actions.length > 0 ? ` ${actions.join(' ')}` : '';

  if (dialect === 'PostgreSQL') {
    return [
      `ALTER TABLE ${quotePg(tableName)}`,
      `ADD CONSTRAINT ${quotePg(constraintName)}`,
      `FOREIGN KEY (${quotePg(columnName)})`,
      `REFERENCES ${quotePg(referencedTable)} (${quotePg(referencedColumn)})${actionSql}`,
    ].join(' ');
  }

  if (dialect === 'MySQL') {
    return [
      `ALTER TABLE ${quoteMysql(tableName)}`,
      `ADD CONSTRAINT ${quoteMysql(constraintName)}`,
      `FOREIGN KEY (${quoteMysql(columnName)})`,
      `REFERENCES ${quoteMysql(referencedTable)} (${quoteMysql(referencedColumn)})${actionSql}`,
    ].join(' ');
  }

  // SQL Server
  return [
    `ALTER TABLE ${quoteMssql(tableName)}`,
    `ADD CONSTRAINT ${quoteMssql(constraintName)}`,
    `FOREIGN KEY (${quoteMssql(columnName)})`,
    `REFERENCES ${quoteMssql(referencedTable)} (${quoteMssql(referencedColumn)})${actionSql}`,
  ].join(' ');
};

export const buildDropForeignKeyStatement = (
  sourceType: string,
  definition: DropForeignKeyDefinition,
): string => {
  assertPhysicalForeignKeyAlterSupported(sourceType);

  const tableName = assertEdgeTableName(definition.tableName, 'Table');
  const constraintName = assertSchemaObjectName(definition.constraintName);
  const dialect = sourceType.trim();

  if (dialect === 'PostgreSQL') {
    return `ALTER TABLE ${quotePg(tableName)} DROP CONSTRAINT ${quotePg(constraintName)}`;
  }

  if (dialect === 'MySQL') {
    return `ALTER TABLE ${quoteMysql(tableName)} DROP FOREIGN KEY ${quoteMysql(constraintName)}`;
  }

  // SQL Server
  return `ALTER TABLE ${quoteMssql(tableName)} DROP CONSTRAINT ${quoteMssql(constraintName)}`;
};

export const canMutatePhysicalForeignKeys = (
  sourceType: string | null | undefined,
  objectType: 'TABLE' | 'VIEW',
  objectName: string,
): boolean => (
  objectType === 'TABLE'
  && !isControlPlaneSchemaObjectName(objectName)
  && Boolean(sourceType && supportsPhysicalForeignKeyAlter(sourceType))
);
