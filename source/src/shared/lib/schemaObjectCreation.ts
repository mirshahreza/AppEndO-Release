import type { SchemaFunctionKind, SchemaObjectType } from '../api/queries/data-sources';
import { assertSchemaObjectName } from './schemaObjectName';

export { assertSchemaObjectName } from './schemaObjectName';

const CREATE_SQL_PATTERN = /^\s*CREATE\b/i;
const ALTER_SQL_PATTERN = /^\s*(CREATE(\s+OR\s+REPLACE)?|ALTER)\b/i;
const MAX_CREATE_SQL_LENGTH = 100_000;
const SQL_EDITOR_TEMPLATE_COMMENT = '-- Write your script here';

const skipLineBreak = (value: string, index: number): number => (
  value[index] === '\r' && value[index + 1] === '\n' ? 2 : 1
);

const stripLeadingSqlComments = (value: string): string => {
  let remaining = value.trimStart();

  while (remaining.length > 0) {
    if (remaining.startsWith('--')) {
      const lineBreak = remaining.search(/\r\n|\n|\r/);
      if (lineBreak === -1) {
        return '';
      }
      remaining = remaining.slice(lineBreak + skipLineBreak(remaining, lineBreak)).trimStart();
      continue;
    }

    if (remaining.startsWith('/*')) {
      const blockEnd = remaining.indexOf('*/');
      if (blockEnd === -1) {
        return '';
      }
      remaining = remaining.slice(blockEnd + 2).trimStart();
      continue;
    }

    break;
  }

  return remaining;
};

export const assertCreateSchemaSql = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error('SQL statement is required.');
  }
  if (normalized.length > MAX_CREATE_SQL_LENGTH) {
    throw new Error('SQL statement is too long.');
  }
  const executable = stripLeadingSqlComments(normalized);
  if (!executable || !CREATE_SQL_PATTERN.test(executable)) {
    throw new Error('Only CREATE statements are allowed in this editor.');
  }
  return executable;
};

export const assertAlterSchemaSql = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error('SQL statement is required.');
  }
  if (normalized.length > MAX_CREATE_SQL_LENGTH) {
    throw new Error('SQL statement is too long.');
  }
  const executable = stripLeadingSqlComments(normalized);
  if (!executable || !ALTER_SQL_PATTERN.test(executable)) {
    throw new Error('Only CREATE, CREATE OR REPLACE, or ALTER statements are allowed in this editor.');
  }
  return executable;
};

export type CreateSchemaObjectRequest = {
  objectName: string;
  objectType: SchemaObjectType;
  functionKind?: SchemaFunctionKind;
};

const quotePg = (name: string) => `"${name}"`;

const withSqlEditorComment = (statement: string): string => (
  `${SQL_EDITOR_TEMPLATE_COMMENT}\n${statement}`
);

export const buildCreateSchemaObjectStatement = (
  sourceType: string,
  input: CreateSchemaObjectRequest,
): string => {
  const name = assertSchemaObjectName(input.objectName);
  const dialect = sourceType.trim();

  if (dialect === 'PostgreSQL') {
    switch (input.objectType) {
      case 'TABLE':
        return [
          'CREATE TABLE',
          `${quotePg(name)} (`,
          `  ${quotePg('id')} BIGSERIAL PRIMARY KEY`,
          ');',
        ].join('\n');
      case 'VIEW':
        return withSqlEditorComment([
          `CREATE VIEW ${quotePg(name)} AS`,
          'SELECT 1::bigint AS id;',
        ].join('\n'));
      case 'PROCEDURE':
        return withSqlEditorComment([
          `CREATE OR REPLACE PROCEDURE ${quotePg(name)}()`,
          'LANGUAGE sql',
          "AS 'SELECT 1;';",
        ].join('\n'));
      case 'FUNCTION':
        if (input.functionKind === 'TABLE_VALUED') {
          return withSqlEditorComment([
            `CREATE OR REPLACE FUNCTION ${quotePg(name)}()`,
            'RETURNS TABLE(id bigint)',
            'LANGUAGE sql',
            "AS 'SELECT 1::bigint AS id;';",
          ].join('\n'));
        }
        return withSqlEditorComment([
          `CREATE OR REPLACE FUNCTION ${quotePg(name)}()`,
          'RETURNS integer',
          'LANGUAGE sql',
          "AS 'SELECT 1;';",
        ].join('\n'));
      default:
        throw new Error(`Unsupported object type: ${input.objectType}`);
    }
  }

  if (dialect === 'SQLite') {
    switch (input.objectType) {
      case 'TABLE':
        return [
          'CREATE TABLE',
          `${name} (`,
          '  id INTEGER PRIMARY KEY AUTOINCREMENT',
          ');',
        ].join('\n');
      case 'VIEW':
        return withSqlEditorComment([
          `CREATE VIEW ${name} AS`,
          'SELECT 1 AS id;',
        ].join('\n'));
      default:
        throw new Error('SQLite supports creating tables and views only.');
    }
  }

  if (dialect === 'MySQL') {
    switch (input.objectType) {
      case 'TABLE':
        return [
          'CREATE TABLE',
          `${name} (`,
          '  id BIGINT AUTO_INCREMENT PRIMARY KEY',
          ');',
        ].join('\n');
      case 'VIEW':
        return withSqlEditorComment([
          `CREATE VIEW ${name} AS`,
          'SELECT 1 AS id;',
        ].join('\n'));
      case 'PROCEDURE':
        return withSqlEditorComment([
          `CREATE PROCEDURE ${name}()`,
          'BEGIN',
          '  SELECT 1;',
          'END',
        ].join('\n'));
      case 'FUNCTION':
        if (input.functionKind === 'TABLE_VALUED') {
          throw new Error('Table-valued functions are not supported for MySQL in this release.');
        }
        return withSqlEditorComment([
          `CREATE FUNCTION ${name}()`,
          'RETURNS INT',
          'DETERMINISTIC',
          'RETURN 1;',
        ].join('\n'));
      default:
        throw new Error(`Unsupported object type: ${input.objectType}`);
    }
  }

  if (dialect === 'SQL Server') {
    switch (input.objectType) {
      case 'TABLE':
        return [
          'CREATE TABLE',
          `${name} (`,
          '  id BIGINT IDENTITY(1,1) PRIMARY KEY',
          ');',
        ].join('\n');
      case 'VIEW':
        return withSqlEditorComment([
          `CREATE VIEW ${name} AS`,
          'SELECT CAST(1 AS BIGINT) AS id;',
        ].join('\n'));
      case 'PROCEDURE':
        return withSqlEditorComment([
          `CREATE PROCEDURE ${name}`,
          'AS',
          'BEGIN',
          '  SELECT 1;',
          'END',
        ].join('\n'));
      case 'FUNCTION':
        if (input.functionKind === 'TABLE_VALUED') {
          return withSqlEditorComment([
            `CREATE FUNCTION ${name}()`,
            'RETURNS TABLE',
            'AS',
            'RETURN (',
            '  SELECT CAST(1 AS BIGINT) AS id',
            ');',
          ].join('\n'));
        }
        return withSqlEditorComment([
          `CREATE FUNCTION ${name}()`,
          'RETURNS INT',
          'AS',
          'BEGIN',
          '  RETURN 1;',
          'END',
        ].join('\n'));
      default:
        throw new Error(`Unsupported object type: ${input.objectType}`);
    }
  }

  throw new Error(`Creating schema objects is not supported for ${dialect} yet.`);
};
