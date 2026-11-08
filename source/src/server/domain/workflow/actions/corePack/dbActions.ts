import { Op, type WhereOptions } from 'sequelize';
import { createEdgeDbQueryExecutor } from '../../../../../core/database/EdgeDbRouter';
import { getDataSourcesFromSettings } from '../../../../db/dataSourcesStore';
import { SETTINGS_PATH } from '../../../../config/settingsFile';
import { EdgeSequelizeFactory } from '../../../../services/data-api/sequelize/edgeSequelizeFactory';
import { defineDynamicModel, resolvePrimaryKeyFromFields } from '../../../../services/data-api/sequelize/buildDynamicModel';
import { toPascalCaseModelName, mapSuggestedFieldTypeToSequelize } from '../../../../services/data-api/sequelize/typeMapping';
import { listDataSourceObjectFields, type SchemaFieldInfo } from '../../../../utils/dataSourceSchemaIntrospection';
import type { EdgeModelColumn } from '../../../../../shared/api/contracts/data-api';
import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';

/**
 * Database Action pack — closes the "workflows have no DB read/write tool" gap (p-60 WFV2-6),
 * scoped per PO decision (2026-07-18) to **read-only, free parameterized SQL** against any
 * platform-configured Data Source: `data.db-query` runs an author-written `SELECT`/CTE with `?`
 * placeholders and bound parameters (never string-interpolated) against `EdgeDbRouter` — the same
 * primitive AI agent tools and Server Functions already reuse for external Data Sources (a
 * completely separate system from the platform's own control-plane Prisma DB). `ActionExecutorContext`
 * deliberately carries no db/query field (doc04 §2: "an executor never receives Prisma, direct
 * Workflow repositories..."), so this module constructs its own `edgeDbQuery` executor the exact
 * same way `bootstrapFullRuntime.ts` does (a plain `getDataSourcesFromSettings(SETTINGS_PATH)` read,
 * no bootstrap-runtime plumbing needed) rather than threading a new context field through the whole
 * engine for one Action.
 *
 * Read-only enforcement is a best-effort statement-shape guard (single statement, must start with
 * SELECT/WITH, no DDL/DML/EXEC keywords) — not a full SQL parser. It is real defense-in-depth, not
 * the sole guarantee: values are always bound as driver-native parameters (`EdgeDbRouter` never
 * string-interpolates `params` into the SQL text), so even a maximally adversarial `input.params`
 * value cannot change the query's shape, only the bound values.
 */

const edgeDbQuery = createEdgeDbQueryExecutor({
  getDataSources: () => getDataSourcesFromSettings(SETTINGS_PATH),
});

const MAX_ROWS = 1000;

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
  'EXEC', 'EXECUTE', 'MERGE', 'GRANT', 'REVOKE', 'CALL', 'INTO',
];

/** Strips `--` line comments and `/* *\/` block comments before keyword/shape analysis, so a comment can't hide a forbidden keyword from the guard below. */
function stripSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

export function assertReadOnlySelect(rawSql: string): { ok: true } | { ok: false; reason: string } {
  const stripped = stripSqlComments(rawSql).trim();
  const withoutTrailingSemicolon = stripped.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    return { ok: false, reason: 'Only a single statement is allowed (no ";" other than an optional trailing one).' };
  }
  if (!/^(select|with)\b/i.test(withoutTrailingSemicolon)) {
    return { ok: false, reason: 'Only SELECT (or a WITH ... SELECT common table expression) statements are allowed.' };
  }
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(withoutTrailingSemicolon)) {
      return { ok: false, reason: `Statement contains a disallowed keyword for a read-only query: ${keyword}.` };
    }
  }
  return { ok: true };
}

export const dataDbQueryDefinition: ActionDefinition = {
  key: 'data.db-query',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string', title: 'Data source', format: 'data-source-id', description: 'Which configured Data Source (Settings → Data Sources) to query — the platform may have more than one.' },
      },
      required: ['dataSourceId'],
    },
  },
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        sql: { type: 'string', title: 'SQL (SELECT only)', description: 'A single SELECT (or WITH ... SELECT) statement using "?" placeholders for every value.' },
        params: { type: 'array', title: 'Parameters', description: 'Values bound in order to each "?" placeholder — never interpolated into the SQL text.' },
      },
      required: ['sql'],
    },
  },
  outputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        rows: { type: 'array', description: 'The returned rows (capped, see truncated).' },
        count: { type: 'number', description: 'Number of rows actually returned in `rows` (after any truncation).' },
        truncated: { type: 'boolean', description: `True when the query returned more than ${MAX_ROWS} rows and was capped.` },
      },
    },
  },
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['data.db-read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['data', 'database', 'sql'],
};

