import { describe, expect, it } from 'vitest';
import { summarizeWorkspaceLineage } from '../workspaceLineageScaffold';

describe('workspaceLineageScaffold', () => {
  it('labels initial revision lineage', () => {
    const workspace = {
      workspaceId: 'ws:lineage:1',
      applicationScopeRef: 'platform:studio',
      applicationScopeKey: 'platform:studio',
      changeSetId: 'cs:lineage:1',
      baseArtifactFingerprints: [],
      storageRef: { kind: 'git_branch' as const, ref: 'appendoo/ws/cs-lineage-1' },
      state: 'OPEN' as const,
      currentRevisionId: 'rev:lineage:1',
      createdAt: '2026-07-11T00:00:00.000Z',
    };
    const revision = {
      revisionId: 'rev:lineage:1',
      workspaceId: 'ws:lineage:1',
      revisionNumber: 1,
      reason: 'initial',
      state: 'OPEN' as const,
      revisionFingerprint: 'fp:lineage:1',
      createdAt: '2026-07-11T00:00:00.000Z',
    };

    const summary = summarizeWorkspaceLineage(workspace, revision);
    expect(summary.lineageLabel).toBe('R1 initial');
    expect(summary.isRepairRevision).toBe(false);
  });

  it('labels repair revision lineage', () => {
    const workspace = {
      workspaceId: 'ws:lineage:2',
      applicationScopeRef: 'platform:studio',
      applicationScopeKey: 'platform:studio',
      changeSetId: 'cs:lineage:2',
      baseArtifactFingerprints: [],
      storageRef: { kind: 'git_branch' as const, ref: 'appendoo/ws/cs-lineage-2' },
      state: 'OPEN' as const,
      currentRevisionId: 'rev:lineage:2',
      createdAt: '2026-07-11T00:00:00.000Z',
    };
    const revision = {
      revisionId: 'rev:lineage:2',
      workspaceId: 'ws:lineage:2',
      parentRevisionId: 'rev:lineage:1',
      revisionNumber: 2,
      reason: 'repair after verify fail',
      state: 'OPEN' as const,
      revisionFingerprint: 'fp:lineage:2',
      createdAt: '2026-07-11T00:00:00.000Z',
    };

    const summary = summarizeWorkspaceLineage(workspace, revision, 1);
    expect(summary.isRepairRevision).toBe(true);
    expect(summary.lineageLabel).toContain('repair');
    expect(summary.priorRevisionCount).toBe(1);
  });
});
