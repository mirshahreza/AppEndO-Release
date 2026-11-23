/**
 * Additive control-plane schema policy.
 *
 * `prisma db push --accept-data-loss` reconciles by dropping any table that is
 * not in the Prisma schema (domain/package tables, ETL maps, …). This module
 * filters `prisma migrate diff --script` output so the default sync never
 * applies those drops.
 *
 * SQL Server scripts wrap every step in BEGIN TRY / BEGIN TRAN … COMMIT TRAN /
 * END TRY / BEGIN CATCH. Drop steps must be removed without leaving that
 * envelope unclosed, empty, or full of stray semicolons.
 */
import { CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES } from '../../config/controlPlaneSchemaOwnership';

export const CONTROL_PLANE_SCHEMA_PROTECTED_TABLES_ENV = 'CONTROL_PLANE_SCHEMA_PROTECTED_TABLES';
export const CONTROL_PLANE_SCHEMA_ALLOW_DROP_TABLES_ENV = 'CONTROL_PLANE_SCHEMA_ALLOW_DROP_TABLES';

export type SchemaDiffBlock = {
  header: string;
  sql: string;
};

export type SkippedSchemaDiffStatement = {
  header: string;
  tables: string[];
  reason: string;
};

export type FilteredSchemaDiff = {
  appliedSql: string;
  skipped: SkippedSchemaDiffStatement[];
};

const SCHEMA_MODEL_BLOCK_RE = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
const SCHEMA_MAP_RE = /@@map\(\s*"([^"]+)"\s*\)/;
const DIFF_HEADER_RE = /^-- ([A-Z][A-Za-z]+)\s*$/;
const SQL_TABLE_REF_RE =
  /(?:\bTABLE\b|\bVIEW\b|\bON\b(?!\s+(?:DELETE|UPDATE)\b)|\bINTO\b|\bFROM\b)\s+(?:IF\s+EXISTS\s+)?((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w]*)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w]*))?)/gi;

const STANDALONE_DROP_HEADERS = new Set(['DropTable', 'DropView']);

/** Skip reason prefix for Sequelize / raw-SQL tables that are not Prisma models. */
export const MANAGED_OUTSIDE_PRISMA_REASON_PREFIX = 'managed outside Prisma';

const BEGIN_TRAN_LINE_RE = /^\s*BEGIN\s+(?:TRAN|TRANSACTION)\s*;?\s*$/i;
const COMMIT_TRAN_LINE_RE = /^\s*COMMIT\s+(?:TRAN|TRANSACTION)\s*;?\s*$/i;

export const parseCommaSeparatedTableNames = (raw: string | undefined): Set<string> => {
  const names = new Set<string>();
  for (const part of (raw ?? '').split(/[\s,]+/)) {
    const name = part.trim().toLowerCase();
    if (name) names.add(name);
  }
  return names;
};

export const listPrismaMappedTableNames = (schemaContent: string): Set<string> => {
  const tables = new Set<string>();
  for (const match of schemaContent.matchAll(SCHEMA_MODEL_BLOCK_RE)) {
    const modelName = match[1];
    const body = match[2] ?? '';
    const mapped = body.match(SCHEMA_MAP_RE)?.[1];
    tables.add((mapped ?? modelName).toLowerCase());
  }
  return tables;
};

export const splitPrismaMigrateDiffScript = (script: string): SchemaDiffBlock[] => {
  const blocks: SchemaDiffBlock[] = [];
  let current: SchemaDiffBlock | undefined;

  for (const line of script.replace(/\r\n/g, '\n').split('\n')) {
    const header = line.match(DIFF_HEADER_RE)?.[1];
    if (header) {
      if (current) blocks.push(current);
      current = { header, sql: `${line}\n` };
      continue;
    }
    if (!current) {
      if (!line.trim()) continue;
      current = { header: 'Preamble', sql: `${line}\n` };
      continue;
    }
    current.sql += `${line}\n`;
  }

  if (current) blocks.push(current);
  return blocks.filter((block) => block.sql.trim().length > 0);
};

