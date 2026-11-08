import { describe, expect, it } from 'vitest';
import { defaultEdgeApiAccessControl } from '../../../../shared/api/contracts/data-api';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import {
  buildRouteEntryPath,
  requiresRouteVariant,
} from '../dataApiRouteMethods';
import {
  buildEdgeApiOperationsFromEnabledOptions,
  buildEdgeApiOperationsFromWizard,
  createDefaultEnabledOptions,
  createDefaultRoutes,
  createInitialDataApiWizardState,
  routesFromExistingOperations,
  type DataApiWizardRouteEntry,
} from '../dataApiWizard';

const sampleColumns = [
  {
    name: 'id',
    dataType: 'INTEGER',
    suggestedFieldType: 'integer' as const,
    nullable: false,
    isPrimaryKey: true,
  },
  {
    name: 'email',
    dataType: 'TEXT',
    suggestedFieldType: 'string' as const,
    nullable: false,
    isPrimaryKey: false,
  },
  {
    name: 'display_name',
    dataType: 'TEXT',
    suggestedFieldType: 'string' as const,
    nullable: true,
    isPrimaryKey: false,
  },
];

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
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: 'Users' },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('dataApiWizard', () => {
  it('limits view presets to read operations', () => {
    const enabled = createDefaultEnabledOptions('VIEW', 'readOnly');
    expect(enabled.GET_LIST).toBe(true);
    expect(enabled.GET_ONE).toBe(true);
    expect(enabled.GET_LOOKUP).toBe(false);
    expect(enabled.POST).toBe(false);
    expect(enabled.DELETE).toBe(false);
    expect(enabled.POST_PIVOT).toBe(false);
  });

  it('builds a one-click lookup preset with only GET_LOOKUP', () => {
    const enabled = createDefaultEnabledOptions('TABLE', 'lookup');
    expect(enabled.GET_LOOKUP).toBe(true);
    expect(enabled.GET_LIST).toBe(false);
    expect(enabled.GET_ONE).toBe(false);
    expect(enabled.POST).toBe(false);

    const routes = createDefaultRoutes('TABLE', sampleColumns, 'id', 'users', 'lookup');
    expect(routes).toHaveLength(1);
    expect(routes[0]?.option).toBe('GET_LOOKUP');

    const operations = buildEdgeApiOperationsFromWizard('TABLE', routes, 'id', sampleModel);
    expect(operations).toHaveLength(1);
    expect(operations[0]?.kind).toBe('lookup');
    expect(operations[0]?.pathPattern).toContain('/by-');
  });

  it('builds enabled operations for table collections', () => {
    const state = createInitialDataApiWizardState(
      'widgets',
      'TABLE',
      defaultEdgeApiAccessControl(),
      sampleColumns,
      'id',
    );
    const operations = buildEdgeApiOperationsFromWizard(
      'TABLE',
      state.routes,
      'id',
      sampleModel,
    );
    expect(operations.length).toBeGreaterThanOrEqual(5);
    expect(operations.every((operation) => operation.enabled)).toBe(true);
    expect(operations.map((operation) => operation.pathPattern)).toContain('/api/widgets');
    expect(operations.map((operation) => operation.pathPattern)).toContain('/api/widgets/:id');
  });

  it('supports multiple PATCH routes with distinct paths', () => {
    const routes: DataApiWizardRouteEntry[] = [
      {
        id: 'route-patch-email',
        option: 'PATCH',
        folder: 'users',
        pathName: 'users',
        fields: [{ id: 'f1', name: 'email', type: 'string', required: true }],
      },
      {
        id: 'route-patch-display',
        option: 'PATCH',
        folder: 'users',
        pathName: 'patch-display',
        fields: [{ id: 'f2', name: 'display_name', type: 'string', required: false }],
      },
    ];

    const operations = buildEdgeApiOperationsFromWizard(
      'TABLE',
      routes,
      'id',
      sampleModel,
    );

    expect(operations).toHaveLength(2);
    expect(operations.map((operation) => operation.pathPattern)).toEqual([
      '/api/users/:id',
      '/api/users/patch-display/:id',
    ]);
    expect(new Set(operations.map((operation) => operation.pathPattern)).size).toBe(2);
    expect(operations[0].fields?.write).toEqual(['email']);
    expect(operations[1].fields?.write).toEqual(['displayName']);
  });

  it('restores folder and pathName from existing operations', () => {
    const operations = buildEdgeApiOperationsFromWizard(
      'TABLE',
      [
        {
          id: 'route-get-summary',
          option: 'GET_ONE',
          folder: 'users',
          pathName: 'summary',
          outputFields: ['email'],
        },
      ],
      'id',
      sampleModel,
    );

    const routes = routesFromExistingOperations(operations, '/api/users', 'TABLE', sampleModel);
    expect(routes).toHaveLength(1);
    expect(routes[0].folder).toBe('users');
    expect(routes[0].pathName).toBe('summary');
    expect(routes[0].outputFields).toEqual(['email']);
  });

  it('keeps backward-compatible enabled-options builder', () => {
    const state = createInitialDataApiWizardState('widgets', 'TABLE', defaultEdgeApiAccessControl());
    const enabled = createDefaultEnabledOptions('TABLE', 'collection');
    const operations = buildEdgeApiOperationsFromEnabledOptions(
      state.basePath,
      'TABLE',
      enabled,
    );
    expect(operations.length).toBeGreaterThanOrEqual(5);
  });
});

describe('dataApiRouteMethods', () => {
  it('requires a variant for duplicate methods in the same folder', () => {
    const routes = [{ option: 'PATCH' as const, folder: 'users' }];
    expect(requiresRouteVariant(routes, 'PATCH', 'users')).toBe(true);
  });

  it('builds variant paths from folder and path name', () => {
    const path = buildRouteEntryPath('users', 'patch-email', 'PATCH', 'TABLE', 'id');
    expect(path).toBe('/api/users/patch-email/:id');
  });

  it('builds GET_ONE view query paths', () => {
    const path = buildRouteEntryPath('users', 'summary', 'GET_ONE', 'TABLE', 'id');
    expect(path).toBe('/api/users/:id?view=summary');
  });

  it('seeds default routes for a full collection', () => {
    const routes = createDefaultRoutes('TABLE', sampleColumns, 'id', 'users', 'collection');
    expect(routes.some((route) => route.option === 'PATCH')).toBe(true);
    expect(routes.some((route) => route.option === 'GET_LIST')).toBe(true);
    expect(routes.every((route) => route.folder === 'users')).toBe(true);
  });
});
