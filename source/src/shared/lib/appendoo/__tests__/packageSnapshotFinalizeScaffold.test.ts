import { describe, expect, it } from 'vitest';
import { createPromotionRunScaffold, executePromotionScaffold } from '../promotionScaffold';
import { finalizePackageSnapshotScaffold } from '../packageSnapshotFinalizeScaffold';
import type { VerificationRun } from '../../../api/contracts/appendoo/verificationEngine.types';

const verifiedRun = (): VerificationRun => ({
  verificationRunId: 'verify:snapshot:1',
  workspaceId: 'ws:snapshot:1',
  revisionId: 'rev:snapshot:1',
  revisionFingerprint: 'fp:snapshot:1',
  changeSetId: 'cs:snapshot:1',
  state: 'COMPLETED',
  graderResults: [],
  deployable: true,
  startedAt: '2026-07-11T00:00:00.000Z',
  completedAt: '2026-07-11T00:00:00.000Z',
});

describe('packageSnapshotFinalizeScaffold', () => {
  it('finalizes artifact manifest and integrity hash after DEPLOYED', () => {
    const pending = createPromotionRunScaffold({
      changeSetId: 'cs:snapshot:1',
      workspaceId: 'ws:snapshot:1',
      revisionId: 'rev:snapshot:1',
      revisionFingerprint: 'fp:snapshot:1',
      verificationRunId: 'verify:snapshot:1',
    }, verifiedRun());

    const deployed = executePromotionScaffold(pending!);
    const finalized = finalizePackageSnapshotScaffold(deployed, [
      'appendoo/ws/cs-snapshot-1/workspace/server-functions/custom/demo.ts',
    ]);

    expect(finalized.snapshot).toBeTruthy();
    expect(finalized.snapshot?.artifactManifest).toHaveLength(1);
    expect(finalized.snapshot?.integrityHash).toHaveLength(24);
    expect(finalized.run.packageSnapshotId).toMatch(/^pkg-snap:/);
  });
});
