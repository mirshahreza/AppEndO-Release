import type { Prisma } from '../../../generated/prisma/client';
import type { FilterMatchLogic } from '../../../shared/lib/filterMatchLogic';

export function buildUserRoleNamesFilter(
  roleNames: readonly string[],
  match: FilterMatchLogic,
): Prisma.BaseUserWhereInput | null {
  if (roleNames.length === 0) {
    return null;
  }

  switch (match) {
    case 'and':
      return {
        AND: roleNames.map((roleName) => ({
          userRoles: { some: { roleName } },
        })),
      };
    case 'or':
    default:
      return {
        userRoles: { some: { roleName: { in: [...roleNames] } } },
      };
  }
}
