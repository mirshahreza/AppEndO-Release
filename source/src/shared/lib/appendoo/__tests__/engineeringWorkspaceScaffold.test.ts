import { describe, expect, it } from 'vitest';
import {
  compileChangeGraphScaffold,
  createEngineeringWorkspaceScaffold,
  createRepairRevisionScaffold,
  isActiveRootMutation,
  summarizeEngineeringWorkspace,
} from '../engineeringWorkspaceScaffold';

describe('engineeringWorkspaceScaffold', () => {
  it('creates workspace with initial OPEN revision', () => {
    const { workspace, revision } = createEngineeringWorkspaceScaffold({
      changeSetId: 'cs-1',
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
    });

    expect(workspace.workspaceId).toMatch(/^ws:/);
    expect(workspace.changeSetId).toBe('cs-1');
    expect(workspace.currentRevisionId).toBe(revision.revisionId);
    expect(revision.state).toBe('OPEN');
    expect(revision.revisionNumber).toBe(1);
    expect(workspace.storageRef.composedFrom).toBe('git_workspace_service');
  });

  it('creates repair revision from failed parent', () => {
    const { workspace, revision: r1 } = createEngineeringWorkspaceScaffold({
      changeSetId: 'cs-2',
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio',
        mountId: 'studio',
      },
    });

    const r2 = createRepairRevisionScaffold(workspace, r1, {
      workspaceId: workspace.workspaceId,
      parentRevisionId: r1.revisionId,
      reason: 'repair after verification failure',
    });

    expect(r2.parentRevisionId).toBe(r1.revisionId);
    expect(r2.revisionNumber).toBe(2);
    expect(r2.state).toBe('OPEN');
    expect(r2.baseRevisionFingerprint).toBe(r1.revisionFingerprint);
  });

  it('compiles empty change graph scaffold', () => {
    const graph = compileChangeGraphScaffold({
      changeSetId: 'cs-3',
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio',
        mountId: 'studio',
      },
    });

    expect(graph.changeGraphId).toMatch(/^cg:/);
    expect(graph.nodes).toEqual([]);
    expect(graph.compilerVersion).toBeTruthy();
  });

  it('rejects active-root mutation paths', () => {
    expect(isActiveRootMutation('src/server/routes/users.routes.ts')).toBe(true);
    expect(isActiveRootMutation('src/features/users/components/UsersWorkspace.tsx')).toBe(true);
    expect(isActiveRootMutation('docs/appendoo/decision-log.md')).toBe(false);
  });

  it('summarizes workspace for telemetry', () => {
    const { workspace, revision } = createEngineeringWorkspaceScaffold({
      changeSetId: 'cs-4',
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio',
        mountId: 'studio',
      },
    });

    const summary = summarizeEngineeringWorkspace(workspace, revision);
    expect(summary.workspaceId).toBe(workspace.workspaceId);
    expect(summary.revisionState).toBe('OPEN');
    expect(summary.modelVersion).toBeTruthy();
  });
});
