import path from 'node:path';
import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import { createEdgeDbQueryExecutor } from '../../../../../core/database/EdgeDbRouter';
import type { EdgeDbQueryFn } from '../../../server-function.service';
import {
  getDataSourcesFromSettings,
  toApiDataSource,
} from '../../../../db/dataSourcesStore';
import {
  listDataSourceObjectFields,
  listDataSourceSchemaObjects,
  type SchemaObjectType,
} from '../../../../utils/dataSourceSchemaIntrospection';

export const LIST_DATA_SOURCES_TOOL_NAME = 'list_data_sources';
export const DESCRIBE_SCHEMA_TOOL_NAME = 'describe_schema';
export const QUERY_READONLY_TOOL_NAME = 'query_readonly';

export const QUERY_READONLY_MAX_ROWS = 100;
export const QUERY_READONLY_MAX_BYTES = 256_000;

const SQL_DATA_SOURCE_TYPES = new Set([
  'PostgreSQL',
  'MySQL',
  'Oracle',
  'SQL Server',
  'SQLite',
]);

const SCHEMA_OBJECT_TYPES = new Set<SchemaObjectType>(['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION']);

const FORBIDDEN_SQL_PATTERN = /\b(insert|update|delete|merge|drop|alter|truncate|create|replace|grant|revoke|execute|exec|call|into\s+outfile)\b/i;

export type DataToolsDeps = {
  getSettingsPath: () => string;
  edgeDbQuery: EdgeDbQueryFn;
};

export const sanitizeDataSourceForAgent = (
  source: ReturnType<typeof toApiDataSource>,
) => ({
  id: source.id,
  name: source.name,
  type: source.type,
  host: source.host,
  port: source.port,
  database: source.database,
  username: source.username,
  status: source.status,
  isDefault: source.isDefault,
  created_at: source.created_at,
  updated_at: source.updated_at,
  hasPassword: source.hasPassword,
});

export const stripSqlComments = (sql: string): string => (
  sql
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
);

export const validateReadOnlySql = (
  sql: string,
): { ok: true } | { ok: false; reason: string } => {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { ok: false, reason: 'SQL is empty.' };
  }

  const withoutComments = stripSqlComments(trimmed);
  if (FORBIDDEN_SQL_PATTERN.test(withoutComments)) {
    return { ok: false, reason: 'Only read-only SELECT queries are allowed.' };
  }

  const normalized = withoutComments.trim().toLowerCase();
  if (!/^(select|with|pragma)\b/.test(normalized)) {
    return { ok: false, reason: 'Query must start with SELECT, WITH, or PRAGMA.' };
  }

  const withoutTrailingSemicolon = withoutComments.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    return { ok: false, reason: 'Multiple SQL statements are not allowed.' };
  }

  return { ok: true };
};

const parseSchemaObjectType = (value: unknown): SchemaObjectType | null => {
  const normalized = String(value || '').trim().toUpperCase();
  return SCHEMA_OBJECT_TYPES.has(normalized as SchemaObjectType)
    ? normalized as SchemaObjectType
    : null;
};

const resolveDataSource = (settingsPath: string, dataSourceId: string) => {
  const normalizedId = dataSourceId.trim();
  if (!normalizedId) {
    return { ok: false as const, summary: 'dataSourceId is required.', error: 'missing_data_source_id' };
  }

  const source = getDataSourcesFromSettings(settingsPath).find((item) => item.id === normalizedId);
  if (!source) {
    return {
      ok: false as const,
      summary: `Data source "${normalizedId}" was not found.`,
      error: 'data_source_not_found',
    };
  }

  return { ok: true as const, source };
};

const truncateQueryResult = (rows: unknown[]): { rows: unknown[]; truncated: boolean } => {
  const limited = rows.slice(0, QUERY_READONLY_MAX_ROWS);
  let serialized = JSON.stringify(limited);
  let truncated = limited.length < rows.length;

  while (serialized.length > QUERY_READONLY_MAX_BYTES && limited.length > 1) {
    limited.pop();
    serialized = JSON.stringify(limited);
    truncated = true;
  }

  if (Buffer.byteLength(serialized, 'utf8') > QUERY_READONLY_MAX_BYTES) {
    return { rows: [], truncated: true };
  }

  return { rows: limited, truncated };
};

export const executeListDataSources = (deps: DataToolsDeps) => {
  const items = getDataSourcesFromSettings(deps.getSettingsPath()).map((source) => (
    sanitizeDataSourceForAgent(toApiDataSource(source))
  ));

  return {
    ok: true as const,
    summary: `Listed ${items.length} configured data source(s).`,
    data: { items, totalCount: items.length },
  };
};

