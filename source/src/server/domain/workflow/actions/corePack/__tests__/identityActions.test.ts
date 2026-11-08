import { describe, expect, it, vi, beforeEach } from 'vitest';
import { identityUserGetExecutor, identityRoleMembersExecutor } from '../identityActions';
import { registerCoreActionPack } from '../index';
import { __resetActionRegistryForTests, getActionDefinition, resolveExactProvider, listAvailableActionDefinitions } from '../../registry';

vi.mock('../../../../users/userRepository', () => ({
  findUserWorkflowSummary: vi.fn(),
}));

vi.mock('../../../../users/userRoleRepository', () => ({
  listRoleMemberSummaries: vi.fn(),
}));

import { findUserWorkflowSummary } from '../../../../users/userRepository';
import { listRoleMemberSummaries } from '../../../../users/userRoleRepository';

const findUserWorkflowSummaryMock = vi.mocked(findUserWorkflowSummary);
const listRoleMemberSummariesMock = vi.mocked(listRoleMemberSummaries);

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('identity Action pack (p-89 ACT-6)', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    registerCoreActionPack();
    findUserWorkflowSummaryMock.mockReset();
    listRoleMemberSummariesMock.mockReset();
  });

  it('registers identity.user-get and identity.role-members as AVAILABLE core providers', () => {
    for (const key of ['identity.user-get', 'identity.role-members'] as const) {
      expect(getActionDefinition(key, '1')?.definition.availability).toBe('AVAILABLE');
      expect(() => resolveExactProvider(key, '1', 'core', '1')).not.toThrow();
    }
    const keys = listAvailableActionDefinitions().map((d) => d.key);
    expect(keys).toContain('identity.user-get');
    expect(keys).toContain('identity.role-members');
  });

  it('identity.user-get returns a real user summary without secrets', async () => {
    findUserWorkflowSummaryMock.mockResolvedValue({
      userId: 7,
      username: 'ada',
      email: 'ada@example.com',
      mobile: null,
      locked: false,
      isBuiltin: false,
      roles: ['DEVELOPER'],
      displayName: 'Ada Lovelace',
      firstname: 'Ada',
      lastname: 'Lovelace',
      nickname: null,
      companyName: null,
      personTypeCode: '1',
    });
    const result = await identityUserGetExecutor.execute(fakeContext, {}, { userId: 7 });
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      output: {
        found: true,
        userId: 7,
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        roles: ['DEVELOPER'],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/password/i);
  });

  it('identity.user-get fails when user is missing', async () => {
    findUserWorkflowSummaryMock.mockResolvedValue(undefined);
    const result = await identityUserGetExecutor.execute(fakeContext, {}, { userId: 999 });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'IDENTITY_USER_NOT_FOUND' });
  });

  it('identity.user-get rejects invalid userId', async () => {
    const result = await identityUserGetExecutor.execute(fakeContext, {}, { userId: 'nope' });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID' });
    expect(findUserWorkflowSummaryMock).not.toHaveBeenCalled();
  });

  it('identity.role-members returns members and emails for a known role', async () => {
    listRoleMemberSummariesMock.mockResolvedValue({
      roleName: 'ADMIN',
      members: [
        { userId: 1, username: 'admin', email: 'admin@example.com', locked: false, displayName: 'Admin' },
        { userId: 2, username: 'ops', email: null, locked: false, displayName: 'Ops' },
      ],
    });
    const result = await identityRoleMembersExecutor.execute(fakeContext, {}, { roleName: 'admin' });
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      output: {
        roleName: 'ADMIN',
        count: 2,
        emails: ['admin@example.com'],
      },
    });
  });

  it('identity.role-members fails when the role does not exist', async () => {
    listRoleMemberSummariesMock.mockResolvedValue({ roleMissing: true });
    const result = await identityRoleMembersExecutor.execute(fakeContext, {}, { roleName: 'NOPE' });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'IDENTITY_ROLE_NOT_FOUND' });
  });
});
