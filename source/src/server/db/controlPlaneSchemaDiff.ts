/**
 * Additive control-plane schema policy.
 *
 * `prisma db push --accept-data-loss` reconciles by dropping any table that is
 * not in the Prisma schema (domain/package tables, ETL maps, …). This module
 * filters `prisma migrate diff --script` output so the default sync never
 * applies those drops.
 */

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
  /(?:\bTABLE\b|\bVIEW\b|\bON\b|\bINTO\b|\bFROM\b)\s+(?:IF\s+EXISTS\s+)?((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w]*)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w]*))?)/gi;

const STANDALONE_DROP_HEADERS = new Set(['DropTable', 'DropView']);

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

export type FilterControlPlaneSchemaDiffOptions = {
  prismaTables: Iterable<string>;
  /** Extra names that must never be dropped (optional belt-and-suspenders). */
  protectedTables?: Iterable<string>;
  /** Explicit allowlist for standalone DropTable / DropView only. */
  allowDropTables?: Iterable<string>;
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

  const skipped: SkippedSchemaDiffStatement[] = [];
  const kept: string[] = [];

  for (const block of splitPrismaMigrateDiffScript(script)) {
    const tables = extractSqlTargetTables(block.sql);
    const skipReason = describeSkipReason(block, tables, prismaTables, protectedTables, allowDropTables);
    if (skipReason) {
      skipped.push({ header: block.header, tables, reason: skipReason });
      continue;
    }
    kept.push(block.sql.trimEnd());
  }

  const appliedSql = kept.join('\n\n').trim();
  return {
    appliedSql: appliedSql ? `${appliedSql}\n` : '',
    skipped,
  };
};

const describeSkipReason = (
  block: SchemaDiffBlock,
  tables: string[],
  prismaTables: Set<string>,
  protectedTables: Set<string>,
  allowDropTables: Set<string>,
): string | undefined => {
  if (STANDALONE_DROP_HEADERS.has(block.header)) {
    const allowed = tables.length > 0 && tables.every((table) => allowDropTables.has(table));
    if (allowed) return undefined;
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
