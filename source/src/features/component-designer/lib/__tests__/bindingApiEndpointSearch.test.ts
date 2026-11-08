import { describe, expect, it } from 'vitest';
import {
  filterAccessibleApiRoutes,
  findAccessibleApiRouteMatch,
  normalizeApiEndpointPath,
} from '../bindingApiEndpointSearch';
import type { AccessibleApiRouteItem } from '../../../../shared/api/contracts/my-apis/types';

const sampleRoutes: AccessibleApiRouteItem[] = [
  {
    id: 'fn.roles',
    name: 'List roles',
    folder: 'core',
    method: 'GET',
    path: '/api/roles',
  },
  {
    id: 'fn.users',
    name: 'List users',
    folder: 'core',
    method: 'GET',
    path: '/api/users',
  },
  {
    id: 'fn.users.create',
    name: 'Create user',
    folder: 'core',
    method: 'POST',
    path: '/api/users',
  },
];

describe('bindingApiEndpointSearch', () => {
  it('filters routes by partial path while typing', () => {
    expect(filterAccessibleApiRoutes(sampleRoutes, 'role').map((route) => route.path))
      .toEqual(['/api/roles']);
    expect(filterAccessibleApiRoutes(sampleRoutes, '/api/u').map((route) => route.path))
      .toEqual(['/api/users', '/api/users']);
  });

  it('respects method filters', () => {
    expect(filterAccessibleApiRoutes(sampleRoutes, 'users', ['GET']).map((route) => route.method))
      .toEqual(['GET']);
  });

  it('finds exact route matches ignoring trailing slashes', () => {
    expect(findAccessibleApiRouteMatch(sampleRoutes, '/api/roles/', 'GET')?.id).toBe('fn.roles');
    expect(normalizeApiEndpointPath('/api/roles/')).toBe('/api/roles');
  });
});
