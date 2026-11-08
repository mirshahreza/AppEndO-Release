import type { EdgeDbQueryFn } from '../services/server-function.service';
import type { SchemaObjectListItem } from '../../shared/api/contracts/data-sources/schemaObjects';
import {
  extractSchemaObjectDefinitionRow,
  normalizeSchemaObjectDefinition,
} from '../../shared/lib/schemaObjectDefinition';
import type { SchemaRelationEdge, SchemaRelationsSnapshot } from '../../shared/api/contracts/data-sources/schemaRelations';
import type {
  SchemaObjectDependencies,
  SchemaObjectDependencyItem,
  SchemaObjectDependencyKind,
} from '../../shared/api/contracts/data-sources/schemaObjectDependencies';

export type SchemaObjectType = 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION';

export type SchemaFunctionKind = 'SCALAR' | 'TABLE_VALUED';

const ROUTINE_OBJECT_TYPES = new Set<SchemaObjectType>(['PROCEDURE', 'FUNCTION']);

export type SchemaFieldType = 'string' | 'number' | 'integer' | 'boolean';

export type SchemaFieldInfo = {
  name: string;
  dataType: string;
  suggestedFieldType: SchemaFieldType;
  nullable: boolean;
  isPrimaryKey: boolean;
};

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const assertSafeIdentifier = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || !SAFE_IDENTIFIER.test(normalized)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return normalized;
};

const mapDatabaseTypeToFieldType = (rawType: string): SchemaFieldType => {
  const normalized = rawType.trim().toLowerCase();

  if (
    normalized.includes('bool')
    || normalized === 'bit'
  ) {
    return 'boolean';
  }

  if (
    normalized.includes('int')
    || normalized === 'serial'
    || normalized === 'bigserial'
    || normalized === 'smallserial'
  ) {
    return 'integer';
  }

  if (
    normalized.includes('decimal')
    || normalized.includes('numeric')
    || normalized.includes('float')
    || normalized.includes('double')
    || normalized.includes('real')
    || normalized.includes('money')
  ) {
    return 'number';
  }

  return 'string';
};

const extractString = (row: unknown, keys: string[]): string | null => {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const extractBooleanish = (row: unknown, keys: string[]): boolean => {
  if (!row || typeof row !== 'object') {
    return true;
  }
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (candidate === true || candidate === 1 || candidate === '1') {
      return false;
    }
    if (candidate === false || candidate === 0 || candidate === '0') {
      return true;
    }
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toUpperCase();
      if (normalized === 'NO' || normalized === 'FALSE') {
        return false;
      }
      if (normalized === 'YES' || normalized === 'TRUE') {
        return true;
      }
    }
  }
  return true;
};

const extractIsPrimaryKey = (row: unknown): boolean => {
  if (!row || typeof row !== 'object') {
    return false;
  }

  const record = row as Record<string, unknown>;
  for (const key of ['is_primary_key', 'IS_PRIMARY_KEY', 'isPrimaryKey']) {
    const candidate = record[key];
    if (candidate === true || candidate === 1 || candidate === '1') {
      return true;
    }
  }

  const pk = record.pk ?? record.PK;
  if (typeof pk === 'number' && pk > 0) {
    return true;
  }
  if (typeof pk === 'string' && Number(pk) > 0) {
    return true;
  }

  const columnKey = record.column_key ?? record.COLUMN_KEY;
  if (typeof columnKey === 'string' && columnKey.trim().toUpperCase() === 'PRI') {
    return true;
  }

  return false;
};

const normalizeFieldRows = (rows: unknown[]): SchemaFieldInfo[] => {
  const fields: SchemaFieldInfo[] = [];

  for (const row of rows) {
    const name = extractString(row, ['name', 'NAME', 'column_name', 'COLUMN_NAME', 'parameter_name', 'PARAMETER_NAME']);
    if (!name) {
      continue;
    }

    const dataType = extractString(row, ['data_type', 'DATA_TYPE', 'udt_name', 'UDT_NAME', 'type', 'TYPE'])
      ?? 'string';
    const nullable = extractBooleanish(row, ['is_nullable', 'IS_NULLABLE', 'notnull', 'NOTNULL']);

    fields.push({
      name,
      dataType,
      suggestedFieldType: mapDatabaseTypeToFieldType(dataType),
      nullable,
      isPrimaryKey: extractIsPrimaryKey(row),
    });
  }

  // Preserve driver/SQL order (ordinal_position / PRAGMA cid). Do not sort by name —
  // Sync/import must keep physical column order (creation / table definition order).
  const unique = new Map<string, SchemaFieldInfo>();
  for (const field of fields) {
    if (!unique.has(field.name)) {
      unique.set(field.name, field);
    }
  }

  return Array.from(unique.values());
};

