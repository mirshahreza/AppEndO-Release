import { describe, expect, it } from 'vitest';
import type { EdgeApiDefinition, EdgeApiOperation, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import { buildDefaultCollectionOperations } from '../../../../shared/lib/edgeApiOperations';
import { buildDataApiPublishedRouteCode } from '../dataApiRouteCodegen';

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
    {
      name: 'display_name',
      field: 'displayName',
      dataType: 'TEXT',
      sequelizeType: 'STRING',
      allowNull: true,
      isPrimaryKey: false,
      isForeignKey: false,
    },
  ],
  primaryKey: 'id',
  associations: [],
  schemaFingerprint: 'fp_users',
  readOnly: false,
  labels: { title: 'Users' },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const sampleDefinition = (
  operations: EdgeApiOperation[],
): EdgeApiDefinition => ({
  id: 'api_users',
  edgeModelId: sampleModel.id,
  key: 'users',
  label: 'Users',
  basePath: '/api/users',
  operations,
  accessControl: {
    accessMode: 'authenticated',
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
  openapi: { tags: ['Data API'] },
  publishedAt: null,
  version: 1,
  runtime: { useGlobalConfig: true },
});

describe('buildDataApiPublishedRouteCode', () => {
  it('generates Sequelize model handlers instead of db.query SQL', () => {
    const operations = buildDefaultCollectionOperations('/api/users');
    const listOperation = operations.find((operation) => operation.kind === 'list');
    expect(listOperation).toBeDefined();

    const code = buildDataApiPublishedRouteCode({
      definition: sampleDefinition(operations),
      operation: listOperation!,
      model: sampleModel,
    });

    expect(code).toContain('resolvePublishedEdgeModel');
    expect(code).toContain('resolveDataApiListIncludeCount');
    expect(code).toContain('Users.findAndCountAll');
    expect(code).toContain('Users.findAll');
    expect(code).not.toContain('WRITE_FIELDS');
    expect(code).not.toContain('REQUIRED_FIELDS');
    expect(code).not.toContain('db.query');
    expect(code).not.toContain('export {}');
    expect(code).toContain("from '@/server/services/data-api/dataApiQuery'");
    expect(code).toContain('Runtime engine: DATA_API (Sequelize DataApiExecutor)');
  });

  it('generates create handler with Model.create and writable field names', () => {
    const operations = buildDefaultCollectionOperations('/api/users');
    const createOperation = operations.find((operation) => operation.kind === 'create');
    expect(createOperation).toBeDefined();

    const code = buildDataApiPublishedRouteCode({
      definition: sampleDefinition(operations),
      operation: createOperation!,
      model: sampleModel,
    });

    expect(code).toContain('Users.create');
    expect(code).toContain('WRITE_FIELDS');
    expect(code).toContain('REQUIRED_FIELDS');
    expect(code).not.toContain('INSERT INTO');
  });

  it('generates getOne handler with Model.findOne and primary key resolver', () => {
    const operations = buildDefaultCollectionOperations('/api/users');
    const getOneOperation = operations.find((operation) => operation.kind === 'getOne');
    expect(getOneOperation).toBeDefined();

    const code = buildDataApiPublishedRouteCode({
      definition: sampleDefinition(operations),
      operation: getOneOperation!,
      model: sampleModel,
    });

    expect(code).toContain('Users.findOne');
    expect(code).toContain('resolvePrimaryKeyWhere');
  });
});
