export const isSqlServerDataSourceType = (sourceType: string): boolean => {
  const normalized = sourceType.trim().toLowerCase();
  return normalized.includes('sql server') || normalized === 'mssql' || normalized === 'sqlserver';
};

/** Quote a physical column name when the dialect treats it as reserved (e.g. SQL Server `file`). */
export const quoteEdgeSqlColumn = (column: string, sourceType: string): string => (
  isSqlServerDataSourceType(sourceType) ? `[${column}]` : column
);
