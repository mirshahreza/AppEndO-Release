import type { WorkspaceRevision } from '../../api/contracts/appendoo/engineeringWorkspace.types';
import type { WorkspaceRepairStore } from './workspaceRepairScaffold';

export type WorkspaceRepairReExecuteStore = WorkspaceRepairStore & {
  getRevision(workspaceId: string, revisionId: string): WorkspaceRevision | null;
};

export type RepairRevisionReExecuteValidation =
  | { ok: true; revision: WorkspaceRevision }
  | { ok: false; reason: string };

/** AE-10.6 — validate OPEN repair revision before re-running builders. */
export const validateRepairRevisionForReExecute = (
  store: WorkspaceRepairReExecuteStore,
  workspaceId: string,
  repairRevisionId: string,
): RepairRevisionReExecuteValidation => {
  const workspace = store.getWorkspace(workspaceId);
  if (!workspace) {
    return { ok: false, reason: 'Engineering workspace not found.' };
  }

  const revision = store.getRevision(workspaceId, repairRevisionId);
  if (!revision) {
    return { ok: false, reason: 'Repair revision not found.' };
  }

  if (revision.state !== 'OPEN') {
    return { ok: false, reason: `Repair revision must be OPEN (current: ${revision.state}).` };
  }

  if (workspace.currentRevisionId !== repairRevisionId) {
    return { ok: false, reason: 'Repair revision is not the workspace current revision.' };
  }

  const isRepairRevision = Boolean(revision.parentRevisionId) || revision.revisionNumber > 1;
  if (!isRepairRevision) {
    return { ok: false, reason: 'Revision is not a repair child revision.' };
  }

  return { ok: true, revision };
};
