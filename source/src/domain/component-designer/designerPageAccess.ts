import { platformAuthFromAccessControl } from '../../shared/api/contracts/platform/platformAccessControl';
import type { PlatformRouteBindingAuth } from '../../shared/api/contracts/platform/types';
import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  canAccessManagedFunction,
  normalizeFunctionAccessControl,
  type FunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import type { DesignerDocument } from './types';

export const resolveDesignerDocumentPageAccess = (
  document: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'>,
): FunctionAccessControl => {
  if (document.pageAccess) {
    return normalizeFunctionAccessControl(document.pageAccess);
  }

  const legacyRoles = Array.isArray(document.allowedRoles)
    ? document.allowedRoles.filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
    : [];

  if (legacyRoles.length === 0) {
    return AUTHENTICATED_FUNCTION_ACCESS_CONTROL;
  }

  return normalizeFunctionAccessControl({
    accessMode: 'specific',
    allowRoles: legacyRoles,
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  });
};

export const buildDesignerPageRouteAuth = (
  document: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'>,
): PlatformRouteBindingAuth | null => (
  platformAuthFromAccessControl(resolveDesignerDocumentPageAccess(document))
);

export const buildDesignerPageDefaultRolesJson = (
  document: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'>,
): string | null => {
  const access = resolveDesignerDocumentPageAccess(document);
  if (access.accessMode !== 'specific' || access.allowRoles.length === 0) {
    return null;
  }

  return JSON.stringify(access.allowRoles);
};

export const formatDesignerPageAuthManifestPreview = (
  document: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'>,
): string => {
  const access = resolveDesignerDocumentPageAccess(document);
  const routeBindingAuth = buildDesignerPageRouteAuth(document);
  const defaultRolesJson = buildDesignerPageDefaultRolesJson(document);

  return JSON.stringify(
    {
      routeBindingAuth,
      pageModuleDefaultRoles: defaultRolesJson ? JSON.parse(defaultRolesJson) : null,
      pageAccess: access,
    },
    null,
    2,
  );
};

/** Sync legacy allowedRoles for preview helpers that only read allowRoles. */
export const deriveDesignerLegacyAllowedRoles = (
  access: FunctionAccessControl,
): string[] | undefined => {
  const normalized = normalizeFunctionAccessControl(access);
  if (normalized.accessMode !== 'specific' || normalized.allowRoles.length === 0) {
    return undefined;
  }

  return normalized.allowRoles;
};

export const isDesignerSimulatedRoleAllowed = (
  document: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'>,
  simulatedRole: string,
): boolean => {
  const role = simulatedRole.trim();
  if (role.length === 0) {
    return true;
  }

  return canAccessManagedFunction(
    { isAuthenticated: true, roles: [role] },
    resolveDesignerDocumentPageAccess(document),
  );
};
