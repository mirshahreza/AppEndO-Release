import { describe, expect, it } from 'vitest';
import { isBaseRole, mergeRolePickerOptions } from '../../../shared/api/contracts/roles/roleNames';

describe('roles utils', () => {
  it('treats only ADMIN and DEVELOPER as base roles', () => {
    expect(isBaseRole('ADMIN')).toBe(true);
    expect(isBaseRole('DEVELOPER')).toBe(true);
    expect(isBaseRole('USER')).toBe(false);
    expect(isBaseRole('MANAGER')).toBe(false);
  });

  it('includes assigned roles not in the catalog', () => {
    expect(mergeRolePickerOptions(['ADMIN', 'DEVELOPER', 'MANAGER'], ['USER', 'ADMIN'])).toEqual([
      'ADMIN',
      'DEVELOPER',
      'MANAGER',
      'USER',
    ]);
  });

  it('does not duplicate roles already in the catalog', () => {
    expect(mergeRolePickerOptions(['ADMIN', 'DEVELOPER'], ['DEVELOPER'])).toEqual([
      'ADMIN',
      'DEVELOPER',
    ]);
  });
});
