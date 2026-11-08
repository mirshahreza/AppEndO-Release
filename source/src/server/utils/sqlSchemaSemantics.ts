import type { SchemaRelationEdge } from '../../shared/api/contracts/data-sources/schemaRelations';

/**
 * Never fetch or sample row data from a column whose name matches this pattern
 * (case-insensitive substring). Shared by the SQL Console AI assistant and the
 * DB Enricher - one safety implementation, not two.
 */
export const SENSITIVE_COLUMN_PATTERN = /(password|passwd|secret|token|api[_-]?key|private[_-]?key|hash|salt|\bpin\b|ssn|national[_-]?code|credit|iban|account[_-]?number|mobile|phone|email|address|birth|salary|otp)/i;

/** A bare SQL identifier safe to interpolate directly (no quoting/escaping needed). */
const SAFE_BARE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Splits an identifier into lowercase word tokens (camelCase and snake_case aware). */
export const tokenizeIdentifier = (name: string): string[] => (
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean)
);

/**
 * A lookup table referenced by many different columns (a shared generic "base info"/"code
 * values" style table) can be large overall while the slice actually used by any one foreign
 * key stays tiny. So this scopes the sample to only the distinct values `edge.fromTable.
 * fromColumn` actually uses, instead of the whole `edge.toTable` - bounded by real usage,
 * not by total table size.
 */
export const buildScopedReferenceRowsSql = (dialectLabel: string, edge: SchemaRelationEdge, limit: number): string | null => {
  if (![edge.fromTable, edge.fromColumn, edge.toTable, edge.toColumn].every((id) => SAFE_BARE_IDENTIFIER.test(id))) {
    return null;
  }
  const usedValuesSubquery = `SELECT DISTINCT ${edge.fromColumn} FROM ${edge.fromTable} WHERE ${edge.fromColumn} IS NOT NULL`;
  if (dialectLabel === 'SQL Server') {
    return `SELECT TOP ${limit} * FROM ${edge.toTable} WHERE ${edge.toColumn} IN (${usedValuesSubquery})`;
  }
  return `SELECT * FROM ${edge.toTable} WHERE ${edge.toColumn} IN (${usedValuesSubquery}) LIMIT ${limit}`;
};

/**
 * Dialect-correct "most frequent distinct values of one column, with their row counts" for a
 * bare, already-validated column/table name. Ordered by real frequency (not arbitrary DB scan
 * order, which a plain `SELECT DISTINCT ... LIMIT n` leaves undefined) so a capped sample still
 * reflects the true distribution: the dominant categories always show up first, and a
 * high-cardinality column still yields a useful "most common values" sample instead of an
 * all-or-nothing cutoff.
 */
export const buildFrequentValuesSql = (dialectLabel: string, tableName: string, columnName: string, limit: number): string | null => {
  if (!SAFE_BARE_IDENTIFIER.test(tableName) || !SAFE_BARE_IDENTIFIER.test(columnName)) {
    return null;
  }
  if (dialectLabel === 'SQL Server') {
    return `SELECT TOP ${limit} ${columnName} AS value, COUNT(*) AS frequency FROM ${tableName} WHERE ${columnName} IS NOT NULL GROUP BY ${columnName} ORDER BY COUNT(*) DESC`;
  }
  return `SELECT ${columnName} AS value, COUNT(*) AS frequency FROM ${tableName} WHERE ${columnName} IS NOT NULL GROUP BY ${columnName} ORDER BY COUNT(*) DESC LIMIT ${limit}`;
};

/** Runs `fn` over `items` with at most `limit` in flight at once. */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
