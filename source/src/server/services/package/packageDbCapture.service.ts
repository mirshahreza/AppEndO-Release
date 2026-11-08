/**
 * Package Builder — capture schema SQL files and live seed rows (including BYTEA files).
 *
 * Seed capture is generic: FK-ordered related tables, parent/child walks, and binary
 * columns shipped as ZIP blobs referenced by `{{package_blob:...}}` tokens.
 */

import fs from 'fs';
import path from 'path';
import {
  blobFileEntryForKey,
  decodeBinaryColumnValue,
  fingerprintRowKey,
  isBinaryColumnType,
  packageBlobToken,
  sortRowsParentsFirst,
  sqlInList,
  topologicalSortTables,
  type CapturedPackageBlob,
  type TableFkEdge,
} from '../../../core/packages/packageDbBlobPayload';
import { sqlBooleanLiteralForSourceType, escapeSqlStringLiteral } from '../../../core/packages/packageDbScriptSql';
import {
  CMS_PACKAGE_CONTENT_CAPTURE,
  CMS_PACKAGE_VOCAB_CAPTURE,
  cmsSchemaInstallPath,
  cmsSchemaUninstallPath,
} from '../../../core/packages/cmsPackagePackRecipe';
import {
  mergePackageHidRewriteRows,
  type PackageHidRewriteRow,
} from '../../../core/packages/packageSeedHidRewrite';
import { getDataSourcesFromSettings } from '../../db/dataSourcesStore';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import type { EdgeDbQueryFn } from '../server-function.service';
import {
  listDataSourceObjectFields,
  listDataSourceObjectRelations,
  type SchemaFieldInfo,
} from '../../utils/dataSourceSchemaIntrospection';

const SCRIPTS_ROOT = path.resolve(process.cwd(), 'scripts');
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SUPPORTED_SEED_DIALECTS = new Set(['PostgreSQL', 'MySQL', 'SQL Server', 'SQLite']);
const MAX_SEED_ROWS = 100_000;
const DEFAULT_SEED_ROWS = 0;

export type CapturableSqlFile = {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
};

const normalizeScriptsRelativePath = (input: string): string | null => {
  const normalized = input.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return null;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) return null;
  return segments.join('/');
};