const buildObjectFieldsSql = (
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
): { sql: string; params: unknown[] } | null => {
  const normalizedType = sourceType.trim();
  const safeObjectName = assertSafeIdentifier(objectName, 'objectName');

  if (normalizedType === 'SQLite') {
    if (ROUTINE_OBJECT_TYPES.has(objectType)) {
      return null;
    }
    return {
      sql: `PRAGMA table_info(${safeObjectName})`,
      params: [],
    };
  }

  if (normalizedType === 'PostgreSQL') {
    if (ROUTINE_OBJECT_TYPES.has(objectType)) {
      return {
        sql: `SELECT p.parameter_name AS name, p.data_type, p.udt_name, 'YES' AS is_nullable
              FROM information_schema.parameters p
              INNER JOIN information_schema.routines r ON p.specific_name = r.specific_name
              WHERE r.routine_schema = 'public'
                AND r.routine_name = CAST(? AS text)
                AND r.routine_type = CAST(? AS text)
                AND p.parameter_mode IN ('IN', 'INOUT')
              ORDER BY p.ordinal_position`,
        params: [safeObjectName, objectType],
      };
    }

    return {
      sql: `SELECT c.column_name AS name, c.data_type, c.udt_name, c.is_nullable,
                   CASE WHEN EXISTS (
                     SELECT 1
                     FROM information_schema.table_constraints tc
                     INNER JOIN information_schema.key_column_usage kcu
                       ON tc.constraint_schema = kcu.constraint_schema
                      AND tc.constraint_name = kcu.constraint_name
                     WHERE tc.constraint_type = 'PRIMARY KEY'
                       AND tc.table_schema = c.table_schema
                       AND tc.table_name = c.table_name
                       AND kcu.column_name = c.column_name
                   ) THEN 1 ELSE 0 END AS is_primary_key
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = CAST(? AS text)
            ORDER BY c.ordinal_position`,
      params: [safeObjectName],
    };
  }

  if (normalizedType === 'MySQL') {
    if (ROUTINE_OBJECT_TYPES.has(objectType)) {
      return {
        sql: `SELECT PARAMETER_NAME AS name, DATA_TYPE AS data_type, 'YES' AS is_nullable
              FROM information_schema.PARAMETERS
              WHERE SPECIFIC_SCHEMA = DATABASE()
                AND SPECIFIC_NAME = ?
                AND PARAMETER_MODE = 'IN'
              ORDER BY ORDINAL_POSITION`,
        params: [safeObjectName],
      };
    }

    return {
      sql: `SELECT COLUMN_NAME AS name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable,
                   CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END AS is_primary_key
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION`,
      params: [safeObjectName],
    };
  }

  if (normalizedType === 'SQL Server') {
    if (ROUTINE_OBJECT_TYPES.has(objectType)) {
      return {
        sql: `SELECT PARAMETER_NAME AS name, DATA_TYPE AS data_type, 'YES' AS is_nullable
              FROM INFORMATION_SCHEMA.PARAMETERS
              WHERE SPECIFIC_NAME = ?
                AND PARAMETER_MODE = 'IN'
              ORDER BY ORDINAL_POSITION`,
        params: [safeObjectName],
      };
    }

    return {
      sql: `SELECT c.COLUMN_NAME AS name, c.DATA_TYPE AS data_type, c.IS_NULLABLE AS is_nullable,
                   CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
              SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME
              FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
              INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
               AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
              WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            ) pk ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
            WHERE c.TABLE_NAME = ?
            ORDER BY c.ORDINAL_POSITION`,
      params: [safeObjectName],
    };
  }

  return null;
};

const extractName = (row: unknown): string | null => {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const record = row as Record<string, unknown>;
  const candidate = record.name
    ?? record.NAME
    ?? record.table_name
    ?? record.TABLE_NAME
    ?? record.routine_name
    ?? record.ROUTINE_NAME
    ?? record.object_name
    ?? record.OBJECT_NAME;

  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }
  return candidate.trim();
};

const buildIntrospectionSql = (
  sourceType: string,
  objectType: SchemaObjectType,
  functionKind?: SchemaFunctionKind,
): string | null => {
  const normalizedType = sourceType.trim();

  if (normalizedType === 'SQLite') {
    if (objectType === 'TABLE') {
      return `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`;
    }
    if (objectType === 'VIEW') {
      return `SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name`;
    }
    if (objectType === 'FUNCTION') {
      return null;
    }
    return null;
  }

  if (normalizedType === 'PostgreSQL') {
    if (objectType === 'TABLE') {
      return `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
    }
    if (objectType === 'VIEW') {
      return `SELECT table_name AS name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name`;
    }
    if (objectType === 'FUNCTION') {
      if (functionKind === 'SCALAR') {
        return `SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' AND NOT p.proretset ORDER BY p.proname`;
      }
      if (functionKind === 'TABLE_VALUED') {
        return `SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proretset ORDER BY p.proname`;
      }
      return `SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY routine_name`;
    }
    return `SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE' ORDER BY routine_name`;
  }

  if (normalizedType === 'MySQL') {
    if (objectType === 'TABLE') {
      return `SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME`;
    }
    if (objectType === 'VIEW') {
      return `SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'VIEW' ORDER BY TABLE_NAME`;
    }
    if (objectType === 'FUNCTION') {
      return `SELECT ROUTINE_NAME AS name FROM information_schema.routines WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'FUNCTION' ORDER BY ROUTINE_NAME`;
    }
    return `SELECT ROUTINE_NAME AS name FROM information_schema.routines WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME`;
  }

  if (normalizedType === 'SQL Server') {
    if (objectType === 'TABLE') {
      return `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`;
    }
    if (objectType === 'VIEW') {
      return `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_NAME`;
    }
    if (objectType === 'FUNCTION') {
      if (functionKind === 'SCALAR') {
        return `SELECT o.name AS name FROM sys.objects o WHERE o.type IN ('FN', 'FS') AND o.is_ms_shipped = 0 ORDER BY o.name`;
      }
      if (functionKind === 'TABLE_VALUED') {
        return `SELECT o.name AS name FROM sys.objects o WHERE o.type IN ('IF', 'TF') AND o.is_ms_shipped = 0 ORDER BY o.name`;
      }
      return `SELECT ROUTINE_NAME AS name FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'FUNCTION' ORDER BY ROUTINE_NAME`;
    }
    return `SELECT ROUTINE_NAME AS name FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME`;
  }

  return null;
};

