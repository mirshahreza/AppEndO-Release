import type {
  CreateEngineeringWorkspaceInput,
  CreateWorkspaceRevisionInput,
  EngineeringWorkspace,
  WorkspaceRevision,
  WorkspaceRevisionVerificationResult,
} from '../../../shared/api/contracts/appendoo/engineeringWorkspace.types';
import {
  createEngineeringWorkspaceScaffold,
  createRepairRevisionScaffold,
  summarizeEngineeringWorkspace,
} from '../../../shared/lib/appendoo/engineeringWorkspaceScaffold';

type WorkspaceRecord = {
  workspace: EngineeringWorkspace;
  revisions: Map<string, WorkspaceRevision>;
};

export class EngineeringWorkspaceService {
  private workspaces = new Map<string, WorkspaceRecord>();

  createWorkspace(input: CreateEngineeringWorkspaceInput): {
    workspace: EngineeringWorkspace;
    revision: WorkspaceRevision;
    summary: ReturnType<typeof summarizeEngineeringWorkspace>;
  } {
    const scaffold = createEngineeringWorkspaceScaffold(input);
    this.workspaces.set(scaffold.workspace.workspaceId, {
      workspace: scaffold.workspace,
      revisions: new Map([[scaffold.revision.revisionId, scaffold.revision]]),
    });

    return {
      ...scaffold,
      summary: summarizeEngineeringWorkspace(scaffold.workspace, scaffold.revision),
    };
  }

  getWorkspace(workspaceId: string): EngineeringWorkspace | null {
    return this.workspaces.get(workspaceId)?.workspace ?? null;
  }

  getRevision(workspaceId: string, revisionId: string): WorkspaceRevision | null {
    return this.workspaces.get(workspaceId)?.revisions.get(revisionId) ?? null;
  }

  listRevisions(workspaceId: string): WorkspaceRevision[] {
    const record = this.workspaces.get(workspaceId);
    if (!record) {
      return [];
    }

    return [...record.revisions.values()].sort((left, right) => left.revisionNumber - right.revisionNumber);
  }

  createRevision(
    input: CreateWorkspaceRevisionInput,
  ): WorkspaceRevision | null {
    const record = this.workspaces.get(input.workspaceId);
    if (!record) return null;

    const parent = input.parentRevisionId
      ? record.revisions.get(input.parentRevisionId)
      : [...record.revisions.values()].find((rev) => rev.revisionId === record.workspace.currentRevisionId);

    if (!parent) return null;

    const revision = createRepairRevisionScaffold(record.workspace, parent, input);
    record.revisions.set(revision.revisionId, revision);
    record.workspace = {
      ...record.workspace,
      currentRevisionId: revision.revisionId,
      state: 'OPEN',
    };
    this.workspaces.set(record.workspace.workspaceId, record);
    return revision;
  }

  freezeForVerification(workspaceId: string, revisionId: string): WorkspaceRevision | null {
    const record = this.workspaces.get(workspaceId);
    if (!record) return null;

    const revision = record.revisions.get(revisionId);
    if (!revision || revision.state !== 'OPEN') return null;

    const frozen: WorkspaceRevision = {
      ...revision,
      state: 'FROZEN_FOR_VERIFICATION',
      frozenAt: new Date().toISOString(),
    };
    record.revisions.set(revisionId, frozen);
    record.workspace = { ...record.workspace, state: 'FROZEN_FOR_VERIFICATION' };
    return frozen;
  }

  markVerificationResult(
    workspaceId: string,
    revisionId: string,
    result: WorkspaceRevisionVerificationResult,
  ): { workspace: EngineeringWorkspace; revision: WorkspaceRevision } | null {
    const record = this.workspaces.get(workspaceId);
    if (!record) return null;

    const revision = record.revisions.get(revisionId);
    if (!revision || revision.state !== 'FROZEN_FOR_VERIFICATION') return null;

    const nextRevisionState = result.passed ? 'VERIFIED' : 'FAILED';
    const nextWorkspaceState = result.passed ? 'VERIFIED' : 'FAILED';

    const updatedRevision: WorkspaceRevision = {
      ...revision,
      state: nextRevisionState,
      verificationRunId: result.verificationRunId,
      revisionFingerprint: result.revisionFingerprint,
    };

    record.revisions.set(revisionId, updatedRevision);
    record.workspace = {
      ...record.workspace,
      state: nextWorkspaceState,
      promotedAt: result.passed ? result.at : record.workspace.promotedAt,
    };

    return { workspace: record.workspace, revision: updatedRevision };
  }

  discard(workspaceId: string): boolean {
    const record = this.workspaces.get(workspaceId);
    if (!record) return false;
    record.workspace = { ...record.workspace, state: 'DISCARDED' };
    return true;
  }

  /** For tests — reset in-memory store. */
  resetForTests(): void {
    this.workspaces.clear();
  }
}

export const engineeringWorkspaceService = new EngineeringWorkspaceService();
