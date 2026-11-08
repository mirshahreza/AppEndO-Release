import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import {
  SEED_USER_COUNT,
  buildSeedUsers,
  resolveSeedUserElevatedRole,
  seedElevatedRolesToRemove,
} from '../database';

describe('buildSeedUsers', () => {
  it('assigns elevated platform roles to only a few demo users', () => {
    const users = buildSeedUsers(bcrypt.hashSync('a', 10), bcrypt.hashSync('b', 10));
    expect(users).toHaveLength(SEED_USER_COUNT);

    const admin = users.find((u) => u.username === 'admin');
    expect(admin?.role).toBe('ADMIN');

    const elevated = users.filter((u) => u.role !== null);
    expect(elevated.map((u) => u.username)).toEqual([
      'admin',
      users[1]!.username,
      users[2]!.username,
      users[3]!.username,
    ]);
    expect(users[1]!.role).toBe('DEVELOPER');
    expect(users[2]!.role).toBe('DEVELOPER');
    expect(users[3]!.role).toBe('ADMIN');

    const withoutRoles = users.filter((u) => u.role === null);
    expect(withoutRoles).toHaveLength(SEED_USER_COUNT - 4);
  });

  it('resolveSeedUserElevatedRole matches buildSeedUsers indices', () => {
    expect(resolveSeedUserElevatedRole(1)).toBe('DEVELOPER');
    expect(resolveSeedUserElevatedRole(2)).toBe('DEVELOPER');
    expect(resolveSeedUserElevatedRole(3)).toBe('ADMIN');
    expect(resolveSeedUserElevatedRole(4)).toBeNull();
  });

  it('seedElevatedRolesToRemove drops stale platform roles on re-seed', () => {
    expect(seedElevatedRolesToRemove(null)).toEqual(['ADMIN', 'DEVELOPER']);
    expect(seedElevatedRolesToRemove('DEVELOPER')).toEqual(['ADMIN']);
    expect(seedElevatedRolesToRemove('ADMIN')).toEqual(['DEVELOPER']);
  });
});
