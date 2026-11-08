import { hydrateDataSourcePassword } from '../config/dataSourceSecrets';
import {
  getDataSourcesFromSettings,
  persistStoredDataSource,
  preserveDefaultDataSourceUpdateAudit,
  removeStoredEdgeDataSource,
  SUPPORTED_DATA_SOURCE_TYPES,
  toApiDataSource,
  toDataSourceStatus,
  type StoredDataSource,
} from '../db/dataSourcesStore';
import { HttpError } from '../errors/HttpError';
import type { EdgeDbQueryFn } from './server-function.service';
import { createId } from '../utils/createId';
import { testDataSourceConnectivity } from '../utils/dataSourceConnectivity';
import {
  countSchemaObjectRows,
  listDataSourceObjectFields,
  listDataSourceObjectDependencies,
  listDataSourceObjectRelations,
  listDataSourceObjectSummaries,
  listDataSourceSchemaObjects,
  getDataSourceObjectDefinition,
  type SchemaFunctionKind,
  type SchemaObjectType,
} from '../utils/dataSourceSchemaIntrospection';
import { parseDataSourcesListQuery } from '../../shared/api/contracts/data-sources/listQuery';
import { deleteSchemaObjectInputSchema } from '../../shared/api/contracts/data-sources/deleteSchemaObject';
import {
  deleteSchemaObjectPreviewQuerySchema,
  type SchemaObjectDeletePreview,
} from '../../shared/api/contracts/data-sources/deleteSchemaObjectPreview';
import { createSchemaObjectInputSchema } from '../../shared/api/contracts/data-sources/createSchemaObject';
import {
  addForeignKeyConstraintInputSchema,
  dropForeignKeyConstraintInputSchema,
} from '../../shared/api/contracts/data-sources/foreignKeyConstraint';
import { truncateSchemaObjectInputSchema } from '../../shared/api/contracts/data-sources/truncateSchemaObject';
import {
  schemaObjectDefinitionQuerySchema,
  updateSchemaObjectDefinitionInputSchema,
} from '../../shared/api/contracts/data-sources/schemaObjectDefinition';
import { schemaObjectDependenciesQuerySchema } from '../../shared/api/contracts/data-sources/schemaObjectDependencies';
import { executeDataSourceQueryInputSchema } from '../../shared/api/contracts/data-sources/executeQuery';
import {
  truncateDataSourceQueryResult,
  validateExecuteDataSourceSql,
} from '../../shared/lib/executeDataSourceQuery';
import {
  cleanupEdgeModelsForDeletedSchemaObject,
  collectEdgeModelDeleteRelationImpact,
} from './data-api/edgeModelDeleteCleanup';
import { deleteEdgeModelsForDataSource } from './data-api/edgeCapabilityDeleteCleanup';
import { invalidateDataApiCachesForSchemaObject } from './data-api/dataApiRuntimePolicy';
import {
  assertAlterSchemaSql,
  assertCreateSchemaSql,
  assertSchemaObjectName,
  buildCreateSchemaObjectStatement,
} from '../utils/schemaObjectCreation';
import { buildDropSchemaObjectStatement } from '../utils/schemaObjectDeletion';
import { buildTruncateTableStatement } from '../utils/schemaObjectTruncation';
import {
  buildAddForeignKeyStatement,
  buildDropForeignKeyStatement,
  suggestForeignKeyConstraintName,
} from '../../shared/lib/schemaObjectForeignKey';

export type DataSourceAuditActor = {
  username: string | null;
};

export type DataSourcesServiceDeps = {
  settingsPath: string;
  edgeDbQuery?: EdgeDbQueryFn;
};

const parseBooleanLike = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const DEFAULT_DATA_SOURCE_IDENTITY_LOCKED = 'The default data source identity is locked after install.';

export class DataSourcesService {
  constructor(private readonly deps: DataSourcesServiceDeps) {}

