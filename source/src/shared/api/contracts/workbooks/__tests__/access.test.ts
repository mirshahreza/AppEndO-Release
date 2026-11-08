import { describe, expect, it } from 'vitest';
import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  PUBLIC_FUNCTION_ACCESS_CONTROL,
  normalizeFunctionAccessControl,
} from '../../server-functions/accessControl';
import {
  PRIVATE_WORKBOOK_ACCESS_CONTROL,
  canAccessWorkbookRecord,
  isExplicitWorkbookShare,
  resolveWorkbookViewerRole,
  workbookAccessKeyForUser,
} from '../access';

const owner = {
  isAuthenticated: true,
  isAdmin: false,
  userId: 7,
  email: 'owner@example.com',
  roles: ['USER'],
};

const member = {
  isAuthenticated: true,
  isAdmin: false,
  userId: 11,
  email: 'member@example.com',
  roles: ['USER'],
};

const admin = {
  isAuthenticated: true,
  isAdmin: true,
  userId: 1,
  email: 'admin@example.com',
  roles: ['ADMIN'],
};

const guest = {
  isAuthenticated: false,
  isAdmin: false,
};

describe('canAccessWorkbookRecord', () => {
  it('always allows the owner', () => {
    expect(canAccessWorkbookRecord(7, PRIVATE_WORKBOOK_ACCESS_CONTROL, owner)).toBe(true);
  });

  it('keeps specific + empty lists private even for admins', () => {
    expect(canAccessWorkbookRecord(7, PRIVATE_WORKBOOK_ACCESS_CONTROL, member)).toBe(false);
    expect(canAccessWorkbookRecord(7, PRIVATE_WORKBOOK_ACCESS_CONTROL, admin)).toBe(false);
    expect(canAccessWorkbookRecord(7, PRIVATE_WORKBOOK_ACCESS_CONTROL, guest)).toBe(false);
  });

  it('allows an explicit allowUsers member and not an admin bypass', () => {
    const acl = normalizeFunctionAccessControl({
      accessMode: 'specific',
      allowUsers: ['member@example.com'],
    });
    expect(canAccessWorkbookRecord(7, acl, member)).toBe(true);
    expect(canAccessWorkbookRecord(7, acl, admin)).toBe(false);
    expect(isExplicitWorkbookShare(7, acl, member)).toBe(true);
    expect(isExplicitWorkbookShare(7, acl, owner)).toBe(false);
  });

  it('allows signed-in callers for authenticated mode and anyone for public', () => {
    expect(canAccessWorkbookRecord(7, AUTHENTICATED_FUNCTION_ACCESS_CONTROL, member)).toBe(true);
    expect(canAccessWorkbookRecord(7, AUTHENTICATED_FUNCTION_ACCESS_CONTROL, guest)).toBe(false);
    expect(canAccessWorkbookRecord(7, PUBLIC_FUNCTION_ACCESS_CONTROL, guest)).toBe(true);
    expect(isExplicitWorkbookShare(7, PUBLIC_FUNCTION_ACCESS_CONTROL, member)).toBe(false);
  });
});

describe('workbook access helpers', () => {
  it('prefers email as the allowUsers key', () => {
    expect(workbookAccessKeyForUser({ userId: 11, email: 'member@example.com' })).toBe('member@example.com');
    expect(workbookAccessKeyForUser({ userId: 11, email: '  ' })).toBe('11');
  });

  it('maps owner/edit/view roles', () => {
    expect(resolveWorkbookViewerRole(true, 'view')).toBe('owner');
    expect(resolveWorkbookViewerRole(false, 'edit')).toBe('can-edit');
    expect(resolveWorkbookViewerRole(false, 'view')).toBe('can-view');
  });
});
