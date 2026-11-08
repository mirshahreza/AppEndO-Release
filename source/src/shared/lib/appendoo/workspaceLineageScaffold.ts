import type {
  EngineeringWorkspace,
  WorkspaceRevision,
} from '../../api/contracts/appendoo/engineeringWorkspace.types';

export type WorkspaceLineageSummary = {
  revisionNumber: number;
  parentRevisionId?: string;
  revisionState: WorkspaceRevision['state'];
  workspaceState: EngineeringWorkspace['state'];
  reason: string;
  lineageLabel: string;
  isRepairRevision: boolean;
  priorRevisionCount: number;
};

/** AE-10.4 — revision lineage label for architect workspace UX. */
export const summarizeWorkspaceLineage = (
  workspace: EngineeringWorkspace,
  revision: WorkspaceRevision,
  priorRevisionCount = Math.max(0, revision.revisionNumber - 1),
): WorkspaceLineageSummary => {
  const isRepairRevision = Boolean(revision.parentRevisionId) || revision.revisionNumber > 1;
  const lineageLabel = isRepairRevision
    ? `R${revision.revisionNumber} repair${revision.parentRevisionId ? ` ← ${revision.parentRevisionId}` : ''}`
    : `R${revision.revisionNumber} initial`;

  return {
    revisionNumber: revision.revisionNumber,
    parentRevisionId: revision.parentRevisionId,
    revisionState: revision.state,
    workspaceState: workspace.state,
    reason: revision.reason,
    lineageLabel,
    isRepairRevision,
    priorRevisionCount,
  };
};