export async function listDataSourceSchemaObjects(
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  objectType: SchemaObjectType,
  context: { dataSourceId: string; database?: string; functionKind?: SchemaFunctionKind },
): Promise<string[]> {
  const sql = buildIntrospectionSql(sourceType, objectType, context.functionKind);
  if (!sql) {
    return [];
  }

  const result = await dbQuery(sql, [], context);
  const names = result.data
    .map(extractName)
    .filter((name): name is string => Boolean(name));

  return Array.from(new Set(names)).sort((left, right) => left.localeCompare(right));
}

const resolvePrimaryKeyFromFields = (fields: SchemaFieldInfo[]): string | string[] | null => {
  const primaryKeys = fields.filter((field) => field.isPrimaryKey).map((field) => field.name);
  if (primaryKeys.length === 0) {
    return null;
  }
  if (primaryKeys.length === 1) {
    return primaryKeys[0];
  }
  return primaryKeys;
};

const SUMMARY_FIELD_CHUNK_SIZE = 12;


export async function listDataSourceObjectSummaries(
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  objectType: SchemaObjectType,
  context: { dataSourceId: string; database?: string; functionKind?: SchemaFunctionKind },
): Promise<SchemaObjectListItem[]> {
  const names = await listDataSourceSchemaObjects(dbQuery, sourceType, objectType, context);
  if (names.length === 0) {
    return [];
  }

  const summaries: SchemaObjectListItem[] = [];

  for (let index = 0; index < names.length; index += SUMMARY_FIELD_CHUNK_SIZE) {
    const chunk = names.slice(index, index + SUMMARY_FIELD_CHUNK_SIZE);
    const chunkSummaries = await Promise.all(chunk.map(async (name) => {
      try {
        const fields = await listDataSourceObjectFields(
          dbQuery,
          sourceType,
          objectType,
          name,
          context,
        );

        return {
          name,
          columnCount: fields.length,
          primaryKey: resolvePrimaryKeyFromFields(fields),
        };
      } catch {
        return {
          name,
          columnCount: 0,
          primaryKey: null,
        };
      }
    }));
    summaries.push(...chunkSummaries);
  }

  return summaries.sort((left, right) => left.name.localeCompare(right.name));
}

export async function listDataSourceObjectFields(
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
  context: { dataSourceId: string; database?: string },
): Promise<SchemaFieldInfo[]> {
  const query = buildObjectFieldsSql(sourceType, objectType, objectName);
  if (!query) {
    return [];
  }

  const result = await dbQuery(query.sql, query.params, context);
  return normalizeFieldRows(Array.isArray(result.data) ? result.data : []);
}

const normalizeReferentialAction = (value: string | null | undefined): string | undefined => {
  if (!value?.trim()) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase().replace(/_/g, ' ');
  if (
    normalized === 'NO ACTION'
    || normalized === 'RESTRICT'
    || normalized === 'CASCADE'
    || normalized === 'SET NULL'
    || normalized === 'SET DEFAULT'
  ) {
    return normalized;
  }
  return value.trim();
};

