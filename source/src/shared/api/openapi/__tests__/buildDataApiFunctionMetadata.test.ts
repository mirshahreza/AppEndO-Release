import { describe, expect, it } from 'vitest';
import type { EdgeApiDefinition, EdgeApiOperation, EdgeModelDefinition } from '../../contracts/data-api';
import {
  buildDataApiManagedFunctionMetadata,
  buildDataApiManagedFunctionTestPayload,
  buildDataApiOpenApiHints,
  buildDataApiRequestExample,
} from '../buildDataApiFunctionMetadata';
import { buildDataApiOpenApiOperation } from '../buildDataApiOpenApi';

const sampleModel: EdgeModelDefinition = {
  id: 'model_users',
  dataSourceId: 'ds_local',
  schema: null,
  objectName: 'users',
  objectType: 'TABLE',
  sequelize: {
    modelName: 'Users',
    tableName: 'users',
  },
  columns: [
    {
      name: 'id',
      field: 'id',
      dataType: 'INTEGER',
      sequelizeType: 'INTEGER',
      allowNull: false,
      isPrimaryKey: true,
      isForeignKey: false,
    },
    {
      name: 'email',
      field: 'email',
      dataType: 'TEXT',
      sequelizeType: 'STRING',
      allowNull: false,
      isPrimaryKey: false,
      isForeignKey: false,
    },
  ],
  primaryKey: 'id',
  associations: [],
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: 'Users' },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const sampleDefinition = (
  operation: EdgeApiOperation,
  overrides: Partial<EdgeApiDefinition> = {},
): EdgeApiDefinition => ({
  id: 'def_users_list',
  edgeModelId: 'model_users',
  key: 'list',
  label: 'List Users',
  basePath: '/api/users/list',
  operations: [operation],
  accessControl: {
    accessMode: 'authenticated',
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
  openapi: { tags: ['Data API', 'Users'] },
  publishedAt: null,
  version: 1,
  runtime: {
    useGlobalConfig: true,
    enableLogs: true,
    cacheEnabled: false,
  },
  ...overrides,
});

describe('buildDataApiFunctionMetadata', () => {
  it('builds openapi hints and derived metadata for list operations', () => {
    const operation: EdgeApiOperation = {
      id: 'op_list',
      method: 'GET',
      kind: 'list',
      pathPattern: '/api/users/list',
      enabled: true,
      fields: { read: ['id', 'email'] },
      query: {
        allowFilter: true,
        allowSort: true,
        maxPageSize: 100,
        defaultPageSize: 20,
      },
    };
    const definition = sampleDefinition(operation);
    const code = 'export default async function handler() { return { success: true }; }';
    const metadata = JSON.parse(buildDataApiManagedFunctionMetadata(definition, operation, sampleModel, code));

    expect(metadata.origin).toBe('data-api');
    expect(metadata.openapi.summary).toBe('List Users · list');
    expect(metadata.openapi.tags).toEqual(['Data API', 'Users']);
    expect(metadata.derived.docHints.outputFields).toEqual(['id', 'email']);
    expect(metadata.derived.requestExample.query).toMatchObject({ page: 1, pageSize: 20, includeCount: true });
    expect(metadata.derived.docHints.queryFields).toContain('includeCount');
    expect(buildDataApiManagedFunctionTestPayload(operation, sampleModel)).toContain('"page": 1');
  });

  it('builds request examples for write operations', () => {
    const operation: EdgeApiOperation = {
      id: 'op_create',
      method: 'POST',
      kind: 'create',
      pathPattern: '/api/users/list',
      enabled: true,
      fields: {
        write: ['email'],
        required: ['email'],
      },
    };

    expect(buildDataApiRequestExample(operation, sampleModel, operation.pathPattern)).toEqual({
      body: { email: 'sample' },
    });
  });

  it('feeds OpenAPI operation generation with field schemas', () => {
    const operation: EdgeApiOperation = {
      id: 'op_list',
      method: 'GET',
      kind: 'list',
      pathPattern: '/api/users/list',
      enabled: true,
      fields: { read: ['id', 'email'] },
      query: {
        allowFilter: true,
        allowSort: true,
        maxPageSize: 100,
        defaultPageSize: 20,
      },
    };
    const definition = sampleDefinition(operation);
    const metadata = buildDataApiManagedFunctionMetadata(
      definition,
      operation,
      sampleModel,
      'export default async function handler() { return { success: true }; }',
    );

    const openApiOperation = buildDataApiOpenApiOperation(
      {
        id: 'kkkkkkk.list',
        name: 'list',
        folder: 'kkkkkkk',
        method: 'GET',
        path: '/api/users/list',
        engine_type: 'DATA_API',
        metadata_json: metadata,
      },
      JSON.parse(metadata),
    );

    expect(openApiOperation.summary).toBe('List Users · list');
    expect(openApiOperation.tags).toEqual(['Data API', 'Users']);
    const responseSchema = (
      (openApiOperation.responses as Record<string, Record<string, unknown>>)['200']
        .content as Record<string, Record<string, unknown>>
    )['application/json'].schema as Record<string, unknown>;
    const dataSchema = (responseSchema.properties as Record<string, unknown>).data as Record<string, unknown>;
    expect((dataSchema.items as Record<string, unknown>).properties).toMatchObject({
      id: { type: 'string' },
      email: { type: 'string' },
    });
  });

  it('uses object label fallback tags when definition tags are empty', () => {
    const operation: EdgeApiOperation = {
      id: 'op_list',
      method: 'GET',
      kind: 'list',
      pathPattern: '/api/users/list',
      enabled: true,
    };
    const hints = buildDataApiOpenApiHints(
      sampleDefinition(operation, { openapi: { tags: [] } }),
      operation,
      sampleModel,
    );

    expect(hints.tags).toEqual(['Data API', 'Users']);
  });
});
