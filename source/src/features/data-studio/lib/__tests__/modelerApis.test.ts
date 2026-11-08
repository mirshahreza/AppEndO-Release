import { describe, expect, it } from 'vitest';
import type { EdgeApiDefinition } from '../../../../shared/api/contracts/data-api';
import type { ServerFunctionItem } from '../../../../shared/api/contracts/server-functions/types';
import { listModelerApisForObject } from '../modelerApis';

const sampleDefinition = (overrides: Partial<EdgeApiDefinition> = {}): EdgeApiDefinition => ({
  id: 'ea_logs',
  edgeModelId: 'em_logs',
  key: 'extra-logs',
  label: 'Extra Logs Feed',
  basePath: '/api/extra-logs',
  operations: [{
    id: 'op_list',
    method: 'GET',
    kind: 'list',
    pathPattern: '/api/extra-logs',
    enabled: true,
  }],
  accessControl: {
    accessMode: 'authenticated',
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
  openapi: { tags: [] },
  publishedAt: '2026-09-01T00:00:00.000Z',
  version: 1,
  runtime: { useGlobalConfig: true },
  ...overrides,
});

const sampleFunction = (overrides: Partial<ServerFunctionItem>): ServerFunctionItem => ({
  id: 'fn-1',
  name: 'list-users',
  folder: 'users',
  method: 'GET',
  path: '/api/users',
  code: '',
  testPayload: '{}',
  memoryLimit: 128,
  timeoutMs: 5000,
  runtimeVersion: 'v20.x',
  useGlobalConfig: true,
  enableLogs: false,
  accessControl: {
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
  ...overrides,
});

describe('listModelerApisForObject', () => {
  it('lists every platform operation on base_logs_app', () => {
    const rows = listModelerApisForObject('base_logs_app', 'em_logs', []);
    expect(rows.some((row) => row.method === 'GET' && row.path === '/api/logs')).toBe(true);
    expect(rows.some((row) => row.method === 'GET' && row.path === '/api/logs/:id')).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('merges Data API operations with platform routes', () => {
    const rows = listModelerApisForObject('base_logs_app', 'em_logs', [sampleDefinition()]);
    expect(rows.some((row) => row.source === 'data-api' && row.path === '/api/extra-logs')).toBe(true);
    expect(rows.some((row) => row.path === '/api/logs')).toBe(true);
  });

  it('reattaches a Data API when functions still name the object after a model-id remap', () => {
    const rows = listModelerApisForObject(
      'cms_contents',
      'em_new',
      [sampleDefinition({
        id: 'ea_cms',
        edgeModelId: 'em_old',
        label: 'CMS Contents',
        basePath: '/api/cms/contents',
        operations: [{
          id: 'op_list',
          method: 'GET',
          kind: 'list',
          pathPattern: '/api/cms/contents',
          enabled: true,
        }],
      })],
      [],
      [sampleFunction({
        id: 'fn-cms-list',
        name: 'cms-contents-list',
        path: '/api/cms/contents',
        metadataJson: {
          model: { objectName: 'cms_contents' },
          edgeApiDefinitionId: 'ea_cms',
        } as never,
      })],
    );
    expect(rows).toEqual([
      expect.objectContaining({ source: 'data-api', path: '/api/cms/contents' }),
    ]);
  });

  it('includes built-in functions whose path belongs to the object', () => {
    const rows = listModelerApisForObject(
      'base_users',
      'em_users',
      [],
      [],
      [
        sampleFunction({ id: 'fn-users-list', name: 'users-list', path: '/api/users' }),
        sampleFunction({
          id: 'fn-settings',
          name: 'settings-get',
          path: '/api/settings',
          method: 'GET',
        }),
      ],
    );
    expect(rows.some((row) => row.path === '/api/users' && row.source === 'function')).toBe(true);
    expect(rows.some((row) => row.path === '/api/settings')).toBe(false);
  });

  it('includes DATA_API functions by metadata objectName even without a catalog prefix', () => {
    const rows = listModelerApisForObject(
      'cms_contents',
      'em_cms',
      [],
      [],
      [sampleFunction({
        id: 'fn-cms-list',
        name: 'cms-contents-list',
        path: '/api/cms/contents',
        metadataJson: {
          model: { objectName: 'cms_contents' },
          edgeApiDefinitionId: 'ea_cms',
        } as never,
      })],
    );
    expect(rows).toEqual([
      expect.objectContaining({ source: 'function', path: '/api/cms/contents' }),
    ]);
  });

  it('attaches the built-in function so Design API can open from the modeler', () => {
    const fn = sampleFunction({
      id: 'fn-profile-put',
      name: 'update-profile',
      method: 'PUT',
      path: '/api/profile',
      isBuiltIn: true,
    });
    const rows = listModelerApisForObject('base_user_profiles', 'em_profiles', [], [], [fn]);
    expect(rows).toContainEqual(expect.objectContaining({
      source: 'function',
      method: 'PUT',
      path: '/api/profile',
      function: fn,
    }));
  });
});
