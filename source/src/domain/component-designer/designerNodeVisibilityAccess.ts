import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  formatAccessControlLabel,
  normalizeFunctionAccessControl,
  parseFunctionAccessControl,
  resolveFunctionAccessMode,
  type FunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import type { DesignerNode } from './types';

export const NODE_VISIBILITY_ACCESS_LAYOUT_KEY = 'visibilityAccess';

const ROLE_EXPR = "String(store.user?.role ?? '').toUpperCase()";
const USER_ID_EXPR = "String(store.user?.id ?? '')";
const USER_EMAIL_EXPR = "String(store.user?.email ?? '').toLowerCase()";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readNodeVisibilityAccessRaw = (node: DesignerNode): unknown =>
  node.layout[NODE_VISIBILITY_ACCESS_LAYOUT_KEY];

export const resolveNodeVisibilityAccess = (node: DesignerNode): FunctionAccessControl => {
  const raw = readNodeVisibilityAccessRaw(node);
  if (raw !== undefined && raw !== null) {
    return parseFunctionAccessControl(raw);
  }

  const condition = typeof node.layout.visibleCondition === 'string'
    ? node.layout.visibleCondition.trim()
    : '';
  const parsed = parseVisibilityConditionToAccess(condition);
  if (parsed) {
    return parsed;
  }

  if (condition.length === 0) {
    return AUTHENTICATED_FUNCTION_ACCESS_CONTROL;
  }

  return AUTHENTICATED_FUNCTION_ACCESS_CONTROL;
};

export const compileNodeVisibilityAccessToCondition = (
  access: FunctionAccessControl,
): string | undefined => {
  const acl = normalizeFunctionAccessControl(access);
  const mode = resolveFunctionAccessMode(acl);

  if (mode === 'public' || mode === 'authenticated') {
    return undefined;
  }

  const parts: string[] = [];

  if (acl.denyRoles.length > 0) {
    parts.push(`![${JSON.stringify(acl.denyRoles)}].includes(${ROLE_EXPR})`);
  }

  if (acl.denyUsers.length > 0) {
    const users = acl.denyUsers.map((user) => user.toLowerCase());
    parts.push(
      `![${JSON.stringify(users)}].includes(${USER_ID_EXPR}) && ![${JSON.stringify(users)}].includes(${USER_EMAIL_EXPR})`,
    );
  }

  const allowParts: string[] = [];
  if (acl.allowRoles.length > 0) {
    allowParts.push(`${JSON.stringify(acl.allowRoles)}.includes(${ROLE_EXPR})`);
  }
  if (acl.allowUsers.length > 0) {
    const users = acl.allowUsers.map((user) => user.toLowerCase());
    allowParts.push(
      `[${JSON.stringify(users)}].includes(${USER_ID_EXPR}) || [${JSON.stringify(users)}].includes(${USER_EMAIL_EXPR})`,
    );
  }

  if (allowParts.length > 0) {
    parts.push(allowParts.length === 1 ? allowParts[0] : `(${allowParts.join(' || ')})`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' && ');
};

/** Best-effort reverse mapping for legacy role-only visibility expressions. */
export const parseVisibilityConditionToAccess = (
  condition: string,
): FunctionAccessControl | null => {
  const trimmed = condition.trim();
  if (!trimmed) {
    return null;
  }

  const allowRolesMatch = trimmed.match(
    /^(\[[^\]]+\])\.includes\(String\(store\.user\?\.[^)]+\)\.toUpperCase\(\)\)$/,
  );
  if (allowRolesMatch) {
    try {
      const roles = JSON.parse(allowRolesMatch[1]) as unknown;
      if (Array.isArray(roles) && roles.every((role) => typeof role === 'string')) {
        return normalizeFunctionAccessControl({
          accessMode: 'specific',
          allowRoles: roles,
          allowUsers: [],
          denyRoles: [],
          denyUsers: [],
        });
      }
    } catch {
      return null;
    }
  }

  const legacyRoleMatch = trimmed.match(/^store\.user\.role\s*===\s*'([^']+)'$/);
  if (legacyRoleMatch) {
    return normalizeFunctionAccessControl({
      accessMode: 'specific',
      allowRoles: [legacyRoleMatch[1]],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });
  }

  return null;
};

export const buildNodeVisibilityLayoutPatch = (
  access: FunctionAccessControl,
): Record<string, unknown> => {
  const normalized = normalizeFunctionAccessControl(access);
  const visibleCondition = compileNodeVisibilityAccessToCondition(normalized);

  return {
    [NODE_VISIBILITY_ACCESS_LAYOUT_KEY]: normalized,
    visibleCondition: visibleCondition ?? undefined,
  };
};

export const serializeNodeVisibilityAccessForLayout = (
  access: FunctionAccessControl,
): FunctionAccessControl => normalizeFunctionAccessControl(access);

export const nodeLayoutHasVisibilityAccess = (node: DesignerNode): boolean => {
  const raw = readNodeVisibilityAccessRaw(node);
  return raw !== undefined && raw !== null && (isRecord(raw) || typeof raw === 'string');
};

export const formatNodeVisibilityAccessLabel = (node: DesignerNode): string => {
  if (nodeLayoutHasVisibilityAccess(node)) {
    return formatAccessControlLabel(resolveNodeVisibilityAccess(node));
  }

  const condition = typeof node.layout.visibleCondition === 'string'
    ? node.layout.visibleCondition.trim()
    : '';
  if (condition.length > 0) {
    return 'Custom expression';
  }

  return formatAccessControlLabel(AUTHENTICATED_FUNCTION_ACCESS_CONTROL);
};
