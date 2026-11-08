import { describe, expect, it } from 'vitest';
import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  addFunctionAccessListEntry,
  canAccessManagedFunction,
  FUNCTION_ACCESS_CONTRADICTION_RULES,
  normalizeFunctionAccessControl,
  parseFunctionAccessControl,
  PUBLIC_FUNCTION_ACCESS_CONTROL,
  reconcileFunctionAccessListConflicts,
  resolveFunctionAccessMode,
} from '../accessControl';

describe('accessControl', () => {
  it('defaults empty ACL to authenticated mode', () => {
    expect(resolveFunctionAccessMode({ allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] }))
      .toBe('authenticated');
    expect(normalizeFunctionAccessControl({ allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] }))
      .toEqual(AUTHENTICATED_FUNCTION_ACCESS_CONTROL);
  });

  it('infers specific mode when allow/deny lists are populated', () => {
    expect(resolveFunctionAccessMode({
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    })).toBe('specific');
  });

  it('allows anonymous access for public mode', () => {
    expect(canAccessManagedFunction(
      { isAuthenticated: false, roles: [] },
      PUBLIC_FUNCTION_ACCESS_CONTROL,
    )).toBe(true);
  });

  it('requires authentication for authenticated mode', () => {
    expect(canAccessManagedFunction(
      { isAuthenticated: false, roles: [] },
      AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
    )).toBe(false);
    expect(canAccessManagedFunction(
      { isAuthenticated: true, roles: ['USER'] },
      AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
    )).toBe(true);
  });

  it('bypasses specific ACL for DEVELOPER role', () => {
    const acl = normalizeFunctionAccessControl({
      allowRoles: ['USER'],
      allowUsers: [],
      denyRoles: ['DEVELOPER'],
      denyUsers: [],
    });
    expect(canAccessManagedFunction(
      { isAuthenticated: true, roles: ['DEVELOPER'] },
      acl,
    )).toBe(true);
  });

  it('enforces specific allow lists', () => {
    const acl = normalizeFunctionAccessControl({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });

    expect(canAccessManagedFunction({ isAuthenticated: true, roles: ['USER'] }, acl)).toBe(false);
    expect(canAccessManagedFunction({ isAuthenticated: true, roles: ['DEVELOPER'] }, acl)).toBe(true);
  });

  it('clears ACL lists for non-specific modes on normalize', () => {
    expect(normalizeFunctionAccessControl({
      accessMode: 'public',
      allowRoles: ['ADMIN'],
      allowUsers: ['bob'],
      denyRoles: ['USER'],
      denyUsers: ['alice'],
    })).toEqual(PUBLIC_FUNCTION_ACCESS_CONTROL);
  });

  it('parses JSON access control payloads', () => {
    expect(parseFunctionAccessControl(JSON.stringify({
      accessMode: 'specific',
      allowRoles: ['admin'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    }))).toEqual({
      accessMode: 'specific',
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });
  });

  it('documents contradiction rules for access list storage', () => {
    expect(FUNCTION_ACCESS_CONTRADICTION_RULES.map((rule) => rule.id)).toEqual([
      'role_allow_deny_exclusive',
      'user_allow_deny_exclusive',
      'mode_clears_specific_lists',
    ]);
  });

  it('removes conflicting allow entries when deny wins during normalize', () => {
    expect(normalizeFunctionAccessControl({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER', 'USER'],
      allowUsers: ['7', 'user@example.com'],
      denyRoles: ['DEVELOPER'],
      denyUsers: ['User@Example.com'],
    })).toEqual({
      accessMode: 'specific',
      allowRoles: ['USER'],
      allowUsers: ['7'],
      denyRoles: ['DEVELOPER'],
      denyUsers: ['User@Example.com'],
    });
  });

  it('reconciles explicit allow edits by removing the opposite deny entry', () => {
    expect(addFunctionAccessListEntry({
      accessMode: 'specific',
      allowRoles: [],
      allowUsers: [],
      denyRoles: ['DEVELOPER'],
      denyUsers: [],
    }, 'allowRoles', 'developer')).toEqual({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });
  });

  it('reconciles explicit deny edits by removing the opposite allow entry', () => {
    expect(reconcileFunctionAccessListConflicts({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER'],
      allowUsers: [],
      denyRoles: ['DEVELOPER'],
      denyUsers: [],
    }, 'allow')).toEqual({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });
  });
});
