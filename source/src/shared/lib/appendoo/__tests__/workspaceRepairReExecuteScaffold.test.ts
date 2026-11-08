import { describe, expect, it } from 'vitest';
import type { EngineeringWorkspace, WorkspaceRevision } from '../../../api/contracts/appendoo/engineeringWorkspace.types';
import { validateRepairRevisionForReExecute } from '../workspaceRepairReExecuteScaffold';

function createStore(
  workspace: EngineeringWorkspace,
  revisions: Record<string, WorkspaceRevision>,
) {
  return {
    getWorkspace: () => workspace,
    listRevisions: () => Object.values(revisions).sort((a, b) => a.revisionNumber - b.revisionNumber),
    createRevision: () => null,
    getRevision: (_workspaceId: string, revisionId: string) => revisions[revisionId] ?? null,
  };
}

describe('workspaceRepairReExecuteScaffold', () => {
  it('accepts OPEN repair revision as current workspace revision', () => {
    const workspace: EngineeringWorkspace = {
      workspaceId: 'ws:test:1',
      applicationScopeRef: 'platform:studio',
      applicationScopeKey: 'platform:studio',
      changeSetId: 'cs:test:1',
      baseArtifactFingerprints: [],
      storageRef: { kind: 'git_branch', ref: 'appendoo/ws/cs:test:1', composedFrom: 'git_workspace_service' },
      state: 'OPEN',
      currentRevisionId: 'rev:repair:2',
      createdAt: '2026-07-11T00:00:00.000Z',
    };
    const revisions = {
      'rev:failed:1': {
        revisionId: 'rev:failed:1',
        workspaceId: 'ws:test:1',
        revisionNumber: 1,
        reason: 'initial',
        state: 'FAILED',
        revisionFingerprint: 'fp1',
        createdAt: '2026-07-11T00:00:00.000Z',
      },
      'rev:repair:2': {
        revisionId: 'rev:repair:2',
        workspaceId: 'ws:test:1',
        revisionNumber: 2,
        parentRevisionId: 'rev:failed:1',
        reason: 'repair after verification failure',
        state: 'OPEN',
        revisionFingerprint: 'fp2',
        createdAt: '2026-07-11T00:00:01.000Z',
      },
    };

    const result = validateRepairRevisionForReExecute(
      createStore(workspace, revisions),
      workspace.workspaceId,
      'rev:repair:2',
    );

    expect(result.ok).toBe(true);
  });

  it('rejects non-OPEN repair revision', () => {
    const workspace: EngineeringWorkspace = {
      workspaceId: 'ws:test:1',
      applicationScopeRef: 'platform:studio',
      applicationScopeKey: 'platform:studio',
      changeSetId: 'cs:test:1',
      baseArtifactFingerprints: [],
      storageRef: { kind: 'git_branch', ref: 'appendoo/ws/cs:test:1', composedFrom: 'git_workspace_service' },
      state: 'FAILED',
      currentRevisionId: 'rev:repair:2',
      createdAt: '2026-07-11T00:00:00.000Z',
    };
    const revisions = {
      'rev:repair:2': {
        revisionId: 'rev:repair:2',
        workspaceId: 'ws:test:1',
        revisionNumber: 2,
        parentRevisionId: 'rev:failed:1',
        reason: 'repair after verification failure',
        state: 'FAILED',
        revisionFingerprint: 'fp2',
        createdAt: '2026-07-11T00:00:01.000Z',
      },
    };

    const result = validateRepairRevisionForReExecute(
      createStore(workspace, revisions),
      workspace.workspaceId,
      'rev:repair:2',
    );

    expect(result.ok).toBe(false);
  });
});
