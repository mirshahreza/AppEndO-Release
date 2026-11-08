import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { WorkItemRecord } from '../../workflow/types';
import { invalidatePersonalInboxForWorkItem } from '../personalInboxWorkItemInvalidate';

const markStaleMock = vi.fn().mockResolvedValue(undefined);
const loadUserIdsWithRoleMock = vi.fn().mockResolvedValue([11, 12]);

vi.mock('../personalInboxProjection.repository', () => ({
  personalInboxProjectionRepository: {
    markStale: (...args: unknown[]) => markStaleMock(...args),
  },
}));

vi.mock('../../users/prismaHelpers', () => ({
  loadUserIdsWithRole: (...args: unknown[]) => loadUserIdsWithRoleMock(...args),
}));

const baseWorkItem = (overrides?: Partial<WorkItemRecord>): WorkItemRecord => ({
  id: 1,
  nodeInstanceId: 1,
  workItemType: 'APPROVAL',
  titleText: 't',
  summaryText: null,
  status: 'OPEN',
  priority: 0,
  assignmentStrategy: 'USER',
  assignmentEvidenceJson: JSON.stringify({ resolvedType: 'USER', resolvedUserId: 42 }),
  allowedOutcomesJson: '[]',
  inputJson: null,
  outputJson: null,
  stateVersion: 1,
  claimedByUserId: null,
  claimedAt: null,
  dueAt: null,
  followUpAt: null,
  approvalGroupKey: null,
  createdAt: null,
  updatedAt: null,
  ...overrides,
});

describe('invalidatePersonalInboxForWorkItem', () => {
  beforeEach(() => {
    markStaleMock.mockClear();
    loadUserIdsWithRoleMock.mockClear();
  });

  it('marks stale for assignee, claimant, and extra actors', async () => {
    await invalidatePersonalInboxForWorkItem(
      baseWorkItem({ claimedByUserId: 99 }),
      [7],
    );
    expect(markStaleMock).toHaveBeenCalledWith(42);
    expect(markStaleMock).toHaveBeenCalledWith(99);
    expect(markStaleMock).toHaveBeenCalledWith(7);
    expect(markStaleMock).toHaveBeenCalledTimes(3);
  });

  it('includes role queue members for ROLE assignment', async () => {
    await invalidatePersonalInboxForWorkItem(
      baseWorkItem({
        assignmentEvidenceJson: JSON.stringify({ resolvedType: 'ROLE', resolvedRoleId: 'DEVELOPER' }),
      }),
    );
    expect(loadUserIdsWithRoleMock).toHaveBeenCalledWith('DEVELOPER');
    expect(markStaleMock).toHaveBeenCalledWith(11);
    expect(markStaleMock).toHaveBeenCalledWith(12);
  });
});
