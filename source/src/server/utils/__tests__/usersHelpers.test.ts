import { describe, expect, it } from 'vitest';

import { normalizeRolesInput } from '../usersHelpers';

describe('normalizeRolesInput', () => {
  it('honors an explicit empty roles array', () => {
    expect(normalizeRolesInput([], undefined)).toEqual([]);
  });

  it('defaults when roles are omitted from the payload', () => {
    expect(normalizeRolesInput(undefined, undefined)).toEqual(['DEVELOPER']);
  });

  it('merges a single role field when roles array is not sent', () => {
    expect(normalizeRolesInput(undefined, 'admin')).toEqual(['ADMIN']);
  });
});
