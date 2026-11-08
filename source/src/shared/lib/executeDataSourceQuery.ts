export const EXECUTE_DATA_SOURCE_QUERY_MAX_ROWS = 200;
export const EXECUTE_DATA_SOURCE_QUERY_MAX_BYTES = 512_000;

export const stripSqlComments = (sql: string): string => (
  sql
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
);

/** Inner statement after a leading EXPLAIN / EXPLAIN ANALYZE prefix, or null. */
export const unwrapLeadingExplainSql = (sql: string): string | null => {
  const match = stripSqlComments(sql).trim().match(/^explain\s+(?:analyze\s+)?([\s\S]+)$/i);
  if (!match) {
    return null;
  }
  const inner = match[1].replace(/;\s*$/, '').trim();
  return inner.length > 0 ? inner : null;
};

/** True when a SQL Server result looks like SET SHOWPLAN_ALL / XML output, not query rows. */
export const sqlServerRowsLookLikeShowPlan = (rows: Record<string, unknown>[]): boolean => {
  const first = rows[0];
  if (!first) {
    return true;
  }
  const keys = Object.keys(first).map((key) => key.toLowerCase());
  return keys.includes('stmttext')
    || keys.includes('physicalop')
    || keys.some((key) => key.includes('showplan'));
};

/** DDL/permission statements - never allowed through this endpoint, in any mode. */
const FORBIDDEN_DDL_PATTERN = /\b(drop|alter|truncate|create|replace|grant|revoke|attach|detach)\b/i;
/** Read-only mode also blocks DML anywhere in the statement (defends against e.g. a data-modifying CTE smuggled under a leading WITH/SELECT). */
const FORBIDDEN_EXECUTE_SQL_PATTERN = /\b(insert|update|delete|merge|drop|alter|truncate|create|replace|grant|revoke|attach|detach)\b/i;

const ALLOWED_EXECUTE_SQL_START = /^(select|with|pragma|call|exec|execute|explain)\b/i;
const ALLOWED_EXECUTE_SQL_START_WITH_WRITE = /^(select|with|pragma|call|exec|execute|explain|insert|update|delete|merge)\b/i;

export const validateExecuteDataSourceSql = (
  sql: string,
  options?: { allowWrite?: boolean },
): { ok: true } | { ok: false; reason: string } => {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { ok: false, reason: 'SQL is empty.' };
  }

  const allowWrite = options?.allowWrite ?? false;
  const withoutComments = stripSqlComments(trimmed);
  if (allowWrite) {
    if (FORBIDDEN_DDL_PATTERN.test(withoutComments)) {
      return { ok: false, reason: 'Schema-changing (DDL) statements are not allowed.' };
    }
  } else if (FORBIDDEN_EXECUTE_SQL_PATTERN.test(withoutComments)) {
    return { ok: false, reason: 'Only read or routine invocation SQL is allowed.' };
  }

  const normalized = withoutComments.trim();
  const allowedStart = allowWrite ? ALLOWED_EXECUTE_SQL_START_WITH_WRITE : ALLOWED_EXECUTE_SQL_START;
  if (!allowedStart.test(normalized)) {
    return {
      ok: false,
      reason: allowWrite
        ? 'Query must start with SELECT, WITH, PRAGMA, CALL, EXEC, EXPLAIN, INSERT, UPDATE, DELETE, or MERGE.'
        : 'Query must start with SELECT, WITH, PRAGMA, CALL, EXEC, or EXPLAIN.',
    };
  }

  const withoutTrailingSemicolon = normalized.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    return { ok: false, reason: 'Multiple SQL statements are not allowed.' };
  }

  return { ok: true };
};

export const truncateDataSourceQueryResult = (
  rows: unknown[],
): { rows: unknown[]; truncated: boolean } => {
  const limited = rows.slice(0, EXECUTE_DATA_SOURCE_QUERY_MAX_ROWS);
  let serialized = JSON.stringify(limited);
  let truncated = limited.length < rows.length;

  while (serialized.length > EXECUTE_DATA_SOURCE_QUERY_MAX_BYTES && limited.length > 1) {
    limited.pop();
    serialized = JSON.stringify(limited);
    truncated = true;
  }

  return { rows: limited, truncated };
};
