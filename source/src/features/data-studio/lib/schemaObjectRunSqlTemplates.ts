import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import type { DataStudioExplorerObjectKind } from '../types';

const quotePg = (name: string) => `"${name.replace(/"/g, '""')}"`;
const quoteMySql = (name: string) => `\`${name.replace(/`/g, '``')}\``;
const quoteSqlServer = (name: string) => `[${name.replace(/]/g, ']]')}]`;

const buildParamPlaceholders = (
  sourceType: string,
  fields: SchemaFieldInfo[],
): string => {
  if (fields.length === 0) {
    return '';
  }

  const dialect = sourceType.trim();
  return fields.map((_, index) => {
    if (dialect === 'PostgreSQL') {
      return `$${index + 1}`;
    }
    if (dialect === 'SQL Server') {
      return `@p${index + 1}`;
    }
    return '?';
  }).join(', ');
};

const qualifyName = (sourceType: string, objectName: string): string => {
  const dialect = sourceType.trim();
  if (dialect === 'PostgreSQL') {
    return quotePg(objectName);
  }
  if (dialect === 'MySQL') {
    return quoteMySql(objectName);
  }
  if (dialect === 'SQL Server') {
    return quoteSqlServer(objectName);
  }
  return objectName;
};

export const canRunSchemaObjectKind = (
  dataSourceType: string,
  objectKind: DataStudioExplorerObjectKind,
): boolean => {
  const dialect = dataSourceType.trim();
  if (objectKind === 'TABLE') {
    return false;
  }
  if (dialect === 'SQLite') {
    return objectKind === 'VIEW';
  }
  return true;
};

export const buildSchemaObjectRunSqlTemplate = (
  dataSourceType: string,
  objectKind: DataStudioExplorerObjectKind,
  objectName: string,
  fields: SchemaFieldInfo[] = [],
): string => {
  const name = qualifyName(dataSourceType, objectName);
  const dialect = dataSourceType.trim();
  const params = buildParamPlaceholders(dataSourceType, fields);
  const paramSuffix = params ? `(${params})` : '()';

  if (objectKind === 'VIEW') {
    if (dialect === 'SQL Server') {
      return `SELECT TOP 100 * FROM ${name}`;
    }
    return `SELECT * FROM ${name} LIMIT 100`;
  }

  if (objectKind === 'STORED_PROCEDURE') {
    if (dialect === 'SQL Server') {
      return params ? `EXEC ${name} ${params}` : `EXEC ${name}`;
    }
    return `CALL ${name}${paramSuffix}`;
  }

  if (objectKind === 'TABLE_VALUED_FUNCTION') {
    if (dialect === 'PostgreSQL') {
      return `SELECT * FROM ${name}${paramSuffix}`;
    }
    if (dialect === 'SQL Server') {
      return params ? `SELECT * FROM ${name}(${params})` : `SELECT * FROM ${name}()`;
    }
    return `SELECT * FROM ${name}${paramSuffix}`;
  }

  return `SELECT ${name}${paramSuffix} AS result`;
};