export const dataDbQueryExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const dataSourceId = (config as { dataSourceId?: unknown })?.dataSourceId;
    if (typeof dataSourceId !== 'string' || dataSourceId.trim().length === 0) {
      return { status: 'FAILED', errorCode: 'DB_QUERY_DATASOURCE_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'config.dataSourceId is required.' };
    }
    const sql = (input as { sql?: unknown })?.sql;
    if (typeof sql !== 'string' || sql.trim().length === 0) {
      return { status: 'FAILED', errorCode: 'DB_QUERY_SQL_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.sql is required.' };
    }
    const paramsInput = (input as { params?: unknown })?.params;
    const params = Array.isArray(paramsInput) ? paramsInput : [];

    const guard = assertReadOnlySelect(sql);
    if (guard.ok === false) {
      return { status: 'FAILED', errorCode: 'DB_QUERY_NOT_READ_ONLY', errorClass: 'VALIDATION', safeMessage: guard.reason };
    }

    try {
      const result = await edgeDbQuery(sql, params, { dataSourceId });
      const truncated = result.data.length > MAX_ROWS;
      const rows = (truncated ? result.data.slice(0, MAX_ROWS) : result.data) as JsonValue[];
      return { status: 'SUCCEEDED', output: { rows, count: rows.length, truncated } };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Database query failed.';
      return { status: 'FAILED', errorCode: 'DB_QUERY_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};

/**
 * `data.crud-gen-query` — the structured sibling of `data.db-query` (decision 2026-09-03):
 * instead of an author-written SQL string, the author names a table/view, an optional column
 * list, simple AND-combined filters,
 * and an order/limit — this module introspects the table's real columns at run time
 * (`listDataSourceObjectFields`, the same schema introspection SQL Console/DB Enricher use),
 * defines a throwaway Sequelize model from them (`defineDynamicModel`, the exact function
 * CRUD-Gen/Data API uses for a published Data Source table), and runs `Model.findAll`. This
 * removes the SQL-dialect and SQL-injection-shaped surface `data.db-query` carries, at the cost
 * of not supporting arbitrary JOINs/aggregations/CTEs — for those, `data.db-query` remains the
 * right tool and is not being replaced.
 */

const CRUD_GEN_MAX_ROWS = 1000;

const CRUD_GEN_SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const assertCrudGenSafeIdentifier = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || !CRUD_GEN_SAFE_IDENTIFIER.test(normalized)) {
    throw new Error(`${label} must be a plain identifier (letters, digits, underscore).`);
  }
  return normalized;
};

const edgeSequelizeFactory = new EdgeSequelizeFactory({
  getDataSources: () => getDataSourcesFromSettings(SETTINGS_PATH),
});

type CrudGenWhereOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';

const CRUD_GEN_OPERATORS: Record<CrudGenWhereOperator, symbol> = {
  eq: Op.eq,
  ne: Op.ne,
  gt: Op.gt,
  gte: Op.gte,
  lt: Op.lt,
  lte: Op.lte,
  like: Op.like,
  in: Op.in,
};

type CrudGenWhereClause = { field: unknown; operator: unknown; value: JsonValue };

const buildCrudGenColumns = (fields: SchemaFieldInfo[]): EdgeModelColumn[] => fields.map((field) => ({
  name: field.name,
  field: field.name,
  dataType: field.dataType,
  sequelizeType: mapSuggestedFieldTypeToSequelize(field.suggestedFieldType),
  allowNull: field.nullable,
  isPrimaryKey: field.isPrimaryKey,
  isForeignKey: false,
}));

const buildCrudGenWhere = (
  clausesInput: unknown,
  knownFields: Set<string>,
): WhereOptions => {
  const clauses = Array.isArray(clausesInput) ? clausesInput as CrudGenWhereClause[] : [];
  if (clauses.length === 0) {
    return {};
  }

  const parts = clauses.map((clause) => {
    const field = assertCrudGenSafeIdentifier(clause.field, 'where[].field');
    if (!knownFields.has(field)) {
      throw new Error(`Unknown column in where clause: ${field}`);
    }
    const operator = clause.operator as CrudGenWhereOperator;
    const opSymbol = CRUD_GEN_OPERATORS[operator];
    if (!opSymbol) {
      throw new Error(`Unsupported where operator: ${String(clause.operator)}`);
    }
    if (operator === 'in' && !Array.isArray(clause.value)) {
      throw new Error('The "in" operator requires an array value.');
    }
    return { [field]: { [opSymbol]: clause.value } };
  });

  return { [Op.and]: parts } as WhereOptions;
};

export const dataCrudGenQueryDefinition: ActionDefinition = {
  key: 'data.crud-gen-query',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        dataSourceId: { type: 'string', title: 'Data source', format: 'data-source-id', description: 'Which configured Data Source (Settings → Data Sources) to query.' },
        table: { type: 'string', title: 'Table or view', description: 'Physical table or view name to query — columns are discovered automatically.' },
        objectType: { type: 'string', title: 'Object type', enum: ['TABLE', 'VIEW'], description: 'Defaults to TABLE.' },
      },
      required: ['dataSourceId', 'table'],
    },
  },
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        columns: { type: 'array', items: { type: 'string' }, title: 'Columns', description: 'Column names to return. Leave empty to return every column.' },
        where: {
          type: 'array',
          title: 'Filters',
          description: 'Filters combined with AND. Each entry: { field, operator, value }.',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in'] },
              value: {},
            },
            required: ['field', 'operator', 'value'],
          },
        },
        orderBy: {
          type: 'object',
          title: 'Order by',
          properties: {
            field: { type: 'string' },
            direction: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
        limit: { type: 'number', title: 'Row limit', description: `Capped at ${CRUD_GEN_MAX_ROWS}.` },
      },
    },
  },
  outputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        rows: { type: 'array', description: 'The returned rows (capped, see truncated).' },
        count: { type: 'number', description: 'Number of rows actually returned in `rows`.' },
        truncated: { type: 'boolean', description: `True when more rows matched than the ${CRUD_GEN_MAX_ROWS}-row cap.` },
      },
    },
  },
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['data.db-read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['data', 'database', 'sequelize'],
};

