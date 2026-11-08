import { rolesHaveFunctionAccessBypass } from '../../../lib/server-functions/functionAccessBypass';

export type FunctionAccessMode = 'public' | 'authenticated' | 'specific';

export type FunctionAccessListField = 'allowRoles' | 'allowUsers' | 'denyRoles' | 'denyUsers';

export type FunctionAccessControl = {
  accessMode?: FunctionAccessMode;
  allowRoles: string[];
  allowUsers: string[];
  denyRoles: string[];
  denyUsers: string[];
};

/**
 * Contradiction rules for function/MCP/platform access lists.
 * All editors and normalize/parse paths must keep stored ACLs consistent with these rules.
 */
export const FUNCTION_ACCESS_CONTRADICTION_RULES = [
  {
    id: 'role_allow_deny_exclusive',
    summary: 'A role cannot be both allowed and denied on the same resource.',
    resolution: 'When both lists contain the same role, deny wins on import; explicit UI edits remove the opposite entry.',
  },
  {
    id: 'user_allow_deny_exclusive',
    summary: 'A user identifier cannot be both allowed and denied on the same resource.',
    resolution: 'User ids and emails are matched case-insensitively; deny wins on import; explicit UI edits remove the opposite entry.',
  },
  {
    id: 'mode_clears_specific_lists',
    summary: 'Public and authenticated modes must not persist allow/deny lists.',
    resolution: 'Non-specific modes clear all four lists during normalize.',
  },
] as const;

const OPPOSITE_ACCESS_LIST_FIELD: Record<FunctionAccessListField, FunctionAccessListField> = {
  allowRoles: 'denyRoles',
  allowUsers: 'denyUsers',
  denyRoles: 'allowRoles',
  denyUsers: 'allowUsers',
};

const normalizeAccessListEntry = (field: FunctionAccessListField, value: string): string => (
  field.endsWith('Roles') ? value.trim().toUpperCase() : value.trim()
);