export const executeDescribeSchema = async (
  args: Record<string, unknown>,
  deps: DataToolsDeps,
) => {
  const dataSourceId = typeof args.dataSourceId === 'string' ? args.dataSourceId : '';
  const resolved = resolveDataSource(deps.getSettingsPath(), dataSourceId);
  if (!resolved.ok) {
    return resolved;
  }

  const objectType = parseSchemaObjectType(args.objectType);
  const objectName = typeof args.objectName === 'string' ? args.objectName.trim() : '';

  if (objectName) {
    if (!objectType) {
      return {
        ok: false as const,
        summary: 'objectType is required when objectName is provided (TABLE, VIEW, PROCEDURE, or FUNCTION).',
        error: 'missing_object_type',
      };
    }

    const fields = await listDataSourceObjectFields(
      deps.edgeDbQuery,
      resolved.source.type,
      objectType,
      objectName,
      {
        dataSourceId: resolved.source.id,
        database: resolved.source.database,
      },
    );

    return {
      ok: true as const,
      summary: `Described ${objectType} "${objectName}" on ${resolved.source.name} (${fields.length} field(s)).`,
      data: {
        dataSourceId: resolved.source.id,
        dataSourceName: resolved.source.name,
        objectType,
        objectName,
        fields,
      },
    };
  }

  const catalog: Record<SchemaObjectType, string[]> = {
    TABLE: [],
    VIEW: [],
    PROCEDURE: [],
    FUNCTION: [],
  };

  if (objectType) {
    catalog[objectType] = await listDataSourceSchemaObjects(
      deps.edgeDbQuery,
      resolved.source.type,
      objectType,
      {
        dataSourceId: resolved.source.id,
        database: resolved.source.database,
      },
    );
  } else {
    await Promise.all((['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION'] as SchemaObjectType[]).map(async (type) => {
      catalog[type] = await listDataSourceSchemaObjects(
        deps.edgeDbQuery,
        resolved.source.type,
        type,
        {
          dataSourceId: resolved.source.id,
          database: resolved.source.database,
        },
      );
    }));
  }

  const totalObjects = Object.values(catalog).reduce((count, names) => count + names.length, 0);

  return {
    ok: true as const,
    summary: objectType
      ? `Listed ${catalog[objectType].length} ${objectType} object(s) on ${resolved.source.name}.`
      : `Listed ${totalObjects} schema object(s) on ${resolved.source.name}.`,
    data: {
      dataSourceId: resolved.source.id,
      dataSourceName: resolved.source.name,
      catalog,
    },
  };
};

const parseQueryParams = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const executeQueryReadonly = async (
  args: Record<string, unknown>,
  deps: DataToolsDeps,
) => {
  const dataSourceId = typeof args.dataSourceId === 'string' ? args.dataSourceId : '';
  const sql = typeof args.sql === 'string' ? args.sql : '';
  const params = parseQueryParams(args.params);

  const resolved = resolveDataSource(deps.getSettingsPath(), dataSourceId);
  if (!resolved.ok) {
    return resolved;
  }

  if (!SQL_DATA_SOURCE_TYPES.has(resolved.source.type)) {
    return {
      ok: false as const,
      summary: `query_readonly supports SQL data sources only (not ${resolved.source.type}).`,
      error: 'unsupported_data_source_type',
    };
  }

  const validation = validateReadOnlySql(sql);
  if (!validation.ok) {
    return {
      ok: false as const,
      summary: validation.reason,
      error: 'invalid_sql',
    };
  }

  try {
    const queryResult = await deps.edgeDbQuery(
      sql.trim(),
      params,
      {
        dataSourceId: resolved.source.id,
        database: resolved.source.database,
      },
    );

    const { rows, truncated } = truncateQueryResult(
      Array.isArray(queryResult.data) ? queryResult.data : [],
    );

    return {
      ok: true as const,
      summary: truncated
        ? `Query returned ${rows.length} row(s) (truncated to read-only limits).`
        : `Query returned ${rows.length} row(s).`,
      data: {
        dataSourceId: resolved.source.id,
        dataSourceName: resolved.source.name,
        count: rows.length,
        truncated,
        rows,
        source: queryResult.source,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      summary: `Read-only query failed: ${message}`,
      error: 'query_failed',
    };
  }
};

export const createDefaultDataToolsDeps = (): DataToolsDeps => {
  const settingsPath = path.join(process.cwd(), 'settings.json');
  return {
    getSettingsPath: () => settingsPath,
    edgeDbQuery: createEdgeDbQueryExecutor({
      getDataSources: () => getDataSourcesFromSettings(settingsPath),
    }),
  };
};

export const createDataTools = (deps: DataToolsDeps): NativeToolDefinition[] => [
  {
    name: LIST_DATA_SOURCES_TOOL_NAME,
    description: 'List configured AppEndO data sources (passwords redacted).',
    group: 'data',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => executeListDataSources(deps),
  },
  {
    name: DESCRIBE_SCHEMA_TOOL_NAME,
    description: 'Describe schema objects on a data source. Omit objectName for full catalog; provide objectType + objectName for field details.',
    group: 'data',
    parameters: {
      type: 'object',
      properties: {
        dataSourceId: {
          type: 'string',
          description: 'Target data source id from list_data_sources.',
        },
        objectType: {
          type: 'string',
          description: 'Optional object type: TABLE, VIEW, PROCEDURE, or FUNCTION.',
        },
        objectName: {
          type: 'string',
          description: 'Optional object name — when set, returns field metadata for that object.',
        },
      },
      required: ['dataSourceId'],
    },
    execute: async (args) => executeDescribeSchema(args, deps),
  },
  {
    name: QUERY_READONLY_TOOL_NAME,
    description: 'Run a read-only SQL query (SELECT/WITH/PRAGMA) against a SQL data source. Uses ? bind parameters.',
    group: 'data',
    parameters: {
      type: 'object',
      properties: {
        dataSourceId: {
          type: 'string',
          description: 'Target data source id from list_data_sources.',
        },
        sql: {
          type: 'string',
          description: 'Read-only SQL statement.',
        },
        params: {
          type: 'string',
          description: 'Optional bind parameters array (JSON array).',
        },
      },
      required: ['dataSourceId', 'sql'],
    },
    execute: async (args) => executeQueryReadonly(args, deps),
  },
];