export const normalizeSqlTableName = (raw: string): string => {
  const parts = [...raw.matchAll(/"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w]*)/g)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? match[4])
    .filter((part): part is string => Boolean(part));
  const last = parts[parts.length - 1] ?? raw.trim();
  return last.toLowerCase();
};

export const extractSqlTargetTables = (sql: string): string[] => {
  const tables: string[] = [];
  const seen = new Set<string>();
  for (const match of sql.matchAll(SQL_TABLE_REF_RE)) {
    const name = normalizeSqlTableName(match[1] ?? '');
    if (!name || seen.has(name)) continue;
    if (name === 'select') continue;
    seen.add(name);
    tables.push(name);
  }
  return tables;
};

const isPrismaOwnedTableName = (tableName: string, prismaTables: Set<string>): boolean => {
  const name = tableName.toLowerCase();
  if (prismaTables.has(name)) return true;
  // SQLite RedefineTables copies into `new_<table>` then renames.
  if (name.startsWith('new_') && prismaTables.has(name.slice(4))) return true;
  return false;
};

export type SqlServerMigrationEnvelope = {
  opening: string;
  body: string;
  closing: string;
};

const looksLikeSqlServerMigrationTrailer = (closing: string): boolean => (
  /COMMIT\s+(?:TRAN|TRANSACTION)/i.test(closing)
  && /END\s+TRY/i.test(closing)
  && /BEGIN\s+CATCH/i.test(closing)
  && /END\s+CATCH/i.test(closing)
);

/**
 * Separate Prisma's SQL Server migrate-diff envelope from the `-- Step` body.
 * The trailer is otherwise glued onto the last step, so skipping that step
 * deletes COMMIT / END TRY / BEGIN CATCH and leaves `BEGIN TRY` … `BEGIN TRAN;`.
 */
export const peelSqlServerMigrationEnvelope = (script: string): SqlServerMigrationEnvelope => {
  const normalized = script.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const commitIndexes: number[] = [];
  lines.forEach((line, index) => {
    if (COMMIT_TRAN_LINE_RE.test(line)) commitIndexes.push(index);
  });

  for (let cursor = commitIndexes.length - 1; cursor >= 0; cursor -= 1) {
    const index = commitIndexes[cursor] ?? -1;
    if (index < 0) continue;
    const closing = lines.slice(index).join('\n');
    const before = lines.slice(0, index).join('\n');
    if (!looksLikeSqlServerMigrationTrailer(closing) || !/BEGIN\s+TRY/i.test(before)) {
      continue;
    }
    const split = splitSqlServerOpening(before);
    if (!/BEGIN\s+TRY/i.test(split.opening)) continue;
    return { opening: split.opening, body: split.body, closing };
  }

  return { opening: '', body: normalized, closing: '' };
};

const splitSqlServerOpening = (beforeCommit: string): { opening: string; body: string } => {
  const lines = beforeCommit.split('\n');
  let beginTranIndex = -1;
  let beginTryIndex = -1;
  let firstHeader = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (firstHeader < 0 && DIFF_HEADER_RE.test(line)) firstHeader = index;
    if (firstHeader >= 0 && index >= firstHeader) break;
    if (/^\s*BEGIN\s+TRY\s*;?\s*$/i.test(line)) beginTryIndex = index;
    if (BEGIN_TRAN_LINE_RE.test(line)) beginTranIndex = index;
  }
  const cut = beginTranIndex >= 0 ? beginTranIndex : beginTryIndex;
  if (cut < 0) return { opening: '', body: beforeCommit };
  return {
    opening: lines.slice(0, cut + 1).join('\n'),
    body: lines.slice(cut + 1).join('\n'),
  };
};

type SqlScanMode = 'code' | 'line-comment' | 'block-comment' | 'string' | 'bracket';

const scanSql = (
  sql: string,
  onCode: (char: string, index: number) => void,
): void => {
  let mode: SqlScanMode = 'code';
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? '';
    const next = sql[index + 1] ?? '';
    if (mode === 'line-comment') {
      if (char === '\n') mode = 'code';
      continue;
    }
    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        mode = 'code';
        index += 1;
      }
      continue;
    }
    if (mode === 'string') {
      if (char === "'" && next === "'") {
        index += 1;
        continue;
      }
      if (char === "'") mode = 'code';
      continue;
    }
    if (mode === 'bracket') {
      if (char === ']' && next === ']') {
        index += 1;
        continue;
      }
      if (char === ']') mode = 'code';
      continue;
    }
    if (char === '-' && next === '-') {
      mode = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      mode = 'block-comment';
      index += 1;
      continue;
    }
    if (char === "'") {
      mode = 'string';
      continue;
    }
    if (char === '[') {
      mode = 'bracket';
      continue;
    }
    if (char === 'N' && next === "'") {
      mode = 'string';
      index += 1;
      continue;
    }
    onCode(char, index);
  }
};

/** Drop semicolons that do not terminate a real statement (stray `;` / `;;`). */
export const stripEmptySqlStatements = (sql: string): string => {
  let out = '';
  let segmentStart = 0;
  let segmentHasContent = false;
  const consider = (char: string, index: number): void => {
    if (char === ';') {
      if (segmentHasContent) out += sql.slice(segmentStart, index + 1);
      segmentStart = index + 1;
      segmentHasContent = false;
      return;
    }
    if (!/\s/.test(char)) segmentHasContent = true;
  };
  scanSql(sql, consider);
  out += sql.slice(segmentStart);
  return out;
};

