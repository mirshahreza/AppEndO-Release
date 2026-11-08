import {
  canAccessManagedFunction,
  normalizeFunctionAccessControl,
  resolveFunctionAccessMode,
  type FunctionAccessControl,
  type ManagedFunctionAccessPrincipal,
} from '../server-functions/accessControl';

export type WorkbookAccessPermission = 'view' | 'edit';

export type WorkbookViewerRole = 'owner' | 'can-edit' | 'can-view';

export const PRIVATE_WORKBOOK_ACCESS_CONTROL: FunctionAccessControl = normalizeFunctionAccessControl({
  accessMode: 'specific',
  allowRoles: [],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
});

export const DEFAULT_WORKBOOK_ACCESS_PERMISSION: WorkbookAccessPermission = 'view';

export const isWorkbookAccessPermission = (value: unknown): value is WorkbookAccessPermission => (
  value === 'view' || value === 'edit'
);

export const workbookAccessKeyForUser = (input: {
  userId: number;
  email?: string | null;
}): string => {
  const email = input.email?.trim();
  return email || String(input.userId);
};

/**
 * Workbook record access. Reuses `canAccessManagedFunction` except:
 * 1. `specific` + empty allow lists is owner-only (not "unset / open").
 * 2. Platform admin does not bypass a personal workbook ACL.
 */
export const canAccessWorkbookRecord = (
  ownerUserId: number,
  accessControl: FunctionAccessControl | null | undefined,
  principal: ManagedFunctionAccessPrincipal,
): boolean => {
  if (principal.userId != null && Number.isFinite(principal.userId) && principal.userId === ownerUserId) {
    return true;
  }

  const acl = normalizeFunctionAccessControl(accessControl ?? PRIVATE_WORKBOOK_ACCESS_CONTROL);
  if (resolveFunctionAccessMode(acl) === 'specific' && acl.allowRoles.length === 0 && acl.allowUsers.length === 0) {
    return false;
  }

  return canAccessManagedFunction({ ...principal, isAdmin: false }, acl);
};

export const isExplicitWorkbookShare = (
  ownerUserId: number,
  accessControl: FunctionAccessControl | null | undefined,
  principal: ManagedFunctionAccessPrincipal,
): boolean => {
  if (principal.userId != null && principal.userId === ownerUserId) {
    return false;
  }
  const acl = normalizeFunctionAccessControl(accessControl ?? PRIVATE_WORKBOOK_ACCESS_CONTROL);
  if (resolveFunctionAccessMode(acl) !== 'specific') {
    return false;
  }
  return canAccessWorkbookRecord(ownerUserId, acl, principal);
};

export const resolveWorkbookViewerRole = (
  isOwner: boolean,
  permission: WorkbookAccessPermission,
): WorkbookViewerRole => {
  if (isOwner) {
    return 'owner';
  }
  return permission === 'edit' ? 'can-edit' : 'can-view';
};