const normalizeRelationRows = (rows: unknown[]): SchemaRelationEdge[] => {
  const relations: SchemaRelationEdge[] = [];

  for (const row of rows) {
    const fromTable = extractString(row, ['from_table', 'FROM_TABLE', 'fromTable']);
    const fromColumn = extractString(row, ['from_column', 'FROM_COLUMN', 'fromColumn', 'from']);
    const toTable = extractString(row, ['to_table', 'TO_TABLE', 'toTable', 'table']);
    const toColumn = extractString(row, ['to_column', 'TO_COLUMN', 'toColumn', 'to']);
    if (!fromTable || !fromColumn || !toTable || !toColumn) {
      continue;
    }

    relations.push({
      fromTable,
      fromColumn,
      toTable,
      toColumn,
      constraintName: extractString(row, ['constraint_name', 'CONSTRAINT_NAME', 'constraintName', 'name']) ?? undefined,
      onDelete: normalizeReferentialAction(
        extractString(row, ['on_delete', 'ON_DELETE', 'onDelete', 'delete_rule', 'DELETE_RULE']),
      ),
      onUpdate: normalizeReferentialAction(
        extractString(row, ['on_update', 'ON_UPDATE', 'onUpdate', 'update_rule', 'UPDATE_RULE']),
      ),
    });
  }

  const unique = new Map<string, SchemaRelationEdge>();
  for (const relation of relations) {
    const key = `${relation.fromTable}.${relation.fromColumn}->${relation.toTable}.${relation.toColumn}`;
    if (!unique.has(key)) {
      unique.set(key, relation);
    }
  }

  return Array.from(unique.values()).sort((left, right) => (
    `${left.fromTable}.${left.fromColumn}`.localeCompare(`${right.fromTable}.${right.fromColumn}`)
  ));
};

const buildObjectRelationsSql = (
  sourceType: string,
  objectName: string,
): { sql: string; params: unknown[] } | null => {
  const normalizedType = sourceType.trim();
  const safeObjectName = assertSafeIdentifier(objectName, 'objectName');

  if (normalizedType === 'PostgreSQL') {
    return {
      sql: `SELECT
              src.table_name AS from_table,
              src.column_name AS from_column,
              dst.table_name AS to_table,
              dst.column_name AS to_column,
              tc.constraint_name,
              rc.delete_rule AS on_delete,
              rc.update_rule AS on_update
            FROM information_schema.table_constraints tc
            INNER JOIN information_schema.key_column_usage src
              ON tc.constraint_schema = src.constraint_schema
             AND tc.constraint_name = src.constraint_name
            INNER JOIN information_schema.constraint_column_usage dst
              ON tc.constraint_schema = dst.constraint_schema
             AND tc.constraint_name = dst.constraint_name
            INNER JOIN information_schema.referential_constraints rc
              ON tc.constraint_schema = rc.constraint_schema
             AND tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND (src.table_name = CAST(? AS text) OR dst.table_name = CAST(? AS text))
            ORDER BY src.table_name, src.column_name`,
      params: [safeObjectName, safeObjectName],
    };
  }

  if (normalizedType === 'MySQL') {
    return {
      sql: `SELECT
              kcu.TABLE_NAME AS from_table,
              kcu.COLUMN_NAME AS from_column,
              kcu.REFERENCED_TABLE_NAME AS to_table,
              kcu.REFERENCED_COLUMN_NAME AS to_column,
              kcu.CONSTRAINT_NAME AS constraint_name,
              rc.DELETE_RULE AS on_delete,
              rc.UPDATE_RULE AS on_update
            FROM information_schema.KEY_COLUMN_USAGE kcu
            INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
              ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
             AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
            WHERE kcu.TABLE_SCHEMA = DATABASE()
              AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
              AND (kcu.TABLE_NAME = ? OR kcu.REFERENCED_TABLE_NAME = ?)
            ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME`,
      params: [safeObjectName, safeObjectName],
    };
  }

  if (normalizedType === 'SQL Server') {
    return {
      sql: `SELECT
              OBJECT_NAME(fk.parent_object_id) AS from_table,
              col_from.name AS from_column,
              OBJECT_NAME(fk.referenced_object_id) AS to_table,
              col_to.name AS to_column,
              fk.name AS constraint_name,
              fk.delete_referential_action_desc AS on_delete,
              fk.update_referential_action_desc AS on_update
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc
              ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.columns col_from
              ON fkc.parent_object_id = col_from.object_id
             AND fkc.parent_column_id = col_from.column_id
            INNER JOIN sys.columns col_to
              ON fkc.referenced_object_id = col_to.object_id
             AND fkc.referenced_column_id = col_to.column_id
            WHERE OBJECT_NAME(fk.parent_object_id) = ?
               OR OBJECT_NAME(fk.referenced_object_id) = ?
            ORDER BY from_table, from_column`,
      params: [safeObjectName, safeObjectName],
    };
  }

  return null;
};

