import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('../../../../users/userRepository', () => ({
  countAllUsers: vi.fn(),
  findUserWorkflowSummary: vi.fn(),
  lockUser: vi.fn(),
  unlockUser: vi.fn(),
}));

vi.mock('../../../../users/userRoleRepository', () => ({
  listRoleMemberSummaries: vi.fn(),
  listRoleNameRows: vi.fn(),
}));

import { registerIdentityDynamicOptionsResolvers } from '../identityActions';
import { listRoleNameRows } from '../../../../users/userRoleRepository';
import { resolveDynamicOptions, __resetDynamicOptionsRegistryForTests } from '../../dynamicOptionsRegistry';

const listRoleNameRowsMock = vi.mocked(listRoleNameRows);

afterEach(() => {
  __resetDynamicOptionsRegistryForTests();
  listRoleNameRowsMock.mockReset();
});

describe('registerIdentityDynamicOptionsResolvers', () => {
  it('registers "identity.roles" mapping real role names to value/label options', async () => {
    listRoleNameRowsMock.mockResolvedValue([{ name: 'ADMIN' }, { name: 'EDITOR' }]);
    registerIdentityDynamicOptionsResolvers();

    const options = await resolveDynamicOptions('identity.roles');
    expect(options).toEqual([{ value: 'ADMIN', label: 'ADMIN' }, { value: 'EDITOR', label: 'EDITOR' }]);
  });
});