const accessListEntriesConflict = (
  field: 'allowRoles' | 'allowUsers',
  left: string,
  right: string,
): boolean => {
  const normalizedLeft = normalizeAccessListEntry(field, left);
  const normalizedRight = normalizeAccessListEntry(field, right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (field === 'allowRoles') {
    return normalizedLeft === normalizedRight;
  }

  return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
};

export type ManagedFunctionAccessPrincipal = {
  isAdmin?: boolean;
  isAuthenticated: boolean;
  userId?: number | null;
  email?: string | null;
  roles?: string[];
};

export const DEFAULT_FUNCTION_ACCESS_MODE: FunctionAccessMode = 'authenticated';

export const EMPTY_FUNCTION_ACCESS_CONTROL: FunctionAccessControl = {
  accessMode: DEFAULT_FUNCTION_ACCESS_MODE,
  allowRoles: [],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

export const PUBLIC_FUNCTION_ACCESS_CONTROL: FunctionAccessControl = {
  accessMode: 'public',
  allowRoles: [],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

export const AUTHENTICATED_FUNCTION_ACCESS_CONTROL: FunctionAccessControl = {
  accessMode: 'authenticated',
  allowRoles: [],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

const ACCESS_MODE_SET = new Set<FunctionAccessMode>(['public', 'authenticated', 'specific']);

const normalizeRoleList = (roles: unknown): string[] => (
  [...new Set(
    (Array.isArray(roles) ? roles : [])
      .filter((role): role is string => typeof role === 'string')
      .map((role) => role.trim().toUpperCase())
      .filter(Boolean),
  )]
);

const normalizeUserList = (users: unknown): string[] => (
  [...new Set(
    (Array.isArray(users) ? users : [])
      .filter((user): user is string => typeof user === 'string')
      .map((user) => user.trim())
      .filter(Boolean),
  )]
);

const hasSpecificAccessRules = (value: Partial<FunctionAccessControl> | null | undefined): boolean => (
  normalizeRoleList(value?.allowRoles).length > 0
  || normalizeUserList(value?.allowUsers).length > 0
  || normalizeRoleList(value?.denyRoles).length > 0
  || normalizeUserList(value?.denyUsers).length > 0
);

export const resolveFunctionAccessMode = (
  value: Partial<FunctionAccessControl> | null | undefined,
): FunctionAccessMode => {
  const explicitMode = value?.accessMode;
  if (explicitMode && ACCESS_MODE_SET.has(explicitMode)) {
    return explicitMode;
  }

  if (hasSpecificAccessRules(value)) {
    return 'specific';
  }

  return DEFAULT_FUNCTION_ACCESS_MODE;
};

export const normalizeFunctionAccessControl = (
  value: Partial<FunctionAccessControl> | null | undefined,
): FunctionAccessControl => {
  const normalized: FunctionAccessControl = {
    accessMode: resolveFunctionAccessMode(value),
    allowRoles: normalizeRoleList(value?.allowRoles),
    allowUsers: normalizeUserList(value?.allowUsers),
    denyRoles: normalizeRoleList(value?.denyRoles),
    denyUsers: normalizeUserList(value?.denyUsers),
  };

  if (normalized.accessMode !== 'specific') {
    return {
      ...normalized,
      allowRoles: [],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    };
  }

  return reconcileFunctionAccessListConflicts(normalized, 'deny');
};

export const reconcileFunctionAccessListConflicts = (
  value: FunctionAccessControl,
  preference: 'allow' | 'deny' = 'deny',
): FunctionAccessControl => {
  let { allowRoles, denyRoles, allowUsers, denyUsers } = value;

  if (preference === 'deny') {
    allowRoles = allowRoles.filter(
      (entry) => !denyRoles.some((denied) => accessListEntriesConflict('allowRoles', entry, denied)),
    );
    allowUsers = allowUsers.filter(
      (entry) => !denyUsers.some((denied) => accessListEntriesConflict('allowUsers', entry, denied)),
    );
  } else {
    denyRoles = denyRoles.filter(
      (entry) => !allowRoles.some((allowed) => accessListEntriesConflict('allowRoles', allowed, entry)),
    );
    denyUsers = denyUsers.filter(
      (entry) => !allowUsers.some((allowed) => accessListEntriesConflict('allowUsers', allowed, entry)),
    );
  }

  return {
    ...value,
    allowRoles,
    denyRoles,
    allowUsers,
    denyUsers,
  };
};

export const specificRolesAccessControl = (roles: readonly string[]): FunctionAccessControl => (
  normalizeFunctionAccessControl({
    accessMode: 'specific',
    allowRoles: [...roles],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  })
);

export const ADMIN_ONLY_FUNCTION_ACCESS_CONTROL = specificRolesAccessControl(['ADMIN']);

export const addFunctionAccessListEntry = (
  value: Partial<FunctionAccessControl> | null | undefined,
  field: FunctionAccessListField,
  rawValue: string,
): FunctionAccessControl => {
  const entry = normalizeAccessListEntry(field, rawValue);
  if (!entry) {
    return normalizeFunctionAccessControl(value);
  }

  const normalized = normalizeFunctionAccessControl({
    ...value,
    accessMode: 'specific',
  });
  const oppositeField = OPPOSITE_ACCESS_LIST_FIELD[field];
  const matchesEntry = (other: string) => accessListEntriesConflict(
    field.endsWith('Roles') ? 'allowRoles' : 'allowUsers',
    entry,
    other,
  );

  const targetList = [...normalized[field]];
  if (!targetList.some(matchesEntry)) {
    targetList.push(entry);
  }

  const oppositeList = normalized[oppositeField].filter((other) => !matchesEntry(other));

  return normalizeFunctionAccessControl({
    ...normalized,
    accessMode: 'specific',
    [field]: targetList,
    [oppositeField]: oppositeList,
  });
};

export const removeFunctionAccessListEntry = (
  value: Partial<FunctionAccessControl> | null | undefined,
  field: FunctionAccessListField,
  index: number,
): FunctionAccessControl => {
  const normalized = normalizeFunctionAccessControl(value);
  const list = [...normalized[field]];
  if (index < 0 || index >= list.length) {
    return normalized;
  }

  list.splice(index, 1);
  return normalizeFunctionAccessControl({
    ...normalized,
    [field]: list,
  });
};

export const parseFunctionAccessControl = (value: unknown): FunctionAccessControl => {
  if (!value) {
    return EMPTY_FUNCTION_ACCESS_CONTROL;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return EMPTY_FUNCTION_ACCESS_CONTROL;
    }
    try {
      return normalizeFunctionAccessControl(JSON.parse(trimmed) as Partial<FunctionAccessControl>);
    } catch {
      return EMPTY_FUNCTION_ACCESS_CONTROL;
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return normalizeFunctionAccessControl(value as Partial<FunctionAccessControl>);
  }

  return EMPTY_FUNCTION_ACCESS_CONTROL;
};

const principalUserKeys = (principal: ManagedFunctionAccessPrincipal): string[] => {
  const keys = new Set<string>();
  if (principal.userId != null && Number.isFinite(principal.userId)) {
    keys.add(String(principal.userId));
  }
  if (principal.email?.trim()) {
    keys.add(principal.email.trim());
  }
  return [...keys];
};

const principalMatchesUserList = (
  principal: ManagedFunctionAccessPrincipal,
  users: string[],
): boolean => {
  const normalizedUsers = normalizeUserList(users).map((user) => user.toLowerCase());
  if (normalizedUsers.length === 0) {
    return false;
  }

  return principalUserKeys(principal).some((key) => normalizedUsers.includes(key.toLowerCase()));
};

const canAccessSpecificFunction = (
  principal: ManagedFunctionAccessPrincipal,
  acl: FunctionAccessControl,
): boolean => {
  const roles = normalizeRoleList(principal.roles);

  if (acl.denyRoles.some((role) => roles.includes(role))) {
    return false;
  }

  if (principalMatchesUserList(principal, acl.denyUsers)) {
    return false;
  }

  if (acl.allowRoles.length === 0 && acl.allowUsers.length === 0) {
    return true;
  }

  if (principalMatchesUserList(principal, acl.allowUsers)) {
    return true;
  }

  if (acl.allowRoles.length > 0 && roles.some((role) => acl.allowRoles.includes(role))) {
    return true;
  }

  return false;
};

export const canAccessManagedFunction = (
  principal: ManagedFunctionAccessPrincipal,
  accessControl: FunctionAccessControl,
): boolean => {
  if (principal.isAdmin || rolesHaveFunctionAccessBypass(principal.roles ?? [])) {
    return true;
  }

  const acl = normalizeFunctionAccessControl(accessControl);
  const mode = resolveFunctionAccessMode(acl);

  if (mode === 'public') {
    return true;
  }

  if (!principal.isAuthenticated) {
    return false;
  }

  if (mode === 'authenticated') {
    return true;
  }

  return canAccessSpecificFunction(principal, acl);
};

export const isPublicFunctionAccessControl = (
  accessControl: FunctionAccessControl,
): boolean => resolveFunctionAccessMode(accessControl) === 'public';

export const formatAccessControlLabel = (
  accessControl: Partial<FunctionAccessControl> | null | undefined,
): string => {
  const mode = resolveFunctionAccessMode(accessControl);
  if (mode === 'public') {
    return 'Public';
  }

  if (mode === 'authenticated') {
    return 'Logged in users';
  }

  const acl = normalizeFunctionAccessControl(accessControl);
  const parts: string[] = [];
  if (acl.allowRoles.length > 0) {
    parts.push(`allow roles: ${acl.allowRoles.join(', ')}`);
  }
  if (acl.allowUsers.length > 0) {
    parts.push(`allow users: ${acl.allowUsers.join(', ')}`);
  }
  if (acl.denyRoles.length > 0) {
    parts.push(`deny roles: ${acl.denyRoles.join(', ')}`);
  }
  if (acl.denyUsers.length > 0) {
    parts.push(`deny users: ${acl.denyUsers.join(', ')}`);
  }

  return parts.length > 0 ? `Specific (${parts.join('; ')})` : 'Specific';
};
