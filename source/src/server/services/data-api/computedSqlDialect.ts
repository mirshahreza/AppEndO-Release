/**
 * Computed-field SQL is stored in one canonical dialect (PostgreSQL).
 * Compile to the connected data-source dialect at query time so switching
 * Postgres ↔ SQL Server does not republish APIs or 500 the list page.
 */

const POSTGRES_DIALECTS = new Set(['postgres', 'postgresql']);

export const compileComputedSqlForDialect = (
  expression: string,
  dialect: string | null | undefined,
): string => {
  const normalized = (dialect ?? 'postgres').trim().toLowerCase();
  if (!normalized || POSTGRES_DIALECTS.has(normalized)) {
    return expression;
  }
  if (normalized !== 'mssql') {
    return expression;
  }

  return expression
    .replace(
      /STRING_AGG\(\s*([^,]+?)\s*,\s*'([^']*)'\s+(ORDER BY\s+[^)]+)\s*\)/gi,
      (_match, valueExpr: string, separator: string, orderBy: string) => (
        `STRING_AGG(${valueExpr}, '${separator}') WITHIN GROUP (${orderBy})`
      ),
    )
    .replace(/COUNT\(\*\)::int\b/gi, 'COUNT(*)')
    .replace(/CAST\(([\s\S]*?) AS TEXT\)/gi, (_match, inner: string) => (
      `CAST(${inner} AS NVARCHAR(1000))`
    ))
    .replace(/"([^"]+)"\."([^"]+)"/g, '[$1].[$2]');
};
