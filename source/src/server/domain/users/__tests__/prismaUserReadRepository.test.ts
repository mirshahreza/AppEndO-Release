import { afterEach, describe, expect, it, vi } from 'vitest';

import { USER_ID_SEQUENCE_START } from '../../../../core/db/database';
import { findAuthUserByEmail } from '../userRepository';

const prismaMock = {
  baseUser: {
    findFirst: vi.fn(),
  },
};

vi.mock('../../../db/prismaControlPlane', () => ({
  isPrismaControlPlaneReady: () => true,
  getPrismaControlPlane: () => prismaMock,
}));

vi.mock('../../../db/controlPlaneDatabase', () => ({
  readControlPlaneDatabaseSettings: () => ({ provider: 'postgresql', url: '', engine: 'prisma' }),
}));

vi.mock('../../../config/settingsFile', () => ({
  SETTINGS_PATH: '/tmp/settings.json',
}));

describe('userRepository auth reads', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads user by email with roles', async () => {
    prismaMock.baseUser.findFirst.mockResolvedValue({
      id: BigInt(USER_ID_SEQUENCE_START),
      email: 'admin@example.com',
      username: 'admin',
      locked: 0,
      passwordHash: 'hash',
      isBuiltin: true,
      emailVerifiedAt: null,
      mobile: null,
      userRoles: [{ roleName: 'ADMIN' }, { roleName: 'DEVELOPER' }],
    });

    const user = await findAuthUserByEmail('admin@example.com');

    expect(user).toMatchObject({
      id: USER_ID_SEQUENCE_START,
      email: 'admin@example.com',
      username: 'admin',
      role: 'ADMIN',
      roles: ['ADMIN', 'DEVELOPER'],
      locked: false,
      is_builtin: true,
    });
  });

  it('returns undefined when user is missing', async () => {
    prismaMock.baseUser.findFirst.mockResolvedValue(null);
    const user = await findAuthUserByEmail('missing@example.com');
    expect(user).toBeUndefined();
  });
});