export const dataCrudGenQueryExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const dataSourceId = (config as { dataSourceId?: unknown })?.dataSourceId;
    if (typeof dataSourceId !== 'string' || dataSourceId.trim().length === 0) {
      return { status: 'FAILED', errorCode: 'CRUD_GEN_QUERY_DATASOURCE_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'config.dataSourceId is required.' };
    }

    let table: string;
    try {
      table = assertCrudGenSafeIdentifier((config as { table?: unknown })?.table, 'config.table');
    } catch (error) {
      return { status: 'FAILED', errorCode: 'CRUD_GEN_QUERY_TABLE_REQUIRED', errorClass: 'VALIDATION', safeMessage: error instanceof Error ? error.message : 'config.table is required.' };
    }

    const objectType: 'TABLE' | 'VIEW' = (config as { objectType?: unknown })?.objectType === 'VIEW' ? 'VIEW' : 'TABLE';

    const source = getDataSourcesFromSettings(SETTINGS_PATH).find((item) => item.id === dataSourceId);
    if (!source) {
      return { status: 'FAILED', errorCode: 'CRUD_GEN_QUERY_DATASOURCE_NOT_FOUND', errorClass: 'VALIDATION', safeMessage: `Data source not found: ${dataSourceId}` };
    }

    try {
      const fields = await listDataSourceObjectFields(edgeDbQuery, source.type, objectType, table, { dataSourceId });
      if (fields.length === 0) {
        return { status: 'FAILED', errorCode: 'CRUD_GEN_QUERY_TABLE_NOT_FOUND', errorClass: 'VALIDATION', safeMessage: `No columns found for "${table}" — check the table/view name and object type.` };
      }

      const knownFields = new Set(fields.map((field) => field.name));
      const columns = buildCrudGenColumns(fields);
      const primaryKey = resolvePrimaryKeyFromFields(fields);

      const sequelize = await edgeSequelizeFactory.getOrCreate(dataSourceId);
      const model = defineDynamicModel(sequelize, {
        sequelize: { modelName: toPascalCaseModelName(table), tableName: table, schema: undefined },
        columns,
        primaryKey,
        objectType,
      });

      const columnsInput = (input as { columns?: unknown })?.columns;
      let attributes: string[] | undefined;
      if (Array.isArray(columnsInput) && columnsInput.length > 0) {
        attributes = columnsInput.map((item) => assertCrudGenSafeIdentifier(item, 'columns[]'));
        const unknownColumn = attributes.find((name) => !knownFields.has(name));
        if (unknownColumn) {
          return { status: 'FAILED', errorCode: 'CRUD_GEN_QUERY_UNKNOWN_COLUMN', errorClass: 'VALIDATION', safeMessage: `Unknown column: ${unknownColumn}` };
        }
      }

      const where = buildCrudGenWhere((input as { where?: unknown })?.where, knownFields);

      const orderByInput = (input as { orderBy?: { field?: unknown; direction?: unknown } })?.orderBy;
      let order: [string, string][] | undefined;
      if (orderByInput && typeof orderByInput.field === 'string' && orderByInput.field.trim()) {
        const orderField = assertCrudGenSafeIdentifier(orderByInput.field, 'orderBy.field');
        if (!knownFields.has(orderField)) {
          return { status: 'FAILED', errorCode: 'CRUD_GEN_QUERY_UNKNOWN_COLUMN', errorClass: 'VALIDATION', safeMessage: `Unknown column in orderBy: ${orderField}` };
        }
        order = [[orderField, orderByInput.direction === 'desc' ? 'DESC' : 'ASC']];
      }

      const limitInput = Number((input as { limit?: unknown })?.limit);
      const cappedLimit = Number.isFinite(limitInput) && limitInput > 0
        ? Math.min(Math.floor(limitInput), CRUD_GEN_MAX_ROWS)
        : CRUD_GEN_MAX_ROWS;

      const rows = (await model.findAll({
        where,
        attributes,
        order,
        limit: cappedLimit + 1,
        raw: true,
      })) as unknown as JsonValue[];

      const truncated = rows.length > cappedLimit;
      const finalRows = truncated ? rows.slice(0, cappedLimit) : rows;

      return { status: 'SUCCEEDED', output: { rows: finalRows, count: finalRows.length, truncated } };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CRUD-Gen query failed.';
      return { status: 'FAILED', errorCode: 'CRUD_GEN_QUERY_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};
