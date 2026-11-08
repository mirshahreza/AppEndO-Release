import type { PackageSnapshot } from '../../../shared/api/contracts/appendoo/promotion.types';
import { isLivePackageExportEnabled } from '../../../shared/lib/appendoo/appendooIntegrationFlags';
import {
  buildPackageSnapshotExportBuffer,
  PACKAGE_SNAPSHOT_EXPORT_MANIFEST_VERSION,
  validatePackageSnapshotRoundtrip,
  type PackageSnapshotRoundtripResult,
} from '../../../shared/lib/appendoo/packageSnapshotRoundtripScaffold';
import { buildLivePackageSnapshotZip } from './packageSnapshotLiveExport';

export type PackageSnapshotRoundtripExecution = PackageSnapshotRoundtripResult & {
  snapshot: PackageSnapshot;
  exportBuffer?: Buffer;
  liveZipBytes?: number;
};

/** AE-9.10 — validate export roundtrip and optionally build live package ZIP. */
export class PackageSnapshotRoundtripService {
  executeRoundtrip(snapshot: PackageSnapshot): PackageSnapshotRoundtripExecution {
    const roundtrip = validatePackageSnapshotRoundtrip(snapshot);
    const enrichedSnapshot: PackageSnapshot = {
      ...snapshot,
      roundtripValidated: roundtrip.ok,
      exportManifestVersion: PACKAGE_SNAPSHOT_EXPORT_MANIFEST_VERSION,
    };

    const exportBuffer = buildPackageSnapshotExportBuffer(enrichedSnapshot);
    let liveZipBytes: number | undefined;

    if (roundtrip.ok && isLivePackageExportEnabled()) {
      liveZipBytes = buildLivePackageSnapshotZip(enrichedSnapshot).length;
    }

    return {
      ...roundtrip,
      snapshot: enrichedSnapshot,
      exportBuffer,
      liveZipBytes,
    };
  }
}

export const packageSnapshotRoundtripService = new PackageSnapshotRoundtripService();
