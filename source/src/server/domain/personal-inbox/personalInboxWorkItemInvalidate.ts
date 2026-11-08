import { loadUserIdsWithRole } from '../users/prismaHelpers';
import type { WorkItemRecord } from '../workflow/types';
import { personalInboxProjectionRepository } from './personalInboxProjection.repository';

type AssignmentEvidence = {
  resolvedType?: 'USER' | 'ROLE';
  resolvedUserId?: number;
  resolvedRoleId?: string;
};

const markStale = (userId: number): void => {
  void personalInboxProjectionRepository.markStale(userId).catch(() => undefined);
};

const parseEvidence = (workItem: WorkItemRecord): AssignmentEvidence | undefined => {
  if (!workItem.assignmentEvidenceJson?.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(workItem.assignmentEvidenceJson) as AssignmentEvidence;
  } catch {
    return undefined;
  }
};

/** Invalidate inbox projection for everyone who might see this work item in a bucket. */
export async function invalidatePersonalInboxForWorkItem(
  workItem: WorkItemRecord,
  extraUserIds: number[] = [],
): Promise<void> {
  const userIds = new Set<number>(extraUserIds.filter((id) => Number.isInteger(id) && id > 0));

  const evidence = parseEvidence(workItem);
  if (evidence?.resolvedType === 'USER' && evidence.resolvedUserId != null) {
    userIds.add(evidence.resolvedUserId);
  }
  if (workItem.claimedByUserId != null) {
    userIds.add(workItem.claimedByUserId);
  }
  if (evidence?.resolvedType === 'ROLE' && evidence.resolvedRoleId?.trim()) {
    const roleMembers = await loadUserIdsWithRole(evidence.resolvedRoleId);
    for (const memberId of roleMembers) {
      userIds.add(memberId);
    }
  }

  for (const userId of userIds) {
    markStale(userId);
  }
}
