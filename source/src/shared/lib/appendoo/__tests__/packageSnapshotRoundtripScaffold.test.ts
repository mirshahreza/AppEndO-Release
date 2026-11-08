import { describe, expect, it } from 'vitest';
import { createPromotionRunScaffold, executePromotionScaffold } from '../promotionScaffold';
import { finalizePackageSnapshotScaffold } from '../packageSnapshotFinalizeScaffold';
import {
  buildPackageSnapshotExportBuffer,
  buildPackageSnapshotExportManifest,
  parsePackageSnapshotExportManifest,
  validatePackageSnapshotRoundtrip,
} from '../packageSnapshotRoundtripScaffold';
import type { VerificationRun } from '../../../api/contracts/appendoo/verificationEngine.types';

const verifiedRun = (): VerificationRun => ({
  verificationRunId: 'verify:roundtrip:1',
  workspaceId: 'ws:roundtrip:1',
  revisionId: 'rev:roundtrip:1',
  revisionFingerprint: 'fp:roundtrip:1',
  changeSetId: 'cs:roundtrip:1',
  state: 'COMPLETED',
  graderResults: [],
  deployable: true,
  startedAt: '2026-07-11T00:00:00.000Z',
  completedAt: '2026-07-11T00:00:00.000Z',
});

describe('packageSnapshotRoundtripScaffold', () => {
  it('builds export manifest and validates serialize/parse roundtrip', () => {
    const pending = createPromotionRunScaffold({
      changeSetId: 'cs:roundtrip:1',
      workspaceId: 'ws:roundtrip:1',
      revisionId: 'rev:roundtrip:1',
      revisionFingerprint: 'fp:roundtrip:1',
      verificationRunId: 'verify:roundtrip:1',
    }, verifiedRun());

    const deployed = executePromotionScaffold(pending!);
    const finalized = finalizePackageSnapshotScaffold(deployed, [
      'appendoo/ws/cs-roundtrip-1/workspace/server-functions/custom/demo.ts',
    ]);

    expect(finalized.snapshot).toBeTruthy();

    const manifest = buildPackageSnapshotExportManifest(finalized.snapshot!);
    const parsed = parsePackageSnapshotExportManifest(JSON.parse(JSON.stringify(manifest)));
    expect(parsed?.snapshotId).toBe(finalized.snapshot?.snapshotId);

    const roundtrip = validatePackageSnapshotRoundtrip(finalized.snapshot!);
    expect(roundtrip.ok).toBe(true);
    expect(roundtrip.errors).toHaveLength(0);

    const exportBuffer = buildPackageSnapshotExportBuffer(finalized.snapshot!);
    expect(exportBuffer.toString('utf8')).toContain('"snapshotId"');
  });
});
