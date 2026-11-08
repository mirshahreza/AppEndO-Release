import { describe, expect, it } from 'vitest';
import { filterFunctionsForDocAccess } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';
import type { ManagedFunctionOpenApiInput } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';

describe('serverFunctionDocCatalog access filtering', () => {
  const managedRoute = (accessControl: ManagedFunctionOpenApiInput['access_control']): ManagedFunctionOpenApiInput => ({
    id: 'custom.hello',
    name: 'hello',
    folder: 'custom',
    method: 'GET',
    path: '/api/custom/hello',
    access_control: accessControl,
  });

  it('hides managed routes when allowRoles exclude the principal', () => {
    const visible = filterFunctionsForDocAccess(
      [managedRoute({ allowRoles: ['DEVELOPER'], allowUsers: [], denyRoles: [], denyUsers: [] })],
      { isAdmin: false, roles: ['USER'] },
    );

    expect(visible).toHaveLength(0);
  });

  it('shows managed routes when principal matches allowRoles', () => {
    const visible = filterFunctionsForDocAccess(
      [managedRoute({ allowRoles: ['USER'], allowUsers: [], denyRoles: [], denyUsers: [] })],
      { isAdmin: false, roles: ['USER'] },
    );

    expect(visible.map((item) => item.id)).toEqual(['custom.hello']);
  });
});
