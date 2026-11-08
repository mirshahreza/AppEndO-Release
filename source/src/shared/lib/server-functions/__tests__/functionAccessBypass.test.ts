import { describe, expect, it } from 'vitest';
import {
  isBuiltinAdminUsername,
  isFunctionAccessAclSubjectRoleExcluded,
  isFunctionAccessAclSubjectUserExcluded,
  rolesHaveFunctionAccessBypass,
} from '../functionAccessBypass';

describe('functionAccessBypass', () => {
  it('treats ADMIN and DEVELOPER as bypass roles', () => {
    expect(rolesHaveFunctionAccessBypass(['USER'])).toBe(false);
    expect(rolesHaveFunctionAccessBypass(['DEVELOPER'])).toBe(true);
    expect(rolesHaveFunctionAccessBypass(['ADMIN'])).toBe(true);
  });

  it('excludes built-in admin username and elevated roles from ACL subject pickers', () => {
    expect(isBuiltinAdminUsername('admin')).toBe(true);
    expect(isFunctionAccessAclSubjectUserExcluded({
      username: 'admin',
      roles: [],
    })).toBe(true);
    expect(isFunctionAccessAclSubjectUserExcluded({
      username: 'jane',
      roles: ['DEVELOPER'],
    })).toBe(true);
    expect(isFunctionAccessAclSubjectUserExcluded({
      username: 'jane',
      roles: ['USER'],
    })).toBe(false);
  });

  it('excludes ADMIN and DEVELOPER roles from ACL subject pickers', () => {
    expect(isFunctionAccessAclSubjectRoleExcluded('ADMIN')).toBe(true);
    expect(isFunctionAccessAclSubjectRoleExcluded('DEVELOPER')).toBe(true);
    expect(isFunctionAccessAclSubjectRoleExcluded('USER')).toBe(false);
  });
});
