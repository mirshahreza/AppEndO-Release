import { describe, expect, it } from 'vitest';
import type { EdgeApiDefinition } from '../../api/contracts/data-api';
import {
  buildDataApiManagedFunctionFolder,
  buildDataApiManagedFunctionName,
  deriveConfigureDataApiKey,
  extractApiSlugFromBasePath,
} from '../dataApiManagedFunctions';

const sampleDefinition = (
  overrides: Partial<EdgeApiDefinition> = {},
): EdgeApiDefinition => ({
  id: 'def_1',
  edgeModelId: 'model_1',
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
  ...overrides,
});

describe('dataApiManagedFunctions', () => {
  it('derives configure api key from api name only', () => {
    expect(deriveConfigureDataApiKey('active-list')).toBe('active-list');
  });

  it('extracts api slug from base path', () => {
    expect(extractApiSlugFromBasePath('/api/users/list')).toBe('list');
  });

  it('uses the user api slug as the published function name', () => {
    const definition = sampleDefinition();
    expect(buildDataApiManagedFunctionName(definition, definition.operations[0])).toBe('list');
  });

  it('prefers the definition key over the route slug for the function name', () => {
    const definition = sampleDefinition({
      key: 'active-list',
      basePath: '/api/users/active-list',
      operations: [{
        id: 'op_list',
        method: 'GET',
        kind: 'list',
        pathPattern: '/api/users/active-list',
        enabled: true,
      }],
    });

    expect(buildDataApiManagedFunctionName(definition, definition.operations[0])).toBe('active-list');
  });

  it('does not duplicate list in list-list when route slug matches operation kind', () => {
    const definition = sampleDefinition({
      key: 'list',
      operations: [
        {
          id: 'op_list',
          method: 'GET',
          kind: 'list',
          pathPattern: '/api/users/list',
          enabled: true,
        },
        {
          id: 'op_get_one',
          method: 'GET',
          kind: 'getOne',
          pathPattern: '/api/users/list/:id',
          enabled: true,
        },
      ],
    });

    expect(buildDataApiManagedFunctionName(definition, definition.operations[0])).toBe('list');
    expect(buildDataApiManagedFunctionName(definition, definition.operations[1])).toBe('list-getone');
  });

  it('scopes published functions under the object folder', () => {
    expect(buildDataApiManagedFunctionFolder('dbo.Users')).toBe('users');
    expect(buildDataApiManagedFunctionFolder('kkkkkkk')).toBe('kkkkkkk');
  });
});
