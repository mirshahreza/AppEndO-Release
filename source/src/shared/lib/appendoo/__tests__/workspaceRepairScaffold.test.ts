import { describe, expect, it } from 'vitest';
import type { EngineeringWorkspace, WorkspaceRevision } from '../../../api/contracts/appendoo/engineeringWorkspace.types';
import { createEngineeringWorkspaceScaffold, createRepairRevisionScaffold } from '../engineeringWorkspaceScaffold';
import { repairWorkspaceAfterVerificationFailure } from '../workspaceRepairScaffold';

function createMockRepairStore() {
  const workspaces = new Map<string, EngineeringWorkspace>();
  const revisions = new Map<string, Map<string, WorkspaceRevision>>();

  return {
    getWorkspace(workspaceId: string) {
      return workspaces.get(workspaceId) ?? null;
    },
    listRevisions(workspaceId: string) {
      const record = revisions.get(workspaceId);
      if (!record) return [];
      return [...record.values()].sort((left, right) => left.revisionNumber - right.revisionNumber);
    },
    createRevision(input: { workspaceId: string; parentRevisionId?: string; reason: string }) {
      const workspace = workspaces.get(input.workspaceId);
      const record = revisions.get(input.workspaceId);
      if (!workspace || !record) return null;

      const parent = input.parentRevisionId
        ? record.get(input.parentRevisionId)
        : [...record.values()].find((rev) => rev.revisionId === workspace.currentRevisionId);
      if (!parent) return null;

      const revision = createRepairRevisionScaffold(workspace, parent, input);
      record.set(revision.revisionId, revision);
      workspaces.set(workspace.workspaceId, {
        ...workspace,
        currentRevisionId: revision.revisionId,
        state: 'OPEN',
      });
      return revision;
    },
    seed(input: { changeSetId: string }) {
      const scaffold = createEngineeringWorkspaceScaffold({
        changeSetId: input.changeSetId,
        applicationScope: {
          kind: 'platform',
          scopeKey: 'platform:studio',
          mountId: 'studio',
        },
      });
      workspaces.set(scaffold.workspace.workspaceId, scaffold.workspace);
      revisions.set(
        scaffold.workspace.workspaceId,
        new Map([[scaffold.revision.revisionId, scaffold.revision]]),
      );
      return scaffold;
    },
    markFailed(workspaceId: string, revisionId: string) {
      const record = revisions.get(workspaceId);
      const workspace = workspaces.get(workspaceId);
      if (!record || !workspace) return null;

      const revision = record.get(revisionId);
      if (!revision) return null;

      const failed: WorkspaceRevision = { ...revision, state: 'FAILED' };
      record.set(revisionId, failed);
      workspaces.set(workspaceId, { ...workspace, state: 'FAILED' });
      return failed;
    },
  };
}

describe('workspaceRepairScaffold', () => {
  it('creates repair revision after failed verification revision', () => {
    const store = createMockRepairStore();
    const created = store.seed({ changeSetId: 'cs:repair:1' });
    store.markFailed(created.workspace.workspaceId, created.revision.revisionId);

    const repair = repairWorkspaceAfterVerificationFailure(
      store,
      created.workspace.workspaceId,
      created.revision.revisionId,
    );

    expect(repair?.repairRevisionNumber).toBe(2);
    expect(repair?.repairRevision.state).toBe('OPEN');
    expect(repair?.lineageLabel).toContain('repair');
  });
});
