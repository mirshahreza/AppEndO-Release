import { describe, expect, it } from 'vitest';
import type { EdgeApiDefinition, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import {
  defaultEdgeApiAccessControl,
  defaultEdgeApiRuntimeSettings,
} from '../../../../shared/api/contracts/data-api';
import {
  buildConfigureDataApiDefinitionPayload,
  buildConfigureDataApiOperation,
  buildConfigureDataApiPath,
  collectReservedApiNameSlugsForObject,
  createDefaultConfigureDataApiFormState,
  deriveDataApiKey,
  deriveObjectFolderSlug,
  suggestConfigureDataApiName,
  excludeDefinitionApiNameSlugsFromReserved,
  validateConfigureDataApiName,
} from '../configureDataApi';

const sampleModel: EdgeModelDefinition = {
  id: 'model_users',
  dataSourceId: 'ds_local',
  schema: null,
  objectName: 'dbo.Users',
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

describe('configureDataApi', () => {
  it('derives object folder slug from schema-qualified object name', () => {
    expect(deriveObjectFolderSlug('dbo.Users')).toBe('users');
  });

  // SEA-4.1: a new definition's form state must start from the same secure defaults
  // the server seeds on publish (edgeApiPublisher.ts), so the Access/Runtime & Cache/Hooks
  // tabs have real values to show and edit before the first save.
  it('seeds default accessControl/runtime on a new form state', () => {
    const state = createDefaultConfigureDataApiFormState('TABLE', [], 'id', sampleModel);
    expect(state.accessControl).toEqual(defaultEdgeApiAccessControl());
    expect(state.runtime).toEqual(defaultEdgeApiRuntimeSettings());
    expect(state.changeReason.reasonAsk).toBe('off');
  });

  it('builds collection route as /api/object/api-name', () => {
    expect(buildConfigureDataApiPath('users', 'active-list', 'GET_LIST', 'id'))
      .toBe('/api/users/active-list');
  });

  it('builds by-key route with primary key segment', () => {
    expect(buildConfigureDataApiPath('users', 'get-one', 'GET_ONE', 'id'))
      .toBe('/api/users/get-one/:id');
  });

  it('derives api key from the user-facing api name only', () => {
    expect(deriveDataApiKey('users', 'active-list')).toBe('active-list');
  });

  it('does not attach write fields to list operations', () => {
    const operation = buildConfigureDataApiOperation(
      'users',
      'TABLE',
      {
        apiName: 'list',
        model: 'GET_LIST',
        outputFields: ['email'],
        inputFields: [{ id: 'f2', name: 'email', type: 'string', required: true }],
      },
      'id',
      sampleModel,
    );

    expect(operation.method).toBe('GET');
    expect(operation.kind).toBe('list');
    expect(operation.fields?.read).toEqual(['email']);
    expect(operation.fields?.write).toBeUndefined();
    expect(operation.fields?.required).toBeUndefined();
  });

  it('builds a single operation with mapped write fields', () => {
    const operation = buildConfigureDataApiOperation(
      'users',
      'TABLE',
      {
        apiName: 'patch-email',
        model: 'PATCH',
        outputFields: [],
        inputFields: [{ id: 'f1', name: 'email', type: 'string', required: true }],
        clientContextFields: [{ id: 'installId', mode: 'record' }],
      },
      'id',
      sampleModel,
    );

    expect(operation.pathPattern).toBe('/api/users/patch-email/:id');
    expect(operation.method).toBe('PATCH');
    expect(operation.fields?.write).toEqual(['email']);
    expect(operation.clientContext?.fields).toEqual([{ id: 'installId', mode: 'record' }]);
  });

  it('suggests model-based api names and avoids reserved slugs', () => {
    expect(suggestConfigureDataApiName('GET_LIST', [])).toBe('list');
    expect(suggestConfigureDataApiName('POST', ['create'])).toBe('create-2');
    expect(suggestConfigureDataApiName('PATCH', ['patch', 'patch-2'])).toBe('patch-3');
  });

  it('collects reserved api slugs from definitions and route paths', () => {
    const definitions: EdgeApiDefinition[] = [{
      id: 'def_1',
      edgeModelId: 'model_users',
      key: 'list',
      label: 'List',
      basePath: '/api/users/list',
      operations: [{
        id: 'op_list',
        method: 'GET',
        kind: 'list',
        pathPattern: '/api/users/list',
        enabled: true,
      }],
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
      runtime: {
        useGlobalConfig: true,
        enableLogs: true,
        cacheEnabled: false,
      },
    }];

    expect(collectReservedApiNameSlugsForObject(
      'users',
      'model_users',
      definitions,
      ['/api/users/custom-route'],
    )).toEqual(['custom-route', 'list']);
  });

  it('ignores published definitions whose managed function was removed', () => {
    const definitions: EdgeApiDefinition[] = [{
      id: 'def_1',
      edgeModelId: 'model_users',
      key: 'list',
      label: 'List',
      basePath: '/api/users/list',
      operations: [{
        id: 'op_list',
        method: 'GET',
        kind: 'list',
        pathPattern: '/api/users/list',
        enabled: true,
      }],
      accessControl: {
        accessMode: 'authenticated',
        allowRoles: [],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
      openapi: { tags: ['Data API'] },
      publishedAt: '2026-01-01T00:00:00.000Z',
      version: 1,
      runtime: {
        useGlobalConfig: true,
        enableLogs: true,
        cacheEnabled: false,
      },
      managedFunctionId: 'data-api.users-list',
    }, {
      id: 'def_2',
      edgeModelId: 'model_users',
      key: 'list-2',
      label: 'List 2',
      basePath: '/api/users/list-2',
      operations: [{
        id: 'op_list_2',
        method: 'GET',
        kind: 'list',
        pathPattern: '/api/users/list-2',
        enabled: true,
      }],
      accessControl: {
        accessMode: 'authenticated',
        allowRoles: [],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
      openapi: { tags: ['Data API'] },
      publishedAt: '2026-01-01T00:00:00.000Z',
      version: 1,
      runtime: {
        useGlobalConfig: true,
        enableLogs: true,
        cacheEnabled: false,
      },
      managedFunctionId: 'data-api.users-list-2',
    }];

    expect(collectReservedApiNameSlugsForObject(
      'users',
      'model_users',
      definitions,
      [],
      { activeManagedFunctionIds: new Set() },
    )).toEqual([]);

    expect(collectReservedApiNameSlugsForObject(
      'users',
      'model_users',
      definitions,
      [],
      { activeManagedFunctionIds: new Set(['data-api.users-list']) },
    )).toEqual(['list']);
  });

  it('keeps unpublished drafts reserved even without a managed function', () => {
    const definitions: EdgeApiDefinition[] = [{
      id: 'def_draft',
      edgeModelId: 'model_users',
      key: 'list',
      label: 'List',
      basePath: '/api/users/list',
      operations: [{
        id: 'op_list',
        method: 'GET',
        kind: 'list',
        pathPattern: '/api/users/list',
        enabled: true,
      }],
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
      runtime: {
        useGlobalConfig: true,
        enableLogs: true,
        cacheEnabled: false,
      },
    }];

    expect(collectReservedApiNameSlugsForObject(
      'users',
      'model_users',
      definitions,
      [],
      { activeManagedFunctionIds: new Set() },
    )).toEqual(['list']);
  });

  it('ignores orphaned data-api server functions when definitions were deleted', () => {
    expect(collectReservedApiNameSlugsForObject(
      'users',
      'model_users',
      [],
      [{
        path: '/api/users/list',
        engineType: 'DATA_API',
        metadataJson: { origin: 'data-api', edgeApiDefinitionId: 'def_deleted' },
      }, {
        path: '/api/users/list-2',
        engineType: 'DATA_API',
        metadataJson: { origin: 'data-api' },
      }],
    )).toEqual([]);

    expect(collectReservedApiNameSlugsForObject(
      'users',
      'model_users',
      [],
      [{
        path: '/api/users/manual-route',
        engineType: 'SANDBOX_JS',
      }],
    )).toEqual(['manual-route']);
  });

  it('excludes the editing definition slugs from reserved api names', () => {
    const definition: EdgeApiDefinition = {
      id: 'def_users',
      edgeModelId: 'model_users',
      key: 'list',
      label: 'List',
      basePath: '/api/users/list',
      operations: [{
        id: 'op_list',
        method: 'GET',
        kind: 'list',
        pathPattern: '/api/users/list',
        enabled: true,
      }],
      accessControl: {
        accessMode: 'authenticated',
        allowRoles: [],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
      openapi: { tags: ['Users'] },
      publishedAt: '2026-01-01T00:00:00.000Z',
      version: 1,
      runtime: { useGlobalConfig: true },
    };

    expect(excludeDefinitionApiNameSlugsFromReserved(
      'users',
      definition,
      ['list', 'other'],
    )).toEqual(['other']);
  });

  it('validates duplicate api names unless republishing the same key', () => {
    expect(validateConfigureDataApiName('list', {
      reservedNames: ['list'],
      objectName: 'users',
    })).toBe('An API with this name already exists in this folder.');

    expect(validateConfigureDataApiName('list', {
      reservedNames: ['list'],
      objectName: 'users',
      republishingKey: 'list',
    })).toBeNull();
  });

  it('stores change-reason policy on the definition, not on operations', () => {
    const off = createDefaultConfigureDataApiFormState('TABLE', [], 'id', sampleModel);
    expect(buildConfigureDataApiDefinitionPayload('users', { ...off, apiName: 'list' }).changeReason)
      .toBeUndefined();

    const required = buildConfigureDataApiDefinitionPayload('users', {
      ...off,
      apiName: 'patch',
      changeReason: {
        reasonAsk: 'required',
        reasonCapture: 'both',
        reasonVocabNodeId: '100.6.20',
        reasonIncludeGeneral: false,
      },
    });
    expect(required.changeReason).toEqual({
      reasonAsk: 'required',
      reasonCapture: 'both',
      reasonVocabNodeId: '100.6.20',
      reasonIncludeGeneral: false,
    });
  });
});
