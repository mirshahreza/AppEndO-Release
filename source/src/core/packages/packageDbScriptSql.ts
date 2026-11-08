import { dialectFamilyFromDataSourceType, type SqlDialectFamily } from './packageDbBlobPayload';

export function sqlBooleanLiteral(value: boolean, dialect: SqlDialectFamily): string {
  if (dialect === 'postgres') return value ? 'TRUE' : 'FALSE';
  return value ? '1' : '0';
}

export function sqlBooleanLiteralForSourceType(value: boolean, sourceType: string): string {
  return sqlBooleanLiteral(value, dialectFamilyFromDataSourceType(sourceType));
}

/** Split SSMS `GO` batch separators. A file without GO is a single batch. */
export function splitSqlGoBatches(sql: string): string[] {
  const batches: string[] = [];
  let current: string[] = [];
  for (const line of sql.split(/\r?\n/)) {
    if (/^\s*GO\s*$/i.test(line)) {
      const batch = current.join('\n').trim();
      if (batch) batches.push(batch);
      current = [];
      continue;
    }
    current.push(line);
  }
  const last = current.join('\n').trim();
  if (last) batches.push(last);
  return batches.length > 0 ? batches : [];
}

/**
 * Rewrite unquoted TRUE/FALSE for dialects that do not accept those keywords
 * (SQL Server treats them as column names). Leaves quoted strings unchanged.
 */
export function rewriteUnquotedBooleanKeywords(sql: string, dialect: SqlDialectFamily): string {
  if (dialect === 'postgres') return sql;
  let out = '';
  let index = 0;
  let inSingle = false;
  while (index < sql.length) {
    const char = sql[index]!;
    if (inSingle) {
      out += char;
      if (char === "'" && sql[index + 1] === "'") {
        out += sql[index + 1];
        index += 2;
        continue;
      }
      if (char === "'") inSingle = false;
      index += 1;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      out += char;
      index += 1;
      continue;
    }
    const prev = index === 0 ? '' : sql[index - 1]!;
    const isBoundary = (ch: string | undefined) => !ch || !/[A-Za-z0-9_]/.test(ch);
    if (sql.slice(index, index + 4).toUpperCase() === 'TRUE' && isBoundary(prev) && isBoundary(sql[index + 4])) {
      out += '1';
      index += 4;
      continue;
    }
    if (sql.slice(index, index + 5).toUpperCase() === 'FALSE' && isBoundary(prev) && isBoundary(sql[index + 5])) {
      out += '0';
      index += 5;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

const INSERT_IDENTITY_HEAD = /INSERT INTO (?:\[([^\]]+)\]|dbo\.([A-Za-z0-9_]+)|([A-Za-z0-9_]+))\s*\(([^)]*)\)/i;
const IDENTITY_INSERT_ARTIFACT_RE = /\r?\nSET IDENTITY_INSERT \[[^\]]+\] (?:ON|OFF);\r?\n?/gi;

function quotedSqlServerTable(table: string): string {
  return `[${table.replace(/]/g, '')}]`;
}

/** Previous line-based wrapping leaked SET IDENTITY_INSERT into captured markdown bodies. */
export function stripAccidentalIdentityInsertArtifacts(value: string): string {
  return value.replace(IDENTITY_INSERT_ARTIFACT_RE, '\n');
}

/**
 * Quote a string for INSERT values. SQL Server stays on one line (CHAR(10)) so
 * IDENTITY_INSERT wrapping cannot inject statements into markdown bodies.
 */
export function escapeSqlStringLiteral(value: string, sourceType: string): string {
  const cleaned = stripAccidentalIdentityInsertArtifacts(value);
  const dialect = dialectFamilyFromDataSourceType(sourceType);
  if (dialect === 'sqlserver') {
    return cleaned
      .split(/\r\n|\n|\r/)
      .map((part) => `N'${part.replace(/'/g, "''")}'`)
      .join(' + CHAR(10) + ');
  }
  return `'${cleaned.replace(/'/g, "''")}'`;
}

function splitSqlStatementsRespectingQuotes(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]!;
    if (inSingle) {
      current += char;
      if (char === "'" && sql[index + 1] === "'") {
        current += sql[index + 1]!;
        index += 1;
        continue;
      }
      if (char === "'") inSingle = false;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      current += char;
      continue;
    }
    if (char === ';') {
      current += char;
      statements.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current);
  return statements;
}

/**
 * SQL Server rejects explicit identity values unless IDENTITY_INSERT is on
 * for that table in the same batch. Wraps consecutive INSERT … ([id], …)
 * statements only for tables in `identityTables` (from sys.identity_columns).
 * Quote-aware: markdown newlines inside literals are not statement boundaries.
 * No-ops when the script already has a real SET IDENTITY_INSERT statement.
 */
export function wrapSqlServerIdentityInserts(
  sql: string,
  identityTables: ReadonlySet<string>,
): string {
  if (identityTables.size === 0) return sql;

  const statements = splitSqlStatementsRespectingQuotes(sql);
  if (statements.some((statement) => /^\s*SET\s+IDENTITY_INSERT\b/i.test(statement))) {
    return sql;
  }

  const identity = new Set([...identityTables].map((name) => name.trim().toLowerCase()));
  const out: string[] = [];
  let openTable: string | null = null;

  const close = () => {
    if (!openTable) return;
    out.push(`SET IDENTITY_INSERT ${quotedSqlServerTable(openTable)} OFF;`);
    openTable = null;
  };

  for (const statement of statements) {
    const match = statement.match(INSERT_IDENTITY_HEAD);
    const table = (match?.[1] || match?.[2] || match?.[3] || '').trim();
    const columns = match?.[4] || '';
    const hasIdColumn = /(^|,)\s*\[id\]\s*(,|$)/i.test(columns) || /(^|,)\s*id\s*(,|$)/i.test(columns);
    const isIdentityInsert = Boolean(table && hasIdColumn && identity.has(table.toLowerCase()));
    if (!isIdentityInsert) {
      close();
      out.push(statement.trimEnd());
      continue;
    }
    if (openTable !== table) {
      close();
      out.push(`SET IDENTITY_INSERT ${quotedSqlServerTable(table)} ON;`);
      openTable = table;
    }
    out.push(statement.trimEnd());
  }
  close();
  return out.join('\n');
}

