import { describe, expect, it } from 'vitest';
import {
  abbreviateRoleLabel,
  canDeleteUserRecord,
  canManageUserRow,
  getRoleChipClass,
  normalizeRoleSelection,
  resolveUserGridAvatarUsername,
  setRoleInSelection,
  sortRolesForDisplay,
} from '../utils';

describe('users utils', () => {
  it('sorts roles alphabetically with ADMIN first', () => {
    expect(sortRolesForDisplay(['DEVELOPER', 'ADMIN', 'MANAGER', 'EDITOR'])).toEqual([
      'ADMIN',
      'DEVELOPER',
      'EDITOR',
      'MANAGER',
    ]);
  });

  it('abbreviates roles to three characters', () => {
    expect(abbreviateRoleLabel('ADMIN')).toBe('ADM');
    expect(abbreviateRoleLabel('MANAGER')).toBe('MAN');
  });

  it('shows platform username under avatar', () => {
    expect(resolveUserGridAvatarUsername({
      id: 1,
      username: '871261',
    })).toBe('871261');
  });

  it('prefers HWY membership username from list API', () => {
    expect(resolveUserGridAvatarUsername({
      id: 99,
      username: '99',
      avatar_username: '871261',
    })).toBe('871261');
  });

  it('uses em dash when username is empty', () => {
    expect(resolveUserGridAvatarUsername({
      id: 1,
      username: '   ',
    })).toBe('1');
  });

  it('allows managing all user rows including admin', () => {
    expect(canManageUserRow()).toBe(true);
  });

  it('allows an empty role selection in the UI', () => {
    expect(normalizeRoleSelection([])).toEqual([]);
    expect(normalizeRoleSelection(['developer', 'ADMIN', 'developer'])).toEqual(['DEVELOPER', 'ADMIN']);
  });

  it('sets role membership from checkbox checked state', () => {
    expect(setRoleInSelection(['DEVELOPER'], 'MANAGER', true)).toEqual(['DEVELOPER', 'MANAGER']);
    expect(setRoleInSelection(['developer'], 'DEVELOPER', false)).toEqual([]);
    expect(setRoleInSelection(['ADMIN', 'DEVELOPER'], 'DEVELOPER', true)).toEqual(['ADMIN', 'DEVELOPER']);
  });

  it('never allows deleting admin rows', () => {
    expect(canDeleteUserRecord({ roles: ['ADMIN'] })).toBe(false);
    expect(canDeleteUserRecord({ roles: ['DEVELOPER'] })).toBe(true);
  });

  it('assigns distinct chip colors per role', () => {
    expect(getRoleChipClass('ADMIN')).toBe('bg-indigo-100 text-indigo-700');
    expect(getRoleChipClass('DEVELOPER')).toBe('bg-emerald-100 text-emerald-700');
    expect(getRoleChipClass('CUSTOM')).not.toBe(getRoleChipClass('OTHER'));
  });
});
