import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/baseInfoValidation', () => ({
  ensureBaseInfoCode: vi.fn(),
}));

vi.mock('../../../domain/users/userRepository', () => ({
  findUserId: vi.fn(),
}));

vi.mock('../../../domain/users/roleRepository', () => ({
  findRoleById: vi.fn(),
}));

vi.mock('../../../domain/attributes/valueRepository', () => ({
  deleteRoleAttributeValue: vi.fn(),
  deleteUserAttributeValue: vi.fn(),
  listRoleAttributeRows: vi.fn(),
  listUserAttributeRows: vi.fn(),
  listUserIdsByRoleName: vi.fn(),
  upsertRoleAttributeValue: vi.fn(),
  upsertUserAttributeValue: vi.fn(),
}));

vi.mock('../roleAttributesCache', () => ({
  invalidateRoleAttributes: vi.fn(),
  refreshRoleAttributesCache: vi.fn(),
}));

vi.mock('../sessionContextCache', () => ({
  invalidateSessionContext: vi.fn(),
  invalidateSessionContextForUsers: vi.fn(),
}));

import { findRoleById } from '../../../domain/users/roleRepository';
import { findUserId } from '../../../domain/users/userRepository';
import {
  listRoleAttributeRows,
  listUserAttributeRows,
  listUserIdsByRoleName,
  upsertRoleAttributeValue,
  upsertUserAttributeValue,
} from '../../../domain/attributes/valueRepository';
import { updateRoleAttributes, updateUserAttributes } from '../value.service';

const actor = { userId: 100000, role: 'ADMIN', roles: ['ADMIN'] } as const;

describe('value.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findUserId).mockResolvedValue({ id: 100300 } as never);
    vi.mocked(listUserAttributeRows).mockResolvedValue([
      {
        id: '1',
        key: 'home_city',
        scope: 'USER',
        source_type: 'BASE_INFO',
        base_info_root_id: '103',
        data_type: 'base_info_code',
        cardinality: 'single',
        is_required: false,
      } as never,
    ]);
    vi.mocked(findRoleById).mockResolvedValue({ id: 2, name: 'USER' } as never);
    vi.mocked(listRoleAttributeRows).mockResolvedValue([
      {
        id: '5',
        key: 'max_concurrent_sessions',
        scope: 'ROLE',
        source_type: 'CUSTOM',
        data_type: 'number',
        cardinality: 'single',
        is_required: false,
      } as never,
    ]);
    vi.mocked(listUserIdsByRoleName).mockResolvedValue([]);
  });

  it('resolves string BIGINT definition ids when updating user attributes', async () => {
    const result = await updateUserAttributes(actor, 100300, {
      values: [{ settingsAttributeId: 1, value: '103.1' }],
    });

    expect(result.body.success).toBe(true);
    expect(upsertUserAttributeValue).toHaveBeenCalledWith(1, 100300, '"103.1"', 100000);
  });

  it('resolves string BIGINT definition ids when updating role attributes', async () => {
    const result = await updateRoleAttributes(actor, 2, {
      values: [{ settingsAttributeId: 5, value: 3 }],
    });

    expect(result.body.success).toBe(true);
    expect(upsertRoleAttributeValue).toHaveBeenCalledWith(5, 'USER', '3', 100000);
  });
});
