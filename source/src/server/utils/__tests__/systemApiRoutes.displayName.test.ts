import { describe, expect, it } from 'vitest';
import {
  buildSystemFunctionRouteKey,
  deriveSystemFunctionDisplayName,
} from '../systemApiRoutes';

describe('systemApiRoutes display helpers', () => {
  it('derives human-readable names from route paths', () => {
    expect(deriveSystemFunctionDisplayName('GET', '/api/users')).toBe('get-users');
    expect(deriveSystemFunctionDisplayName('PUT', '/api/users/:id')).toBe('by-id');
    // toSystemFunctionName: with no path segments beyond /api/<resource>, the name is always
    // `${method}-${resource}` (same rule the first assertion above exercises for /api/users)
    // — 'custom-reports' without the method prefix was never a real output of this function.
    expect(deriveSystemFunctionDisplayName('GET', '/api/custom-reports/')).toBe('get-custom-reports');
  });

  it('builds stable route keys for catalog merge', () => {
    expect(buildSystemFunctionRouteKey('get', '/api/users/')).toBe('GET /api/users');
    expect(buildSystemFunctionRouteKey('POST', '/api/auth/login')).toBe('POST /api/auth/login');
  });
});