export const countEmptySqlStatements = (sql: string): number => {
  let count = 0;
  let segmentHasContent = false;
  scanSql(sql, (char) => {
    if (char === ';') {
      if (!segmentHasContent) count += 1;
      segmentHasContent = false;
      return;
    }
    if (!/\s/.test(char)) segmentHasContent = true;
  });
  return count;
};

const sqlCodeWords = (sql: string): string[] => {
  const words: string[] = [];
  let buf = '';
  const flush = (): void => {
    if (!buf) return;
    words.push(buf.toUpperCase());
    buf = '';
  };
  scanSql(sql, (char) => {
    if (/[A-Za-z0-9_@#]/.test(char)) {
      buf += char;
      return;
    }
    flush();
  });
  flush();
  return words;
};

const meaningfulSql = (sql: string): boolean => sqlCodeWords(sql).length > 0;

/**
 * Structural check for a batch we are about to send to SQL Server (or SQLite).
 * Empty SQL is balanced. An unclosed BEGIN TRY / BEGIN TRAN is not.
 */
export const sqlBatchBalanceIssues = (sql: string): string[] => {
  if (!sql.trim()) return [];
  const words = sqlCodeWords(sql);
  const stack: string[] = [];
  const issues: string[] = [];
  const push = (kind: string): void => {
    stack.push(kind);
  };
  const pop = (expected: string, label: string): void => {
    if (stack[stack.length - 1] === expected) {
      stack.pop();
      return;
    }
    issues.push(`${label} without ${expected === 'TRY' ? 'BEGIN TRY' : expected === 'CATCH' ? 'BEGIN CATCH' : expected === 'TRAN' ? 'BEGIN TRAN' : 'BEGIN'}`);
  };

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = words[index + 1];
    if (word === 'BEGIN' && next === 'TRY') {
      push('TRY');
      index += 1;
      continue;
    }
    if (word === 'BEGIN' && next === 'CATCH') {
      push('CATCH');
      index += 1;
      continue;
    }
    if (word === 'BEGIN' && (next === 'TRAN' || next === 'TRANSACTION')) {
      push('TRAN');
      index += 1;
      continue;
    }
    if (word === 'BEGIN') {
      push('BLOCK');
      continue;
    }
    if (word === 'END' && next === 'TRY') {
      pop('TRY', 'END TRY');
      index += 1;
      continue;
    }
    if (word === 'END' && next === 'CATCH') {
      pop('CATCH', 'END CATCH');
      index += 1;
      continue;
    }
    if (word === 'END') {
      pop('BLOCK', 'END');
      continue;
    }
    if ((word === 'COMMIT' || word === 'ROLLBACK') && (next === 'TRAN' || next === 'TRANSACTION')) {
      if (stack[stack.length - 1] === 'TRAN') stack.pop();
      index += 1;
      continue;
    }
    if (word === 'COMMIT' || word === 'ROLLBACK') {
      if (stack[stack.length - 1] === 'TRAN') stack.pop();
    }
  }

  for (const open of stack) {
    if (open === 'TRY') issues.push('unclosed BEGIN TRY');
    else if (open === 'CATCH') issues.push('unclosed BEGIN CATCH');
    else if (open === 'TRAN') issues.push('unclosed BEGIN TRAN');
    else issues.push('unclosed BEGIN');
  }
  return issues;
};

const joinSqlServerEnvelope = (opening: string, body: string, closing: string): string => (
  `${opening.trim()}\n\n${body.trim()}\n\n${closing.trim()}\n`
);

export type FilterControlPlaneSchemaDiffOptions = {
  prismaTables: Iterable<string>;
  /** Extra names that must never be dropped (optional belt-and-suspenders). */
  protectedTables?: Iterable<string>;
  /** Explicit allowlist for standalone DropTable / DropView only. */
  allowDropTables?: Iterable<string>;
  /**
   * Tables owned outside Prisma. DropTable for these is preservation, not an
   * unexpected destructive diff. Defaults to the Sequelize feature tables.
   */
  managedTables?: Iterable<string>;
};

