import { buildPackageZipBuffer } from '../../../core/packages/testkit/packageZipBuilder';
import type { PackageSnapshot } from '../../../shared/api/contracts/appendoo/promotion.types';
import { buildPackageSnapshotExportBuffer } from '../../../shared/lib/appendoo/packageSnapshotRoundtripScaffold';

/** AE-9.10 — server-side live package ZIP export for snapshot roundtrip. */
export const buildLivePackageSnapshotZip = (snapshot: PackageSnapshot): Buffer => {
  const packageId = snapshot.snapshotId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 64);
  return buildPackageZipBuffer({
    packageId,
    name: 'AppEndoo Snapshot Export',
    version: '1.0.0',
    extraFiles: [
      {
        path: 'appendoo/snapshot-export.json',
        content: buildPackageSnapshotExportBuffer(snapshot),
      },
      ...snapshot.artifactManifest.map((artifact) => ({
        path: `artifacts/${artifact.path.replace(/\\/g, '/')}`,
        content: `/* fingerprint:${artifact.fingerprint} */\n`,
      })),
    ],
  });
};
