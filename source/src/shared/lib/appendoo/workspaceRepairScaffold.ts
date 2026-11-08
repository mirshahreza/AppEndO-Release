import type { EngineeringWorkspace, WorkspaceRevision } from '../../api/contracts/appendoo/engineeringWorkspace.types';
import { summarizeWorkspaceLineage } from './workspaceLineageScaffold';

export type WorkspaceRepairStore = {
  getWorkspace(workspaceId: string): EngineeringWorkspace | null;
  listRevisions(workspaceId: string): WorkspaceRevision[];
  createRevision(input: {
    workspaceId: string;
    parentRevisionId?: string;
    reason: string;
  }): WorkspaceRevision | null;
};

export type WorkspaceRepairResult = {
  failedRevisionId: string;
  repairRevision: WorkspaceRevision;
  lineageLabel: string;
  repairRevisionNumber: number;
};

/** AE-10.5 — spawn OPEN repair revision after failed verification (R1 fail → R2 repair). */
export const repairWorkspaceAfterVerificationFailure = (
  workspaceService: WorkspaceRepairStore,
  workspaceId: string,
  failedRevisionId: string,
  reason = 'repair after verification failure',
): WorkspaceRepairResult | null => {
  const workspace = workspaceService.getWorkspace(workspaceId);
  if (!workspace) {
    return null;
  }

  const repairRevision = workspaceService.createRevision({
    workspaceId,
    parentRevisionId: failedRevisionId,
    reason,
  });

  if (!repairRevision) {
    return null;
  }

  const updatedWorkspace = workspaceService.getWorkspace(workspaceId);
  if (!updatedWorkspace) {
    return null;
  }

  const priorRevisionCount = Math.max(0, workspaceService.listRevisions(workspaceId).length - 1);
  const lineage = summarizeWorkspaceLineage(updatedWorkspace, repairRevision, priorRevisionCount);

  return {
    failedRevisionId,
    repairRevision,
    lineageLabel: lineage.lineageLabel,
    repairRevisionNumber: repairRevision.revisionNumber,
  };
};