export const filterControlPlaneSchemaDiffSql = (
  script: string,
  options: FilterControlPlaneSchemaDiffOptions,
): FilteredSchemaDiff => {
  const prismaTables = new Set([...options.prismaTables].map((name) => name.toLowerCase()));
  const protectedTables = new Set(
    [...(options.protectedTables ?? [])].map((name) => name.toLowerCase()),
  );
  const allowDropTables = new Set(
    [...(options.allowDropTables ?? [])].map((name) => name.toLowerCase()),
  );
  const managedTables = new Set<string>([
    ...CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES,
    ...(options.managedTables ?? []),
  ].map((name) => name.toLowerCase()));

  const envelope = peelSqlServerMigrationEnvelope(script);
  const skipped: SkippedSchemaDiffStatement[] = [];
  const kept: string[] = [];

  for (const block of splitPrismaMigrateDiffScript(envelope.body)) {
    const tables = extractSqlTargetTables(block.sql);
    const skipReason = describeSkipReason(
      block,
      tables,
      prismaTables,
      protectedTables,
      allowDropTables,
      managedTables,
    );
    if (skipReason) {
      skipped.push({ header: block.header, tables, reason: skipReason });
      continue;
    }
    kept.push(block.sql.trimEnd());
  }

  const inner = stripEmptySqlStatements(kept.join('\n\n')).trim();
  if (!meaningfulSql(inner)) {
    return { appliedSql: '', skipped };
  }

  const wrapped = envelope.opening && envelope.closing
    ? joinSqlServerEnvelope(envelope.opening, inner, envelope.closing)
    : `${inner}\n`;
  const appliedSql = stripEmptySqlStatements(wrapped);
  return {
    appliedSql: appliedSql.endsWith('\n') ? appliedSql : `${appliedSql}\n`,
    skipped,
  };
};

export const formatSkippedSchemaDiffLog = (skipped: SkippedSchemaDiffStatement[]): string => {
  const managed = skipped.filter((item) => item.reason.startsWith(MANAGED_OUTSIDE_PRISMA_REASON_PREFIX));
  const rest = skipped.filter((item) => !item.reason.startsWith(MANAGED_OUTSIDE_PRISMA_REASON_PREFIX));
  const lines: string[] = [];
  if (managed.length > 0) {
    const names = [...new Set(managed.flatMap((item) => item.tables))].join(', ');
    lines.push(
      `Control-plane schema sync preserved ${managed.length} statement(s) for tables managed outside Prisma`
      + ` (Sequelize / boot markers, not DropTable drift)${names ? `: ${names}` : ''}.`,
    );
  }
  if (rest.length > 0) {
    const preview = rest
      .slice(0, 12)
      .map((item) => `  - ${item.header}${item.tables[0] ? ` ${item.tables[0]}` : ''} (${item.reason})`)
      .join('\n');
    lines.push(
      `Control-plane schema sync skipped ${rest.length} destructive statement(s) `
      + `that would drop or alter objects outside the Prisma schema:\n${preview}`,
    );
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
};

const describeSkipReason = (
  block: SchemaDiffBlock,
  tables: string[],
  prismaTables: Set<string>,
  protectedTables: Set<string>,
  allowDropTables: Set<string>,
  managedTables: Set<string>,
): string | undefined => {
  if (STANDALONE_DROP_HEADERS.has(block.header)) {
    const allowed = tables.length > 0 && tables.every((table) => allowDropTables.has(table));
    if (allowed) return undefined;
  }

  if (tables.length > 0 && tables.every((table) => managedTables.has(table))) {
    return `${MANAGED_OUTSIDE_PRISMA_REASON_PREFIX} (${tables.join(', ')} is not a Prisma model)`;
  }

  if (STANDALONE_DROP_HEADERS.has(block.header)) {
    const target = tables[0] ?? 'unknown';
    if (protectedTables.has(target)) {
      return `protected table ${target}`;
    }
    return `standalone ${block.header} of ${target} (preserve tables not being recreated as Prisma models)`;
  }

  const nonPrismaTarget = tables.find((table) => !isPrismaOwnedTableName(table, prismaTables));
  if (nonPrismaTarget) {
    return `statement targets ${nonPrismaTarget}, which is not a Prisma control-plane table`;
  }

  if (block.header === 'AddForeignKey') {
    // Before ON DELETE / ON UPDATE stopped matching as a table name, every AddForeignKey
    // step was skipped here. Keep that behaviour on the additive path so upgrading an
    // existing database never fails on rows that would violate a new constraint.
    return 'AddForeignKey is not applied on the additive sync path (existing rows may not satisfy it)';
  }

  if (block.header === 'AlterTable' && /\bDROP\s+COLUMN\b/i.test(block.sql)) {
    return 'DROP COLUMN is not applied on the additive sync path (preserves extra columns)';
  }

  return undefined;
};

export const readSchemaDiffTableNameListsFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
): { protectedTables: Set<string>; allowDropTables: Set<string> } => ({
  protectedTables: parseCommaSeparatedTableNames(env[CONTROL_PLANE_SCHEMA_PROTECTED_TABLES_ENV]),
  allowDropTables: parseCommaSeparatedTableNames(env[CONTROL_PLANE_SCHEMA_ALLOW_DROP_TABLES_ENV]),
});