const collectSqlFilesRecursive = (
  directoryPath: string,
  relativeDirectory: string,
  output: CapturableSqlFile[],
): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      collectSqlFilesRecursive(absolutePath, relativePath, output);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.sql') continue;

    const stat = fs.statSync(absolutePath);
    output.push({
      path: relativePath.replace(/\\/g, '/'),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
};

export function listCapturableSqlFiles(): CapturableSqlFile[] {
  const files: CapturableSqlFile[] = [];
  collectSqlFilesRecursive(SCRIPTS_ROOT, '', files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function readCapturableSqlFile(
  relativePath: string,
): { ok: true; path: string; content: string } | { ok: false; error: string } {
  const normalized = normalizeScriptsRelativePath(relativePath);
  if (!normalized) {
    return { ok: false, error: 'Invalid SQL file path.' };
  }
  if (path.extname(normalized).toLowerCase() !== '.sql') {
    return { ok: false, error: 'Only .sql files can be loaded.' };
  }

  const absPath = path.resolve(SCRIPTS_ROOT, normalized);
  if (!absPath.startsWith(SCRIPTS_ROOT + path.sep) && absPath !== SCRIPTS_ROOT) {
    return { ok: false, error: 'Invalid SQL file path.' };
  }
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    return { ok: false, error: 'SQL file was not found.' };
  }

  return { ok: true, path: normalized, content: fs.readFileSync(absPath, 'utf8') };
}

export type CaptureSeedBlob = CapturedPackageBlob;

export type CaptureSeedInsertsInput = {
  dataSourceId: string;
  tableName: string;
  relatedTables?: string[];
  where?: string;
  orderBy?: string;
  limit?: number;
  includeBinary?: boolean;
  includeDescendants?: boolean;
  parentColumn?: string;
};

export type CaptureSeedInsertsResult = {
  installSql: string;
  uninstallSql: string;
  rowCount: number;
  columns: string[];
  tables: string[];
  blobs: CaptureSeedBlob[];
  hidRows: PackageHidRewriteRow[];
  warnings: string[];
};

export type CaptureCmsModuleInput = {
  dataSourceId: string;
  includeOptionalRecords?: boolean;
};

export type CaptureCmsModuleResult = {
  schemaInstallSql: string;
  schemaUninstallSql: string;
  vocabInstallSql: string;
  vocabUninstallSql: string;
  vocabHidRows: PackageHidRewriteRow[];
  contentInstallSql: string;
  contentUninstallSql: string;
  contentBlobs: CaptureSeedBlob[];
  vocabRowCount: number;
  contentRowCount: number;
  tables: string[];
  warnings: string[];
};

const quoteIdentifier = (sourceType: string, name: string): string => {
  if (sourceType === 'MySQL') return `\`${name}\``;
  if (sourceType === 'SQL Server') return `[${name}]`;
  return `"${name}"`;
};

const assertNoStatementSeparator = (value: string, label: string): void => {
  if (value.includes(';') || /--|\/\*/.test(value)) {
    throw new Error(`${label} must be a single expression — remove ";", "--" or "/*".`);
  }
};

const sqlLiteral = (value: unknown, dataType: string, sourceType: string): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return sqlBooleanLiteralForSourceType(value, sourceType);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (isBinaryColumnType(dataType)) return 'NULL';

  const lowerType = dataType.toLowerCase();
  if (typeof value === 'object') {
    const json = JSON.stringify(value).replace(/'/g, "''");
    return lowerType.includes('json') ? `'${json}'::jsonb` : `'${json}'`;
  }

  return escapeSqlStringLiteral(String(value), sourceType);
};

const parseTableList = (tableName: string, relatedTables: string[] | undefined): string[] => {
  const names = [tableName, ...(relatedTables ?? [])].map((name) => name.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const name of names) {
    if (!SAFE_IDENTIFIER.test(name)) {
      throw new Error(`Table name "${name}" is missing or invalid.`);
    }
    if (!unique.includes(name)) unique.push(name);
  }
  return unique;
};

const toFkEdges = (relations: SchemaRelationEdge[]): TableFkEdge[] => (
  relations.map((relation) => ({
    fromTable: relation.fromTable,
    fromColumn: relation.fromColumn,
    toTable: relation.toTable,
    toColumn: relation.toColumn,
  }))
);

const chunkList = <T>(values: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const buildSelectSql = (
  sourceType: string,
  quotedTable: string,
  selectColumns: string,
  whereClause: string | undefined,
  orderByClause: string | undefined,
  fetchLimit: number,
): string => {
  const selectSql = [
    `SELECT ${selectColumns} FROM ${quotedTable}`,
    whereClause ? `WHERE ${whereClause}` : '',
    orderByClause ? `ORDER BY ${orderByClause}` : '',
    sourceType === 'SQL Server' ? '' : `LIMIT ${fetchLimit}`,
  ].filter(Boolean).join(' ');
  return sourceType === 'SQL Server'
    ? selectSql.replace(/^SELECT /, `SELECT TOP ${fetchLimit} `)
    : selectSql;
};

const queryRows = async (
  edgeDbQuery: EdgeDbQueryFn,
  sql: string,
  context: { dataSourceId: string; database?: string },
): Promise<Array<Record<string, unknown>>> => {
  const result = await edgeDbQuery(sql, [], context);
  return Array.isArray(result.data) ? result.data as Array<Record<string, unknown>> : [];
};

export async function captureSeedInserts(
  deps: { edgeDbQuery: EdgeDbQueryFn; settingsPath: string },
  input: CaptureSeedInsertsInput,
): Promise<CaptureSeedInsertsResult> {
  const tableNames = parseTableList(input.tableName, input.relatedTables);
  const includeBinary = input.includeBinary !== false;
  const warnings: string[] = [];
  const blobs: CaptureSeedBlob[] = [];
  const hidRows: PackageHidRewriteRow[] = [];
  const blobEntries = new Set<string>();

  const sources = getDataSourcesFromSettings(deps.settingsPath);
  const source = sources.find((item) => item.id === input.dataSourceId);
  if (!source) {
    throw new Error('Data source not found.');
  }
  if (!SUPPORTED_SEED_DIALECTS.has(source.type)) {
    throw new Error(`Seed capture is not supported for data source type "${source.type}".`);
  }

  const context = { dataSourceId: source.id, database: source.database };
  const whereClause = input.where?.trim();
  if (whereClause) assertNoStatementSeparator(whereClause, 'WHERE clause');
  const orderByClause = input.orderBy?.trim();
  if (orderByClause) assertNoStatementSeparator(orderByClause, 'ORDER BY clause');
  const parentColumn = input.parentColumn?.trim() || 'parent_id';
  if (input.includeDescendants && !SAFE_IDENTIFIER.test(parentColumn)) {
    throw new Error('Parent column is missing or invalid.');
  }

  const requestedLimit = Math.trunc(input.limit ?? DEFAULT_SEED_ROWS);
  const fetchLimit = requestedLimit > 0
    ? Math.min(requestedLimit, MAX_SEED_ROWS)
    : MAX_SEED_ROWS + 1;

  const fieldsByTable = new Map<string, SchemaFieldInfo[]>();
  const relationEdges: TableFkEdge[] = [];
  for (const tableName of tableNames) {
    const fields = await listDataSourceObjectFields(
      deps.edgeDbQuery,
      source.type,
      'TABLE',
      tableName,
      context,
    );
    if (fields.length === 0) {
      throw new Error(`Table "${tableName}" was not found (or has no columns) on this data source.`);
    }
    fieldsByTable.set(tableName, fields);
    const snapshot = await listDataSourceObjectRelations(
      deps.edgeDbQuery,
      source.type,
      'TABLE',
      tableName,
      context,
    );
    relationEdges.push(...toFkEdges(snapshot.relations));
  }

  const orderedTables = topologicalSortTables(tableNames, relationEdges);
  const capturedKeys = new Map<string, unknown[]>();
  const installParts: string[] = [];
  const uninstallParts: string[] = [];
  const allColumns: string[] = [];
  let totalRows = 0;

  for (const tableName of orderedTables) {
    const fields = fieldsByTable.get(tableName) ?? [];
    const selectedFields = includeBinary
      ? fields
      : fields.filter((field) => !isBinaryColumnType(field.dataType));
    const primaryKeyFields = fields.filter((field) => field.isPrimaryKey);
    const quotedTable = quoteIdentifier(source.type, tableName);
    const selectColumns = selectedFields.map((field) => quoteIdentifier(source.type, field.name)).join(', ');
    const isRoot = tableName === tableNames[0];
    const incoming = relationEdges.filter((edge) => (
      edge.fromTable === tableName
      && edge.fromTable !== edge.toTable
      && capturedKeys.has(edge.toTable)
    ));

    let tableWhere = isRoot ? whereClause : undefined;
    if (!isRoot && incoming.length > 0) {
      const clauses = incoming.flatMap((edge) => {
        const parentKeys = capturedKeys.get(edge.toTable) ?? [];
        if (parentKeys.length === 0) return ['1 = 0'];
        return chunkList(parentKeys, 400).map((chunk) => (
          `${quoteIdentifier(source.type, edge.fromColumn)} IN ${sqlInList(chunk, (value) => sqlLiteral(value, 'text', source.type))}`
        ));
      });
      tableWhere = clauses.map((clause) => `(${clause})`).join(' OR ');
    } else if (!isRoot && incoming.length === 0) {
      warnings.push(`Table "${tableName}" has no foreign key to already captured tables; every matching row was included.`);
    }

    let rows = await queryRows(
      deps.edgeDbQuery,
      buildSelectSql(
        source.type,
        quotedTable,
        selectColumns,
        tableWhere,
        isRoot ? orderByClause : undefined,
        fetchLimit,
      ),
      context,
    );

    if (isRoot && input.includeDescendants && rows.length > 0) {
      const idField = primaryKeyFields[0]?.name ?? 'id';
      const seen = new Set(rows.map((row) => String(row[idField] ?? '')));
      let frontier = rows.map((row) => row[idField]).filter((value) => value !== null && value !== undefined);
      while (frontier.length > 0) {
        const childClauses = chunkList(frontier, 400).map((chunk) => (
          `${quoteIdentifier(source.type, parentColumn)} IN ${sqlInList(chunk, (value) => sqlLiteral(value, 'text', source.type))}`
        ));
        const childRows = await queryRows(
          deps.edgeDbQuery,
          buildSelectSql(
            source.type,
            quotedTable,
            selectColumns,
            childClauses.map((clause) => `(${clause})`).join(' OR '),
            undefined,
            fetchLimit,
          ),
          context,
        );
        const fresh = childRows.filter((row) => {
          const id = String(row[idField] ?? '');
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        rows = [...rows, ...fresh];
        frontier = fresh.map((row) => row[idField]);
        if (rows.length > MAX_SEED_ROWS) break;
      }
      rows = sortRowsParentsFirst(rows, idField, parentColumn);
    }

    if (rows.length > MAX_SEED_ROWS) {
      throw new Error(`Table "${tableName}" exceeded the ${MAX_SEED_ROWS} row capture safety cap. Narrow the WHERE clause.`);
    }
    if (requestedLimit > 0 && rows.length === requestedLimit) {
      warnings.push(`Table "${tableName}" hit the requested row limit (${requestedLimit}); additional rows were not captured.`);
    }

    const pkName = primaryKeyFields[0]?.name;
    if (pkName) {
      capturedKeys.set(tableName, rows.map((row) => row[pkName]));
    }
    if (tableName === 'base_info' && pkName) {
      const titleField = fields.find((field) => field.name === 'title');
      const parentField = fields.find((field) => field.name === 'parent_id');
      for (const row of rows) {
        hidRows.push({
          id: String(row[pkName] ?? ''),
          parentId: parentField && row[parentField.name] != null ? String(row[parentField.name]) : null,
          title: titleField ? String(row[titleField.name] ?? '') : '',
        });
      }
    }

    if (rows.length === 0) {
      installParts.push(`-- No rows matched for ${tableName}${tableWhere ? ` (WHERE ${tableWhere})` : ''}; nothing captured.`);
      continue;
    }

    const conflictTarget = primaryKeyFields.length > 0
      ? primaryKeyFields.map((field) => quoteIdentifier(source.type, field.name)).join(', ')
      : null;

    const insertLines = rows.map((row) => {
      const values = selectedFields.map((field) => {
        if (includeBinary && isBinaryColumnType(field.dataType)) {
          const bytes = decodeBinaryColumnValue(row[field.name]);
          if (!bytes || bytes.length === 0) {
            if (!field.nullable) {
              warnings.push(`Table "${tableName}" column "${field.name}" has an empty required binary value; INSERT will use NULL.`);
            }
            return 'NULL';
          }
          const key = Object.fromEntries(
            primaryKeyFields.map((pk) => [pk.name, String(row[pk.name] ?? '')]),
          );
          const entry = blobFileEntryForKey(tableName, field.name, fingerprintRowKey(key));
          if (!blobEntries.has(entry)) {
            blobEntries.add(entry);
            blobs.push({
              entry,
              table: tableName,
              column: field.name,
              key,
              contentBase64: bytes.toString('base64'),
              byteLength: bytes.length,
            });
          }
          return packageBlobToken(entry);
        }
        return sqlLiteral(row[field.name], field.dataType, source.type);
      }).join(', ');
      const conflictSuffix = source.type === 'PostgreSQL' && conflictTarget
        ? ` ON CONFLICT (${conflictTarget}) DO NOTHING`
        : '';
      return `INSERT INTO ${quotedTable} (${selectColumns}) VALUES (${values})${conflictSuffix};`;
    });

    installParts.push(
      `-- Captured ${rows.length} row(s) from ${tableName} on ${new Date().toISOString()}`,
      ...(tableWhere ? [`-- WHERE ${tableWhere}`] : []),
      ...insertLines,
    );

    if (primaryKeyFields.length === 1) {
      const pkField = primaryKeyFields[0]!;
      const pkValues = rows.map((row) => sqlLiteral(row[pkField.name], pkField.dataType, source.type)).join(', ');
      uninstallParts.unshift(
        `-- Removes exactly the ${rows.length} row(s) captured from ${tableName}`,
        `DELETE FROM ${quotedTable} WHERE ${quoteIdentifier(source.type, pkField.name)} IN (${pkValues});`,
      );
    } else {
      uninstallParts.unshift(
        `-- No single-column primary key detected for ${tableName} — review before shipping.`,
        `DELETE FROM ${quotedTable}${tableWhere ? ` WHERE ${tableWhere}` : ''};`,
      );
    }

    totalRows += rows.length;
    for (const field of selectedFields) {
      if (!allColumns.includes(field.name)) allColumns.push(field.name);
    }
  }

  if (totalRows === 0) {
    return {
      installSql: `${installParts.join('\n')}\n`,
      uninstallSql: '',
      rowCount: 0,
      columns: allColumns,
      tables: orderedTables,
      blobs: [],
      hidRows: [],
      warnings,
    };
  }

  return {
    installSql: `${installParts.join('\n')}\n`,
    uninstallSql: `${uninstallParts.join('\n')}\n`,
    rowCount: totalRows,
    columns: allColumns,
    tables: orderedTables,
    blobs,
    hidRows: mergePackageHidRewriteRows(hidRows),
    warnings,
  };
}

export async function captureCmsModule(
  deps: { edgeDbQuery: EdgeDbQueryFn; settingsPath: string },
  input: CaptureCmsModuleInput,
): Promise<CaptureCmsModuleResult> {
  const sources = getDataSourcesFromSettings(deps.settingsPath);
  const source = sources.find((item) => item.id === input.dataSourceId);
  if (!source) {
    throw new Error('Data source not found.');
  }

  const warnings: string[] = [];
  const schemaInstallPath = cmsSchemaInstallPath(source.type);
  const schemaUninstallPath = cmsSchemaUninstallPath(source.type);
  if (!schemaInstallPath) {
    warnings.push(`CMS schema SQL is not bundled for data source type "${source.type}". Capture seed data still ran.`);
  }

  const schemaInstall = schemaInstallPath ? readCapturableSqlFile(schemaInstallPath) : null;
  const schemaUninstall = schemaUninstallPath ? readCapturableSqlFile(schemaUninstallPath) : null;
  if (schemaInstall && !schemaInstall.ok) warnings.push(schemaInstall.error);
  if (schemaUninstall && !schemaUninstall.ok) warnings.push(schemaUninstall.error);

  const vocab = await captureSeedInserts(deps, {
    dataSourceId: input.dataSourceId,
    tableName: CMS_PACKAGE_VOCAB_CAPTURE.tableName,
    where: CMS_PACKAGE_VOCAB_CAPTURE.where,
    parentColumn: CMS_PACKAGE_VOCAB_CAPTURE.parentColumn,
    includeDescendants: CMS_PACKAGE_VOCAB_CAPTURE.includeDescendants,
    includeBinary: CMS_PACKAGE_VOCAB_CAPTURE.includeBinary,
    limit: 0,
  });
  warnings.push(...vocab.warnings);
  if (vocab.rowCount === 0) {
    warnings.push('No CMS Base Info root titled "CMS" was found. Required vocab was not captured.');
  }

  let contentInstallSql = '';
  let contentUninstallSql = '';
  let contentBlobs: CaptureSeedBlob[] = [];
  let contentRowCount = 0;
  const tables = [...vocab.tables];

  if (input.includeOptionalRecords !== false) {
    const content = await captureSeedInserts(deps, {
      dataSourceId: input.dataSourceId,
      tableName: CMS_PACKAGE_CONTENT_CAPTURE.tableName,
      relatedTables: [...CMS_PACKAGE_CONTENT_CAPTURE.relatedTables],
      parentColumn: CMS_PACKAGE_CONTENT_CAPTURE.parentColumn,
      includeDescendants: CMS_PACKAGE_CONTENT_CAPTURE.includeDescendants,
      includeBinary: CMS_PACKAGE_CONTENT_CAPTURE.includeBinary,
      limit: 0,
    });
    warnings.push(...content.warnings);
    contentInstallSql = content.installSql;
    contentUninstallSql = content.uninstallSql;
    contentBlobs = content.blobs;
    contentRowCount = content.rowCount;
    for (const tableName of content.tables) {
      if (!tables.includes(tableName)) tables.push(tableName);
    }
  }

  return {
    schemaInstallSql: schemaInstall?.ok ? schemaInstall.content : '',
    schemaUninstallSql: schemaUninstall?.ok ? schemaUninstall.content : '',
    vocabInstallSql: vocab.installSql,
    vocabUninstallSql: vocab.uninstallSql,
    vocabHidRows: vocab.hidRows,
    contentInstallSql,
    contentUninstallSql,
    contentBlobs,
    vocabRowCount: vocab.rowCount,
    contentRowCount,
    tables,
    warnings,
  };
}
