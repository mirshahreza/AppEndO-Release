import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
import { packageSnapshotRoundtripService } from '../packageSnapshotRoundtrip.service';
import { buildLivePackageSnapshotZip } from '../packageSnapshotLiveExport';
import { parsePackageSnapshotExportManifest } from '../../../../shared/lib/appendoo/packageSnapshotRoundtripScaffold';
import { createPromotionRunScaffold, executePromotionScaffold } from '../../../../shared/lib/appendoo/promotionScaffold';
import { finalizePackageSnapshotScaffold } from '../../../../shared/lib/appendoo/packageSnapshotFinalizeScaffold';
import type { VerificationRun } from '../../../../shared/api/contracts/appendoo/verificationEngine.types';

const verifiedRun = (): VerificationRun => ({
  verificationRunId: 'verify:live-export:1',
  workspaceId: 'ws:live-export:1',
  revisionId: 'rev:live-export:1',
  revisionFingerprint: 'fp:live-export:1',
  changeSetId: 'cs:live-export:1',
  state: 'COMPLETED',
  graderResults: [],
  deployable: true,
  startedAt: '2026-07-11T00:00:00.000Z',
  completedAt: '2026-07-11T00:00:00.000Z',
});

const buildSnapshot = () => {
  const pending = createPromotionRunScaffold({
    changeSetId: 'cs:live-export:1',
    workspaceId: 'ws:live-export:1',
    revisionId: 'rev:live-export:1',
    revisionFingerprint: 'fp:live-export:1',
    verificationRunId: 'verify:live-export:1',
  }, verifiedRun());

  const deployed = executePromotionScaffold(pending!);
  return finalizePackageSnapshotScaffold(deployed, [
    'appendoo/ws/cs-live-export-1/workspace/server-functions/custom/demo.ts',
  ]).snapshot!;
};

describe('packageSnapshotRoundtripLive.service', () => {
  let origEnv = '';

  beforeEach(() => {
    origEnv = process.env.APPENDOO_LIVE_PACKAGE_EXPORT ?? '';
    process.env.APPENDOO_LIVE_PACKAGE_EXPORT = '1';
    vi.resetModules();
  });

  afterEach(() => {
    process.env.APPENDOO_LIVE_PACKAGE_EXPORT = origEnv;
    vi.resetModules();
  });

  it('builds a valid package ZIP with embedded snapshot export manifest when flag enabled', () => {
    const snapshot = buildSnapshot();
    const zipBuffer = buildLivePackageSnapshotZip(snapshot);

    expect(zipBuffer.length).toBeGreaterThan(100);

    const zip = new AdmZip(zipBuffer);
    const manifestEntry = zip.getEntry('appendoo/snapshot-export.json');
    const packageEntry = zip.getEntry('package.json');

    expect(manifestEntry).toBeTruthy();
    expect(packageEntry).toBeTruthy();

    const exportManifest = parsePackageSnapshotExportManifest(
      JSON.parse(manifestEntry!.getData().toString('utf8')),
    );
    expect(exportManifest?.snapshotId).toBe(snapshot.snapshotId);
    expect(exportManifest?.integrityHash).toBe(snapshot.integrityHash);

    const packageManifest = JSON.parse(packageEntry!.getData().toString('utf8')) as {
      id?: string;
      integrity?: { artifactHash?: string };
    };
    expect(packageManifest.id).toBeTruthy();
    expect(packageManifest.integrity?.artifactHash).toBeTruthy();
  });

  it('reports liveZipBytes from roundtrip service when flag enabled', () => {
    const snapshot = buildSnapshot();
    const result = packageSnapshotRoundtripService.executeRoundtrip(snapshot);

    expect(result.ok).toBe(true);
    expect(result.liveZipBytes).toBeGreaterThan(100);
    expect(result.snapshot.roundtripValidated).toBe(true);
  });
});