  list(rawQuery: Record<string, unknown> = {}) {
    const query = parseDataSourcesListQuery(rawQuery);
    let items = getDataSourcesFromSettings(this.deps.settingsPath).map(toApiDataSource);

    if (query.name) {
      const needle = query.name.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(needle));
    }
    if (query.type) {
      items = items.filter((item) => item.type === query.type);
    }
    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }
    if (query.connection) {
      const needle = query.connection.toLowerCase();
      items = items.filter((item) => {
        const connection = item.type === 'SQLite'
          ? String(item.database || 'database.sqlite')
          : (Number(item.port || 0) > 0 ? `${item.host || '-'}:${item.port}` : (item.host || '-'));
        return connection.toLowerCase().includes(needle);
      });
    }
    if (query.createdFrom || query.createdTo) {
      items = items.filter((item) => {
        const raw = String(item.created_at || '').slice(0, 10);
        if (!raw) return false;
        if (query.createdFrom && raw < query.createdFrom) return false;
        if (query.createdTo && raw > query.createdTo) return false;
        return true;
      });
    }
    if (query.updatedFrom || query.updatedTo) {
      items = items.filter((item) => {
        const raw = String(item.updated_at || '').slice(0, 10);
        if (!raw) return false;
        if (query.updatedFrom && raw < query.updatedFrom) return false;
        if (query.updatedTo && raw > query.updatedTo) return false;
        return true;
      });
    }

    const sortBy = query.sortBy ?? 'created_at';
    const sortDir = query.sortDir ?? 'desc';
    items = [...items].sort((left, right) => {
      let leftValue: string | number = '';
      let rightValue: string | number = '';

      if (sortBy === 'name') {
        leftValue = left.name.toLowerCase();
        rightValue = right.name.toLowerCase();
      } else if (sortBy === 'type') {
        leftValue = left.type.toLowerCase();
        rightValue = right.type.toLowerCase();
      } else if (sortBy === 'status') {
        leftValue = left.status.toLowerCase();
        rightValue = right.status.toLowerCase();
      } else if (sortBy === 'updated_at') {
        leftValue = new Date(left.updated_at || 0).getTime();
        rightValue = new Date(right.updated_at || 0).getTime();
      } else {
        leftValue = new Date(left.created_at || 0).getTime();
        rightValue = new Date(right.created_at || 0).getTime();
      }

      if (leftValue === rightValue) {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1;
        }
        return 0;
      }
      const compare = leftValue > rightValue ? 1 : -1;
      return sortDir === 'asc' ? compare : -compare;
    });

    return { body: { success: true as const, items, totalCount: items.length } };
  }

  async create(payload: Record<string, unknown>, actor?: DataSourceAuditActor) {
    const {
      name,
      type,
      host = '',
      port = null,
      database,
      username,
      password,
      encrypt = true,
      trustServerCertificate = true,
      pooling = true,
      options,
      isDefault,
    } = payload;

    if (isDefault === true) {
      throw new HttpError(400, DEFAULT_DATA_SOURCE_IDENTITY_LOCKED);
    }

    if (!name || !type) {
      throw new HttpError(400, 'name and type are required.');
    }

    if (!SUPPORTED_DATA_SOURCE_TYPES.has(String(type))) {
      throw new HttpError(400, 'Unsupported data source type.');
    }

    const id = createId('ds');
    const now = new Date().toISOString();
    const passwordUpdate = password ? String(password) : undefined;
    const source: StoredDataSource = hydrateDataSourcePassword({
      id,
      name: String(name).trim(),
      type: String(type),
      host: String(host || 'localhost').trim() || 'localhost',
      port: Number(port || 0),
      database: database ? String(database) : '',
      username: username ? String(username) : '',
      password: passwordUpdate,
      encrypt: parseBooleanLike(encrypt, true),
      trustServerCertificate: parseBooleanLike(trustServerCertificate, true),
      pooling: parseBooleanLike(pooling, true),
      options: options && typeof options === 'object' && !Array.isArray(options)
        ? options as Record<string, unknown>
        : undefined,
      status: 'disconnected',
      isDefault: false,
      created_at: now,
      updated_at: now,
      created_by: actor?.username ?? null,
      updated_by: actor?.username ?? null,
    });

    await persistStoredDataSource(this.deps.settingsPath, source, { passwordUpdate });

    return {
      statusCode: 201,
      body: { success: true as const, id },
    };
  }

  async update(id: string, payload: Record<string, unknown>, actor?: DataSourceAuditActor) {
    const items = getDataSourcesFromSettings(this.deps.settingsPath);
    const current = items.find((item) => item.id === id);
    if (!current) {
      throw new HttpError(404, 'Data source not found.');
    }

    const {
      name,
      type,
      host,
      port,
      database,
      username,
      password,
      encrypt,
      trustServerCertificate,
      pooling,
      options,
      status,
      isDefault,
    } = payload;

    if (isDefault === true) {
      throw new HttpError(400, DEFAULT_DATA_SOURCE_IDENTITY_LOCKED);
    }

    const nextType = type ? String(type) : current.type;
    if (!SUPPORTED_DATA_SOURCE_TYPES.has(nextType)) {
      throw new HttpError(400, 'Unsupported data source type.');
    }

    const now = new Date().toISOString();
    const passwordUpdate = password !== undefined && String(password).trim()
      ? String(password)
      : undefined;

    const next = preserveDefaultDataSourceUpdateAudit(current, hydrateDataSourcePassword({
      ...current,
      name: name !== undefined ? String(name) : current.name,
      type: nextType,
      host: host !== undefined ? String(host) : current.host,
      port: port !== undefined ? Number(port) : current.port,
      database: database !== undefined ? String(database) : current.database,
      username: username !== undefined ? String(username) : current.username,
      password: passwordUpdate ?? current.password,
      encrypt: encrypt === undefined ? current.encrypt : parseBooleanLike(encrypt, true),
      trustServerCertificate: trustServerCertificate === undefined
        ? current.trustServerCertificate
        : parseBooleanLike(trustServerCertificate, true),
      pooling: pooling === undefined ? current.pooling : parseBooleanLike(pooling, true),
      options: options && typeof options === 'object' && !Array.isArray(options)
        ? options as Record<string, unknown>
        : current.options,
      status: status !== undefined ? toDataSourceStatus(status) : current.status,
      isDefault: current.isDefault,
      ...(current.isDefault
        ? {}
        : {
          updated_at: now,
          updated_by: actor?.username ?? current.updated_by ?? null,
        }),
    }));

    await persistStoredDataSource(this.deps.settingsPath, next, { passwordUpdate });
    return { body: { success: true as const } };
  }

  async remove(id: string) {
    const items = getDataSourcesFromSettings(this.deps.settingsPath);
    const existing = items.find((item) => item.id === id);
    if (!existing) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (existing.isDefault) {
      throw new HttpError(400, 'Default data source cannot be deleted.');
    }

    await removeStoredEdgeDataSource(id);
    deleteEdgeModelsForDataSource(id);

    return { body: { success: true as const } };
  }

  async testById(id: string) {
    const items = getDataSourcesFromSettings(this.deps.settingsPath);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new HttpError(404, 'Data source not found.');
    }

    const now = new Date().toISOString();
    const testing = preserveDefaultDataSourceUpdateAudit(items[index], {
      status: 'testing',
      ...(items[index].isDefault ? {} : { updated_at: now }),
    });
    await persistStoredDataSource(this.deps.settingsPath, testing);

    const result = await testDataSourceConnectivity(testing);

    const refreshed = getDataSourcesFromSettings(this.deps.settingsPath).find((item) => item.id === id);
    if (refreshed) {
      await persistStoredDataSource(
        this.deps.settingsPath,
        preserveDefaultDataSourceUpdateAudit(refreshed, {
          status: toDataSourceStatus(result.status),
          ...(refreshed.isDefault ? {} : { updated_at: new Date().toISOString() }),
        }),
      );
    }

    return {
      body: {
        success: true as const,
        status: result.status,
        message: result.message,
      },
    };
  }

  async testDraft(payload: Record<string, unknown>) {
    const {
      type,
      host = '',
      port = null,
      database,
      username,
      password,
      encrypt = true,
      trustServerCertificate = true,
      pooling = true,
      options,
    } = payload;

    if (!type) {
      throw new HttpError(400, 'type is required.');
    }

    if (!SUPPORTED_DATA_SOURCE_TYPES.has(String(type))) {
      throw new HttpError(400, 'Unsupported data source type.');
    }

    const source = {
      type,
      host,
      port,
      database_name: database,
      database,
      username,
      password,
      encrypt,
      trustServerCertificate,
      pooling,
      options,
    };

    const result = await testDataSourceConnectivity(source);
    return {
      body: {
        success: true as const,
        status: result.status,
        message: result.message,
      },
    };
  }

  async testAll() {
    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const results: Array<{ id: string; status: string; message: string }> = [];

    const startedAt = new Date().toISOString();
    const testingSources: StoredDataSource[] = [];
    for (const source of sources) {
      const testing = preserveDefaultDataSourceUpdateAudit(source, {
        status: 'testing',
        ...(source.isDefault ? {} : { updated_at: startedAt }),
      });
      await persistStoredDataSource(this.deps.settingsPath, testing);
      testingSources.push(testing);
    }

    for (const source of testingSources) {
      const result = await testDataSourceConnectivity(source);
      await persistStoredDataSource(
        this.deps.settingsPath,
        preserveDefaultDataSourceUpdateAudit(source, {
          status: toDataSourceStatus(result.status),
          ...(source.isDefault ? {} : { updated_at: new Date().toISOString() }),
        }),
      );
      results.push({ id: source.id, status: result.status, message: result.message });
    }

    return {
      body: {
        success: true as const,
        items: results,
      },
    };
  }

  async listSchemaObjects(
    id: string,
    objectType: SchemaObjectType,
    functionKind?: SchemaFunctionKind,
  ) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) {
      throw new HttpError(400, 'Data source id is required.');
    }

    const normalizedObjectType = String(objectType || '').trim().toUpperCase();
    if (normalizedObjectType !== 'TABLE' && normalizedObjectType !== 'VIEW' && normalizedObjectType !== 'PROCEDURE' && normalizedObjectType !== 'FUNCTION') {
      throw new HttpError(400, 'objectType must be TABLE, VIEW, PROCEDURE, or FUNCTION.');
    }

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === normalizedId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema introspection is unavailable.');
    }

    const items = await listDataSourceObjectSummaries(
      this.deps.edgeDbQuery,
      source.type,
      normalizedObjectType,
      {
        dataSourceId: source.id,
        database: source.database,
        functionKind,
      },
    );

    return {
      body: {
        success: true as const,
        items,
      },
    };
  }

  async listSchemaCatalog(id: string) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) {
      throw new HttpError(400, 'Data source id is required.');
    }

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === normalizedId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema introspection is unavailable.');
    }

    const objectTypes: SchemaObjectType[] = ['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION'];
    const catalog = {
      TABLE: [] as string[],
      VIEW: [] as string[],
      PROCEDURE: [] as string[],
      FUNCTION: [] as string[],
    };

    await Promise.all(objectTypes.map(async (objectType) => {
      catalog[objectType] = await listDataSourceSchemaObjects(
        this.deps.edgeDbQuery!,
        source.type,
        objectType,
        {
          dataSourceId: source.id,
          database: source.database,
        },
      );
    }));

    return {
      body: {
        success: true as const,
        catalog,
      },
    };
  }

  async listObjectFields(
    dataSourceId: string,
    objectType: SchemaObjectType,
    objectName: string,
  ) {
    const normalizedId = String(dataSourceId || '').trim();
    if (!normalizedId) {
      throw new HttpError(400, 'dataSourceId is required.');
    }

    const normalizedObjectType = String(objectType || '').trim().toUpperCase();
    if (normalizedObjectType !== 'TABLE' && normalizedObjectType !== 'VIEW' && normalizedObjectType !== 'PROCEDURE' && normalizedObjectType !== 'FUNCTION') {
      throw new HttpError(400, 'objectType must be TABLE, VIEW, PROCEDURE, or FUNCTION.');
    }

    const normalizedObjectName = String(objectName || '').trim();
    if (!normalizedObjectName) {
      throw new HttpError(400, 'objectName is required.');
    }

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === normalizedId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema introspection is unavailable.');
    }

    const items = await listDataSourceObjectFields(
      this.deps.edgeDbQuery,
      source.type,
      normalizedObjectType,
      normalizedObjectName,
      {
        dataSourceId: source.id,
        database: source.database,
      },
    );

    return {
      body: {
        success: true as const,
        items,
      },
    };
  }

  async listObjectRelations(
    dataSourceId: string,
    objectType: SchemaObjectType,
    objectName: string,
  ) {
    const normalizedId = String(dataSourceId || '').trim();
    if (!normalizedId) {
      throw new HttpError(400, 'dataSourceId is required.');
    }

    const normalizedObjectType = String(objectType || '').trim().toUpperCase();
    if (normalizedObjectType !== 'TABLE' && normalizedObjectType !== 'VIEW') {
      throw new HttpError(400, 'objectType must be TABLE or VIEW.');
    }

    const normalizedObjectName = String(objectName || '').trim();
    if (!normalizedObjectName) {
      throw new HttpError(400, 'objectName is required.');
    }

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === normalizedId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema introspection is unavailable.');
    }

    const data = await listDataSourceObjectRelations(
      this.deps.edgeDbQuery,
      source.type,
      normalizedObjectType,
      normalizedObjectName,
      {
        dataSourceId: source.id,
        database: source.database,
      },
    );

    return {
      body: {
        success: true as const,
        data,
      },
    };
  }

  async addForeignKeyConstraint(input: Record<string, unknown>) {
    const parsed = addForeignKeyConstraintInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid add foreign-key payload.');
    }

    const {
      dataSourceId,
      tableName,
      columnName,
      referencedTable,
      referencedColumn,
      constraintName,
      onDelete,
      onUpdate,
    } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema alteration is unavailable.');
    }

    const resolvedConstraintName = constraintName?.trim()
      || suggestForeignKeyConstraintName(tableName, columnName);

    let statement: string;
    try {
      statement = buildAddForeignKeyStatement(source.type, {
        tableName,
        columnName,
        referencedTable,
        referencedColumn,
        constraintName: resolvedConstraintName,
        onDelete,
        onUpdate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid foreign-key definition.';
      throw new HttpError(400, message);
    }

    try {
      await this.deps.edgeDbQuery(statement, [], { dataSourceId: source.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add foreign-key constraint.';
      throw new HttpError(400, message);
    }

    return {
      body: {
        success: true as const,
        tableName,
        constraintName: resolvedConstraintName,
        columnName,
        referencedTable,
        referencedColumn,
      },
    };
  }

  async dropForeignKeyConstraint(input: Record<string, unknown>) {
    const parsed = dropForeignKeyConstraintInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid drop foreign-key payload.');
    }

    const { dataSourceId, tableName, constraintName } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema alteration is unavailable.');
    }

    let statement: string;
    try {
      statement = buildDropForeignKeyStatement(source.type, {
        tableName,
        constraintName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid foreign-key drop request.';
      throw new HttpError(400, message);
    }

    try {
      await this.deps.edgeDbQuery(statement, [], { dataSourceId: source.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to drop foreign-key constraint.';
      throw new HttpError(400, message);
    }

    return {
      body: {
        success: true as const,
        tableName,
        constraintName,
      },
    };
  }

  async createSchemaObject(input: Record<string, unknown>) {
    const parsed = createSchemaObjectInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid create schema object payload.');
    }

    const {
      dataSourceId,
      objectName,
      objectType,
      functionKind,
      sql,
    } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema object creation is unavailable.');
    }

    const statement = sql?.trim()
      ? assertCreateSchemaSql(sql)
      : buildCreateSchemaObjectStatement(source.type, {
        objectName: assertSchemaObjectName(objectName ?? ''),
        objectType,
        functionKind,
      });

    try {
      await this.deps.edgeDbQuery(statement, [], { dataSourceId: source.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create schema object.';
      throw new HttpError(400, message);
    }

    return {
      body: {
        success: true as const,
        objectName: objectName?.trim() || null,
        objectType,
        functionKind: functionKind ?? null,
      },
    };
  }

  async getSchemaObjectDeletePreview(query: Record<string, unknown>) {
    const parsed = deleteSchemaObjectPreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid delete preview query.');
    }

    const {
      dataSourceId,
      objectName,
      objectType,
    } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema introspection is unavailable.');
    }

    const context = {
      dataSourceId: source.id,
      database: source.database,
    };

    const fields = await listDataSourceObjectFields(
      this.deps.edgeDbQuery,
      source.type,
      objectType,
      objectName,
      context,
    );

    const rowCount = await countSchemaObjectRows(
      this.deps.edgeDbQuery,
      source.type,
      objectType,
      objectName,
      context,
    );

    const previewFieldLimit = 8;
    const relationImpact = (
      objectType === 'TABLE' || objectType === 'VIEW'
    )
      ? (() => {
        const impact = collectEdgeModelDeleteRelationImpact({
          dataSourceId: source.id,
          objectName,
          objectType,
        });
        return {
          edgeModelId: impact.edgeModelId,
          outboundLogicalCount: impact.outboundLogicalCount,
          outboundAliases: impact.outboundAliases,
          inboundRefs: impact.inboundRefs.map((ref) => ({
            peerObjectName: ref.peerObjectName,
            as: ref.as,
            kind: ref.kind,
            role: ref.role,
          })),
          willParkStudioMeta: impact.willParkStudioMeta,
        };
      })()
      : null;

    const preview: SchemaObjectDeletePreview = {
      rowCount,
      totalFieldCount: fields.length,
      fields: fields.slice(0, previewFieldLimit).map((field) => ({
        name: field.name,
        dataType: field.dataType,
        isPrimaryKey: field.isPrimaryKey,
      })),
      relationImpact,
    };

    return {
      body: {
        success: true as const,
        preview,
      },
    };
  }

  async deleteSchemaObject(input: Record<string, unknown>) {
    const parsed = deleteSchemaObjectInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid delete schema object payload.');
    }

    const {
      dataSourceId,
      objectName,
      objectType,
    } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema object deletion is unavailable.');
    }

    const statement = buildDropSchemaObjectStatement(source.type, {
      objectName,
      objectType,
      functionKind: parsed.data.functionKind,
    });

    try {
      await this.deps.edgeDbQuery(statement, [], { dataSourceId: source.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete schema object.';
      throw new HttpError(400, message);
    }

    if (objectType === 'TABLE' || objectType === 'VIEW') {
      cleanupEdgeModelsForDeletedSchemaObject({
        dataSourceId: source.id,
        objectName,
        objectType,
      });
    }

    return {
      body: {
        success: true as const,
        objectName,
        objectType,
        functionKind: parsed.data.functionKind ?? null,
      },
    };
  }

  async truncateSchemaObject(input: Record<string, unknown>) {
    const parsed = truncateSchemaObjectInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid truncate schema object payload.');
    }

    const { dataSourceId, objectName } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema object truncation is unavailable.');
    }

    let statement: string;
    try {
      statement = buildTruncateTableStatement(source.type, { objectName });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid truncate request.';
      throw new HttpError(400, message);
    }

    try {
      await this.deps.edgeDbQuery(statement, [], { dataSourceId: source.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to truncate table.';
      throw new HttpError(400, message);
    }

    // Truncate bypasses Data API write ops — clear list/detail GET caches or CMS keeps old rows.
    await invalidateDataApiCachesForSchemaObject({
      dataSourceId: source.id,
      objectName,
    });

    return {
      body: {
        success: true as const,
        objectName,
        objectType: 'TABLE' as const,
      },
    };
  }

  async getSchemaObjectDefinition(query: Record<string, unknown>) {
    const parsed = schemaObjectDefinitionQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid schema object definition query.');
    }

    const {
      dataSourceId,
      objectName,
      objectType,
      functionKind,
    } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema introspection is unavailable.');
    }

    const definition = await getDataSourceObjectDefinition(
      this.deps.edgeDbQuery,
      source.type,
      objectType,
      objectName,
      {
        dataSourceId: source.id,
        database: source.database,
        functionKind,
      },
    );

    if (!definition) {
      throw new HttpError(404, 'Schema object definition was not found.');
    }

    return {
      body: {
        success: true as const,
        definition,
        objectName,
        objectType,
        functionKind: functionKind ?? null,
      },
    };
  }

  async getSchemaObjectDependencies(query: Record<string, unknown>) {
    const parsed = schemaObjectDependenciesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid schema object dependencies query.');
    }

    const {
      dataSourceId,
      objectName,
      objectType,
      functionKind,
    } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema introspection is unavailable.');
    }

    const dependencies = await listDataSourceObjectDependencies(
      this.deps.edgeDbQuery,
      source.type,
      objectType,
      objectName,
      {
        dataSourceId: source.id,
        database: source.database,
        functionKind,
      },
    );

    return {
      body: {
        success: true as const,
        dependencies,
        objectName,
        objectType,
        functionKind: functionKind ?? null,
      },
    };
  }

  async updateSchemaObjectDefinition(input: Record<string, unknown>) {
    const parsed = updateSchemaObjectDefinitionInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid update schema object definition payload.');
    }

    const {
      dataSourceId,
      objectType,
      functionKind,
      sql,
    } = parsed.data;

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Schema object update is unavailable.');
    }

    const statement = assertAlterSchemaSql(sql);

    try {
      await this.deps.edgeDbQuery(statement, [], { dataSourceId: source.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update schema object definition.';
      throw new HttpError(400, message);
    }

    return {
      body: {
        success: true as const,
        objectType,
        functionKind: functionKind ?? null,
      },
    };
  }

  async executeDataSourceQuery(input: Record<string, unknown>) {
    const parsed = executeDataSourceQueryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid execute query payload.');
    }

    const { dataSourceId, sql, allowWrite } = parsed.data;
    const validation = validateExecuteDataSourceSql(sql, { allowWrite });
    if (!validation.ok) {
      throw new HttpError(400, validation.reason);
    }

    const sources = getDataSourcesFromSettings(this.deps.settingsPath);
    const source = sources.find((item) => item.id === dataSourceId);
    if (!source) {
      throw new HttpError(404, 'Data source not found.');
    }

    if (!this.deps.edgeDbQuery) {
      throw new HttpError(500, 'Query execution is unavailable.');
    }

    try {
      const queryResult = await this.deps.edgeDbQuery(
        sql.trim(),
        [],
        { dataSourceId: source.id, database: source.database },
      );
      const rawRows = Array.isArray(queryResult.data) ? queryResult.data : [];
      const { rows, truncated } = truncateDataSourceQueryResult(rawRows);

      return {
        body: {
          success: true as const,
          data: rows,
          count: rows.length,
          truncated,
          source: queryResult.source ?? {
            id: source.id,
            name: source.name,
            type: source.type,
          },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute query.';
      throw new HttpError(400, message);
    }
  }
}
