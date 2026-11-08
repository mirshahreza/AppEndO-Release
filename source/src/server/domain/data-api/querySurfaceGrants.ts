import type { QuerySurfaceGrant } from '../../../shared/api/contracts/data-api';

export type QuerySurfacePrincipal = {
  userId?: number;
  roleIds: readonly string[];
  isAdmin?: boolean;
};

export const grantAllowsPrincipal = (
  grant: QuerySurfaceGrant | undefined,
  principal: QuerySurfacePrincipal,
): boolean => {
  if (!grant || grant.mode === 'public') {
    return true;
  }
  if (principal.isAdmin) {
    return true;
  }
  if (grant.mode === 'roles') {
    const allowed = new Set((grant.roleIds ?? []).map((id) => id.trim()).filter(Boolean));
    return principal.roleIds.some((roleId) => allowed.has(roleId));
  }
  if (grant.mode === 'users') {
    const allowed = new Set((grant.userIds ?? []).map((id) => id.trim()).filter(Boolean));
    return principal.userId != null && allowed.has(String(principal.userId));
  }
  return false;
};
