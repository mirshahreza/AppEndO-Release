import { describe, expect, it } from 'vitest';
import { buildUserRoleNamesFilter } from '../userRoleListFilter';

describe('buildUserRoleNamesFilter', () => {
  it('returns null for empty role names', () => {
    expect(buildUserRoleNamesFilter([], 'or')).toBeNull();
  });

  it('builds OR filter with role name list', () => {
    expect(buildUserRoleNamesFilter(['ADMIN', 'DEVELOPER'], 'or')).toEqual({
      userRoles: { some: { roleName: { in: ['ADMIN', 'DEVELOPER'] } } },
    });
  });

  it('builds AND filter requiring every selected role', () => {
    expect(buildUserRoleNamesFilter(['ADMIN', 'DEVELOPER', 'MANAGER'], 'and')).toEqual({
      AND: [
        { userRoles: { some: { roleName: 'ADMIN' } } },
        { userRoles: { some: { roleName: 'DEVELOPER' } } },
        { userRoles: { some: { roleName: 'MANAGER' } } },
      ],
    });
  });
});
