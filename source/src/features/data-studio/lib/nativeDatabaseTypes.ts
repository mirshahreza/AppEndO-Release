export type NativeDatabaseDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'oracle';

export const mapDataSourceTypeToNativeDialect = (
  type: string | null | undefined,
): NativeDatabaseDialect | null => {
  const normalized = type?.trim();
  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case 'PostgreSQL':
      return 'postgres';
    case 'MySQL':
      return 'mysql';
    case 'SQLite':
      return 'sqlite';
    case 'SQL Server':
      return 'mssql';
    case 'Oracle':
      return 'oracle';
    default:
      return null;
  }
};

const POSTGRES_NATIVE_TYPES = [
  'bigint',
  'bigserial',
  'boolean',
  'bytea',
  'character',
  'character varying',
  'date',
  'double precision',
  'integer',
  'interval',
  'json',
  'jsonb',
  'money',
  'numeric',
  'real',
  'serial',
  'smallint',
  'smallserial',
  'text',
  'time without time zone',
  'time with time zone',
  'timestamp without time zone',
  'timestamp with time zone',
  'uuid',
  'xml',
] as const;

const MYSQL_NATIVE_TYPES = [
  'bigint',
  'binary',
  'bit',
  'blob',
  'boolean',
  'char',
  'date',
  'datetime',
  'decimal',
  'double',
  'enum',
  'float',
  'int',
  'integer',
  'json',
  'longblob',
  'longtext',
  'mediumblob',
  'mediumint',
  'mediumtext',
  'set',
  'smallint',
  'text',
  'time',
  'timestamp',
  'tinyblob',
  'tinyint',
  'tinytext',
  'varbinary',
  'varchar',
  'year',
] as const;

const SQLITE_NATIVE_TYPES = [
  'blob',
  'integer',
  'numeric',
  'real',
  'text',
] as const;

const SQL_SERVER_NATIVE_TYPES = [
  'bigint',
  'binary',
  'bit',
  'char',
  'date',
  'datetime',
  'datetime2',
  'datetimeoffset',
  'decimal',
  'float',
  'image',
  'int',
  'json',
  'money',
  'nchar',
  'ntext',
  'numeric',
  'nvarchar',
  'real',
  'smalldatetime',
  'smallint',
  'smallmoney',
  'text',
  'time',
  'tinyint',
  'uniqueidentifier',
  'varbinary',
  'varchar',
  'xml',
] as const;

const ORACLE_NATIVE_TYPES = [
  'binary_double',
  'binary_float',
  'blob',
  'char',
  'clob',
  'date',
  'float',
  'interval day to second',
  'interval year to month',
  'long',
  'long raw',
  'nchar',
  'nclob',
  'number',
  'nvarchar2',
  'raw',
  'rowid',
  'timestamp',
  'timestamp with local time zone',
  'timestamp with time zone',
  'urowid',
  'varchar2',
] as const;

export const NATIVE_DATABASE_TYPES: Record<NativeDatabaseDialect, readonly string[]> = {
  postgres: POSTGRES_NATIVE_TYPES,
  mysql: MYSQL_NATIVE_TYPES,
  sqlite: SQLITE_NATIVE_TYPES,
  mssql: SQL_SERVER_NATIVE_TYPES,
  oracle: ORACLE_NATIVE_TYPES,
};

export const resolveNativeTypeOptions = (
  dialect: NativeDatabaseDialect | null,
  discoveredTypes: string[] = [],
  currentValue?: string,
): string[] => {
  const catalog = dialect ? [...NATIVE_DATABASE_TYPES[dialect]] : [];
  const merged = new Set<string>([
    ...catalog,
    ...discoveredTypes.filter(Boolean),
    ...(currentValue ? [currentValue] : []),
  ]);

  return [...merged].sort((left, right) => left.localeCompare(right));
};
