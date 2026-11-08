import { BASE_ROLES } from '../../api/contracts/roles/constants';

const BYPASS_ROLE_SET = new Set<string>(BASE_ROLES);

export const FUNCTION_ACCESS_BYPASS_ROLE_NAMES: readonly string[] = BASE_ROLES;

export const isFunctionAccessBypassRole = (roleName: string): boolean =>
  BYPASS_ROLE_SET.has(String(roleName).trim().toUpperCase());

export const rolesHaveFunctionAccessBypass = (roles: readonly string[]): boolean =>
  roles.some((role) => isFunctionAccessBypassRole(role));

/** Built-in platform admin account (`username` admin). */
export const isBuiltinAdminUsername = (username: string | null | undefined): boolean =>
  String(username ?? '').trim().toLowerCase() === 'admin';

export type FunctionAccessAclSubjectUser = {
  username: string;
  is_builtin?: boolean;
  roles?: readonly string[];
};

/** Users that always bypass server-function ACL and are hidden from Access Assistant subject pickers. */
export const isFunctionAccessAclSubjectUserExcluded = (user: FunctionAccessAclSubjectUser): boolean => {
  if (isBuiltinAdminUsername(user.username)) {
    return true;
  }
  return rolesHaveFunctionAccessBypass(user.roles ?? []);
};

/** Role names that bypass ACL and are hidden from Access Assistant subject pickers. */
export const isFunctionAccessAclSubjectRoleExcluded = (roleName: string): boolean =>
  isFunctionAccessBypassRole(roleName);