const listSqliteTableRelations = async (
  dbQuery: EdgeDbQueryFn,
  objectName: string,
  context: { dataSourceId: string; database?: string },
): Promise<SchemaRelationEdge[]> => {
  const safeObjectName = assertSafeIdentifier(objectName, 'objectName');
  const relations: SchemaRelationEdge[] = [];

  const outgoing = await dbQuery(`PRAGMA foreign_key_list(${safeObjectName})`, [], context);
  for (const row of Array.isArray(outgoing.data) ? outgoing.data : []) {
    const fromColumn = extractString(row, ['from', 'FROM']);
    const toTable = extractString(row, ['table', 'TABLE']);
    const toColumn = extractString(row, ['to', 'TO']);
    if (!fromColumn || !toTable || !toColumn) {
      continue;
    }
    relations.push({
      fromTable: safeObjectName,
      fromColumn,
      toTable,
      toColumn,
      onDelete: normalizeReferentialAction(extractString(row, ['on_delete', 'ON_DELETE'])),
      onUpdate: normalizeReferentialAction(extractString(row, ['on_update', 'ON_UPDATE'])),
    });
  }

  const tables = await listDataSourceSchemaObjects(dbQuery, 'SQLite', 'TABLE', { dataSourceId: context.dataSourceId });
  for (const tableName of tables) {
    if (tableName === safeObjectName) {
      continue;
    }

    const incoming = await dbQuery(`PRAGMA foreign_key_list(${tableName})`, [], context);
    for (const row of Array.isArray(incoming.data) ? incoming.data : []) {
      const referencedTable = extractString(row, ['table', 'TABLE']);
      if (referencedTable !== safeObjectName) {
        continue;
      }

      const fromColumn = extractString(row, ['from', 'FROM']);
      const toColumn = extractString(row, ['to', 'TO']);
      if (!fromColumn || !toColumn) {
        continue;
      }

      relations.push({
        fromTable: tableName,
        fromColumn,
        toTable: safeObjectName,
        toColumn,
        onDelete: normalizeReferentialAction(extractString(row, ['on_delete', 'ON_DELETE'])),
        onUpdate: normalizeReferentialAction(extractString(row, ['on_update', 'ON_UPDATE'])),
      });
    }
  }

  return normalizeRelationRows(relations);
};

export async function listDataSourceObjectRelations(
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
  context: { dataSourceId: string; database?: string },
): Promise<SchemaRelationsSnapshot> {
  const safeObjectName = assertSafeIdentifier(objectName, 'objectName');
  const normalizedObjectType = objectType === 'VIEW' ? 'VIEW' : 'TABLE';

  if (normalizedObjectType !== 'TABLE') {
    const fields = await listDataSourceObjectFields(dbQuery, sourceType, objectType, objectName, context);
    return {
      focusObject: safeObjectName,
      objectType: normalizedObjectType,
      tables: [{
        name: safeObjectName,
        columns: fields.map((field) => ({
          name: field.name,
          dataType: field.dataType,
          isPrimaryKey: field.isPrimaryKey,
        })),
      }],
      relations: [],
    };
  }

  let relations: SchemaRelationEdge[] = [];
  if (sourceType.trim() === 'SQLite') {
    relations = await listSqliteTableRelations(dbQuery, safeObjectName, context);
  } else {
    const query = buildObjectRelationsSql(sourceType, safeObjectName);
    if (query) {
      const result = await dbQuery(query.sql, query.params, context);
      relations = normalizeRelationRows(Array.isArray(result.data) ? result.data : []);
    }
  }

  const tableNames = new Set<string>([safeObjectName]);
  for (const relation of relations) {
    tableNames.add(relation.fromTable);
    tableNames.add(relation.toTable);
  }

  const tables = await Promise.all([...tableNames].sort((left, right) => left.localeCompare(right)).map(async (tableName) => {
    const fields = await listDataSourceObjectFields(
      dbQuery,
      sourceType,
      'TABLE',
      tableName,
      context,
    );

    return {
      name: tableName,
      columns: fields.map((field) => ({
        name: field.name,
        dataType: field.dataType,
        isPrimaryKey: field.isPrimaryKey,
      })),
    };
  }));

  return {
    focusObject: safeObjectName,
    objectType: normalizedObjectType,
    tables,
    relations,
  };
}

