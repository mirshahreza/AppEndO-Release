import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../core/cache/CacheManager', () => ({
  cacheManager: {
    invalidate: vi.fn(),
  },
}));

vi.mock('../../../domain/users/userRepository', () => ({
  findUserId: vi.fn(),
}));

vi.mock('../../../domain/users/roleRepository', () => ({
  findRoleById: vi.fn(),
}));

vi.mock('../../../domain/attributes/valueRepository', () => ({
  listUserAttributeRows: vi.fn(),
  listUserIdsByRoleName: vi.fn(),
  upsertUserAttributeValue: vi.fn(),
  deleteUserAttributeValue: vi.fn(),
  listRoleAttributeRows: vi.fn(),
  upsertRoleAttributeValue: vi.fn(),
  deleteRoleAttributeValue: vi.fn(),
}));

vi.mock('../roleAttributesCache', () => ({
  invalidateRoleAttributes: vi.fn(),
  refreshRoleAttributesCache: vi.fn(),
}));

import { cacheManager } from '../../../../core/cache/CacheManager';
import { findRoleById } from '../../../domain/users/roleRepository';
import { findUserId } from '../../../domain/users/userRepository';
import {
  listRoleAttributeRows,
  listUserAttributeRows,
  listUserIdsByRoleName,
} from '../../../domain/attributes/valueRepository';
import {
  invalidateRoleAttributes,
  refreshRoleAttributesCache,
} from '../roleAttributesCache';
import { buildPlatformCacheKey } from '../../../../shared/lib/cacheKeyFormat';
import {
  invalidateSessionContext,
  invalidateSessionContextForUsers,
  sessionContextCacheKey,
} from '../sessionContextCache';
import { updateRoleAttributes, updateUserAttributes } from '../value.service';

const actor = { userId: 1, email: 'admin@append.os', role: 'ADMIN', isAdmin: true };
const user42Key = buildPlatformCacheKey('session', 'ctx3', 42);
const user7Key = buildPlatformCacheKey('session', 'ctx3', 7);
const user3Key = buildPlatformCacheKey('session', 'ctx3', 3);
const user5Key = buildPlatformCacheKey('session', 'ctx3', 5);
const user10Key = buildPlatformCacheKey('session', 'ctx3', 10);
const user11Key = buildPlatformCacheKey('session', 'ctx3', 11);

describe('session context invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds cache keys as session:ctx3:{userId}', () => {
    expect(sessionContextCacheKey(42)).toBe(user42Key);
  });

  it('invalidates a single user cache entry', async () => {
    await invalidateSessionContext(7);

    expect(cacheManager.invalidate).toHaveBeenCalledWith(user7Key);
  });

  it('invalidates unique user cache entries in bulk', async () => {
    await invalidateSessionContextForUsers([3, 3, 5, 0, -1]);

    expect(cacheManager.invalidate).toHaveBeenCalledTimes(2);
    expect(cacheManager.invalidate).toHaveBeenCalledWith(user3Key);
    expect(cacheManager.invalidate).toHaveBeenCalledWith(user5Key);
  });
});

describe('value.service session invalidation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findUserId).mockResolvedValue({ id: 10 } as never);
    vi.mocked(listUserAttributeRows).mockResolvedValue([
      { id: 1, key: 'city', scope: 'USER', is_required: false, cardinality: 'single', source_type: 'CUSTOM', data_type: 'string' } as never,
    ]);
    vi.mocked(findRoleById).mockResolvedValue({ id: 2, name: 'AGENT' } as never);
    vi.mocked(listRoleAttributeRows).mockResolvedValue([
      { id: 3, key: 'region', scope: 'ROLE', is_required: false, cardinality: 'single', source_type: 'CUSTOM', data_type: 'string' } as never,
    ]);
    vi.mocked(listUserIdsByRoleName).mockResolvedValue([10, 11]);
  });

  it('invalidates the edited user after PUT user attributes', async () => {
    await updateUserAttributes(actor, 10, {
      values: [{ settingsAttributeId: 1, value: 'Tehran' }],
    });

    expect(cacheManager.invalidate).toHaveBeenCalledWith(user10Key);
  });

  it('invalidates all users with the role after PUT role attributes', async () => {
    await updateRoleAttributes(actor, 2, {
      values: [{ settingsAttributeId: 3, value: 'north' }],
    });

    expect(invalidateRoleAttributes).toHaveBeenCalledWith('AGENT');
    expect(refreshRoleAttributesCache).toHaveBeenCalledWith('AGENT');
    expect(listUserIdsByRoleName).toHaveBeenCalledWith('AGENT');
    expect(cacheManager.invalidate).toHaveBeenCalledWith(user10Key);
    expect(cacheManager.invalidate).toHaveBeenCalledWith(user11Key);
  });
});