const extractNumber = (row: unknown, keys: string[]): number | null => {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'bigint') {
      return Number(candidate);
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const buildObjectRowCountSql = (
  sourceType: string,
  objectName: string,
): { sql: string; params: unknown[] } | null => {
  const normalizedType = sourceType.trim();
  const safeObjectName = assertSafeIdentifier(objectName, 'objectName');

  if (normalizedType === 'PostgreSQL') {
    return {
      sql: `SELECT COUNT(*)::bigint AS row_count FROM "${safeObjectName}"`,
      params: [],
    };
  }

  if (normalizedType === 'SQLite') {
    return {
      sql: `SELECT COUNT(*) AS row_count FROM ${safeObjectName}`,
      params: [],
    };
  }

  if (normalizedType === 'MySQL') {
    return {
      sql: `SELECT COUNT(*) AS row_count FROM \`${safeObjectName}\``,
      params: [],
    };
  }

  if (normalizedType === 'SQL Server') {
    return {
      sql: `SELECT COUNT(*) AS row_count FROM [${safeObjectName}]`,
      params: [],
    };
  }

  return null;
};

export async function countSchemaObjectRows(
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
  context: { dataSourceId: string; database?: string },
): Promise<number | null> {
  if (objectType !== 'TABLE' && objectType !== 'VIEW') {
    return null;
  }

  const query = buildObjectRowCountSql(sourceType, objectName);
  if (!query) {
    return null;
  }

  const result = await dbQuery(query.sql, query.params, context);
  const rows = Array.isArray(result.data) ? result.data : [];
  const firstRow = rows[0];
  const count = extractNumber(firstRow, ['row_count', 'ROW_COUNT', 'rowCount', 'count', 'COUNT']);
  return count === null ? 0 : count;
}

const buildObjectDefinitionSql = (
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
  functionKind?: SchemaFunctionKind,
): { sql: string; params: unknown[] } | null => {
  if (objectType === 'TABLE') {
    return null;
  }

  const normalizedType = sourceType.trim();
  const safeObjectName = assertSafeIdentifier(objectName, 'objectName');

  if (normalizedType === 'SQLite') {
    if (objectType !== 'VIEW') {
      return null;
    }
    return {
      sql: `SELECT sql AS definition FROM sqlite_master WHERE type = 'view' AND name = ?`,
      params: [safeObjectName],
    };
  }

  if (normalizedType === 'PostgreSQL') {
    if (objectType === 'VIEW') {
      return {
        sql: `SELECT pg_get_viewdef(c.oid, true) AS definition
              FROM pg_class c
              INNER JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public'
                AND c.relname = CAST(? AS text)
                AND c.relkind = 'v'
              ORDER BY c.oid
              LIMIT 1`,
        params: [safeObjectName],
      };
    }

    if (objectType === 'PROCEDURE') {
      return {
        sql: `SELECT pg_get_functiondef(p.oid) AS definition
              FROM pg_proc p
              INNER JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.proname = CAST(? AS text)
                AND p.prokind = 'p'
              ORDER BY p.oid
              LIMIT 1`,
        params: [safeObjectName],
      };
    }

    if (functionKind === 'TABLE_VALUED') {
      return {
        sql: `SELECT pg_get_functiondef(p.oid) AS definition
              FROM pg_proc p
              INNER JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.proname = CAST(? AS text)
                AND p.prokind = 'f'
                AND p.proretset
              ORDER BY p.oid
              LIMIT 1`,
        params: [safeObjectName],
      };
    }

    return {
      sql: `SELECT pg_get_functiondef(p.oid) AS definition
            FROM pg_proc p
            INNER JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = CAST(? AS text)
              AND p.prokind = 'f'
              AND NOT p.proretset
            ORDER BY p.oid
            LIMIT 1`,
      params: [safeObjectName],
    };
  }

  if (normalizedType === 'MySQL') {
    if (objectType === 'VIEW') {
      return {
        sql: `SHOW CREATE VIEW \`${safeObjectName}\``,
        params: [],
      };
    }
    if (objectType === 'PROCEDURE') {
      return {
        sql: `SHOW CREATE PROCEDURE \`${safeObjectName}\``,
        params: [],
      };
    }
    return {
      sql: `SHOW CREATE FUNCTION \`${safeObjectName}\``,
      params: [],
    };
  }

  if (normalizedType === 'SQL Server') {
    if (objectType === 'VIEW') {
      return {
        sql: `SELECT m.definition AS definition
              FROM sys.sql_modules m
              INNER JOIN sys.objects o ON m.object_id = o.object_id
              WHERE o.name = ?
                AND o.type = 'V'`,
        params: [safeObjectName],
      };
    }

    if (objectType === 'PROCEDURE') {
      return {
        sql: `SELECT m.definition AS definition
              FROM sys.sql_modules m
              INNER JOIN sys.objects o ON m.object_id = o.object_id
              WHERE o.name = ?
                AND o.type = 'P'`,
        params: [safeObjectName],
      };
    }

    if (functionKind === 'TABLE_VALUED') {
      return {
        sql: `SELECT m.definition AS definition
              FROM sys.sql_modules m
              INNER JOIN sys.objects o ON m.object_id = o.object_id
              WHERE o.name = ?
                AND o.type IN ('IF', 'TF')`,
        params: [safeObjectName],
      };
    }

    return {
      sql: `SELECT m.definition AS definition
            FROM sys.sql_modules m
            INNER JOIN sys.objects o ON m.object_id = o.object_id
            WHERE o.name = ?
              AND o.type IN ('FN', 'FS')`,
      params: [safeObjectName],
    };
  }

  return null;
};

export async function getDataSourceObjectDefinition(
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
  context: { dataSourceId: string; database?: string; functionKind?: SchemaFunctionKind },
): Promise<string | null> {
  const query = buildObjectDefinitionSql(sourceType, objectType, objectName, context.functionKind);
  if (!query) {
    return null;
  }

  const result = await dbQuery(query.sql, query.params, context);
  const rows = Array.isArray(result.data) ? result.data : [];
  for (const row of rows) {
    const rawDefinition = extractSchemaObjectDefinitionRow(row);
    if (rawDefinition) {
      return normalizeSchemaObjectDefinition(
        sourceType,
        objectType,
        objectName,
        rawDefinition,
        context.functionKind,
      );
    }
  }

  return null;
}

type SchemaDependencyCatalogItem = {
  objectName: string;
  objectKind: SchemaObjectDependencyKind;
  objectType: SchemaObjectType;
  functionKind?: SchemaFunctionKind;
};

const buildDependencyCatalog = async (
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  context: { dataSourceId: string; database?: string },
): Promise<SchemaDependencyCatalogItem[]> => {
  const [tables, views, procedures, scalarFunctions, tableValuedFunctions] = await Promise.all([
    listDataSourceSchemaObjects(dbQuery, sourceType, 'TABLE', context),
    listDataSourceSchemaObjects(dbQuery, sourceType, 'VIEW', context),
    listDataSourceSchemaObjects(dbQuery, sourceType, 'PROCEDURE', context),
    listDataSourceSchemaObjects(dbQuery, sourceType, 'FUNCTION', { ...context, functionKind: 'SCALAR' }),
    listDataSourceSchemaObjects(dbQuery, sourceType, 'FUNCTION', { ...context, functionKind: 'TABLE_VALUED' }),
  ]);

  return [
    ...tables.map((objectName) => ({ objectName, objectKind: 'TABLE' as const, objectType: 'TABLE' as const })),
    ...views.map((objectName) => ({ objectName, objectKind: 'VIEW' as const, objectType: 'VIEW' as const })),
    ...procedures.map((objectName) => ({
      objectName,
      objectKind: 'STORED_PROCEDURE' as const,
      objectType: 'PROCEDURE' as const,
    })),
    ...scalarFunctions.map((objectName) => ({
      objectName,
      objectKind: 'SCALAR_FUNCTION' as const,
      objectType: 'FUNCTION' as const,
      functionKind: 'SCALAR' as const,
    })),
    ...tableValuedFunctions.map((objectName) => ({
      objectName,
      objectKind: 'TABLE_VALUED_FUNCTION' as const,
      objectType: 'FUNCTION' as const,
      functionKind: 'TABLE_VALUED' as const,
    })),
  ];
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildDefinitionReferencePattern = (objectName: string): RegExp => (
  new RegExp(`(^|[^a-zA-Z0-9_])(?:["\\[\`])?${escapeRegex(objectName)}(?:["\\]\`])?(?=$|[^a-zA-Z0-9_])`, 'i')
);

const dedupeDependencyItems = (
  items: SchemaObjectDependencyItem[],
): SchemaObjectDependencyItem[] => {
  const unique = new Map<string, SchemaObjectDependencyItem>();
  for (const item of items) {
    const key = `${item.objectKind}::${item.objectName}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }
  return Array.from(unique.values()).sort((left, right) => {
    const byName = left.objectName.localeCompare(right.objectName);
    return byName !== 0 ? byName : left.objectKind.localeCompare(right.objectKind);
  });
};

const buildForeignKeyDependencyItems = (
  relations: SchemaRelationEdge[],
  focusObjectName: string,
  catalogByName: Map<string, SchemaDependencyCatalogItem>,
): SchemaObjectDependencies => {
  const dependencies: SchemaObjectDependencyItem[] = [];
  const dependents: SchemaObjectDependencyItem[] = [];

  for (const relation of relations) {
    if (relation.fromTable === focusObjectName) {
      dependencies.push({
        objectName: relation.toTable,
        objectKind: catalogByName.get(relation.toTable)?.objectKind ?? 'TABLE',
        details: relation.constraintName?.trim() ? `Foreign key · ${relation.constraintName}` : 'Foreign key',
      });
    }
    if (relation.toTable === focusObjectName) {
      dependents.push({
        objectName: relation.fromTable,
        objectKind: catalogByName.get(relation.fromTable)?.objectKind ?? 'TABLE',
        details: relation.constraintName?.trim() ? `Foreign key · ${relation.constraintName}` : 'Foreign key',
      });
    }
  }

  return {
    dependencies,
    dependents,
  };
};

const loadPostgresSqlDefinitions = async (
  dbQuery: EdgeDbQueryFn,
  context: { dataSourceId: string; database?: string },
): Promise<Array<{
  objectName: string;
  objectKind: SchemaObjectDependencyKind;
  definition: string;
}>> => {
  const [views, routines] = await Promise.all([
    dbQuery(
      `SELECT c.relname AS object_name, pg_get_viewdef(c.oid, true) AS definition
       FROM pg_class c
       INNER JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'v'`,
      [],
      context,
    ),
    dbQuery(
      `SELECT p.proname AS object_name,
              CASE
                WHEN p.prokind = 'p' THEN 'STORED_PROCEDURE'
                WHEN p.proretset THEN 'TABLE_VALUED_FUNCTION'
                ELSE 'SCALAR_FUNCTION'
              END AS object_kind,
              pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p
       INNER JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.prokind IN ('f', 'p')`,
      [],
      context,
    ),
  ]);

  const items: Array<{
    objectName: string;
    objectKind: SchemaObjectDependencyKind;
    definition: string;
  }> = [];

  for (const row of Array.isArray(views.data) ? views.data : []) {
    const objectName = extractString(row, ['object_name', 'OBJECT_NAME', 'relname']);
    const definition = extractString(row, ['definition', 'DEFINITION']);
    if (objectName && definition) {
      items.push({ objectName, objectKind: 'VIEW', definition });
    }
  }

  for (const row of Array.isArray(routines.data) ? routines.data : []) {
    const objectName = extractString(row, ['object_name', 'OBJECT_NAME', 'proname']);
    const definition = extractString(row, ['definition', 'DEFINITION']);
    const objectKind = extractString(row, ['object_kind', 'OBJECT_KIND']);
    if (!objectName || !definition) {
      continue;
    }
    const kind: SchemaObjectDependencyKind = objectKind === 'STORED_PROCEDURE'
      || objectKind === 'TABLE_VALUED_FUNCTION'
      || objectKind === 'SCALAR_FUNCTION'
      ? objectKind
      : 'UNKNOWN';
    items.push({ objectName, objectKind: kind, definition });
  }

  return items;
};

const applyDefinitionReferences = (
  focusObjectName: string,
  definitions: Array<{
    objectName: string;
    objectKind: SchemaObjectDependencyKind;
    definition: string;
  }>,
  dependencies: SchemaObjectDependencyItem[],
  dependents: SchemaObjectDependencyItem[],
  catalogByName: Map<string, SchemaDependencyCatalogItem>,
) => {
  const focusPattern = buildDefinitionReferencePattern(focusObjectName);
  const focusDefinition = definitions.find((item) => item.objectName === focusObjectName)?.definition;

  if (focusDefinition) {
    for (const candidate of catalogByName.values()) {
      if (candidate.objectName === focusObjectName) {
        continue;
      }
      if (buildDefinitionReferencePattern(candidate.objectName).test(focusDefinition)) {
        dependencies.push({
          objectName: candidate.objectName,
          objectKind: candidate.objectKind,
          details: 'Referenced in definition',
        });
      }
    }
  }

  for (const entry of definitions) {
    if (entry.objectName === focusObjectName || !focusPattern.test(entry.definition)) {
      continue;
    }
    dependents.push({
      objectName: entry.objectName,
      objectKind: entry.objectKind,
      details: 'Referenced in definition',
    });
  }
};

export async function listDataSourceObjectDependencies(
  dbQuery: EdgeDbQueryFn,
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
  context: { dataSourceId: string; database?: string; functionKind?: SchemaFunctionKind },
): Promise<SchemaObjectDependencies> {
  try {
    const safeObjectName = assertSafeIdentifier(objectName, 'objectName');
    const catalog = await buildDependencyCatalog(dbQuery, sourceType, context);
    const catalogByName = new Map(catalog.map((item) => [item.objectName, item]));
    const dependencies: SchemaObjectDependencyItem[] = [];
    const dependents: SchemaObjectDependencyItem[] = [];

    if (objectType === 'TABLE') {
      try {
        let relations: SchemaRelationEdge[] = [];
        if (sourceType.trim() === 'SQLite') {
          relations = await listSqliteTableRelations(dbQuery, safeObjectName, context);
        } else {
          const query = buildObjectRelationsSql(sourceType, safeObjectName);
          if (query) {
            const result = await dbQuery(query.sql, query.params, context);
            relations = normalizeRelationRows(Array.isArray(result.data) ? result.data : []);
          }
        }
        const fkItems = buildForeignKeyDependencyItems(relations, safeObjectName, catalogByName);
        dependencies.push(...fkItems.dependencies);
        dependents.push(...fkItems.dependents);
      } catch {
        // Keep definition-based edges even if foreign-key introspection fails.
      }
    }

    if (sourceType.trim() === 'PostgreSQL') {
      try {
        const definitions = await loadPostgresSqlDefinitions(dbQuery, context);
        applyDefinitionReferences(
          safeObjectName,
          definitions,
          dependencies,
          dependents,
          catalogByName,
        );
      } catch {
        // Foreign-key edges are still useful if definition scan fails.
      }
    } else {
      const definitionCache = new Map<string, Promise<string | null>>();
      const loadDefinition = (item: SchemaDependencyCatalogItem): Promise<string | null> => {
        const key = `${item.objectKind}::${item.objectName}`;
        const cached = definitionCache.get(key);
        if (cached) {
          return cached;
        }
        const next = item.objectType === 'TABLE'
          ? Promise.resolve<string | null>(null)
          : getDataSourceObjectDefinition(
            dbQuery,
            sourceType,
            item.objectType,
            item.objectName,
            {
              dataSourceId: context.dataSourceId,
              database: context.database,
              functionKind: item.functionKind,
            },
          ).catch(() => null);
        definitionCache.set(key, next);
        return next;
      };

      const definitionRows = await Promise.all(catalog
        .filter((item) => item.objectType !== 'TABLE')
        .map(async (item) => ({
          objectName: item.objectName,
          objectKind: item.objectKind,
          definition: await loadDefinition(item),
        })));

      applyDefinitionReferences(
        safeObjectName,
        definitionRows.filter((row): row is {
          objectName: string;
          objectKind: SchemaObjectDependencyKind;
          definition: string;
        } => Boolean(row.definition)),
        dependencies,
        dependents,
        catalogByName,
      );
    }

    return {
      dependencies: dedupeDependencyItems(dependencies),
      dependents: dedupeDependencyItems(dependents),
    };
  } catch {
    return { dependencies: [], dependents: [] };
  }
}
