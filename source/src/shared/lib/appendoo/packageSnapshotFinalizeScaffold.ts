import { createHash } from 'node:crypto';
import type {
  PackageSnapshot,
  PackageSnapshotArtifact,
  PromotionRun,
} from '../../api/contracts/appendoo/promotion.types';

export const PACKAGE_SNAPSHOT_MANIFEST_VERSION = '1.0.0';

const fingerprintArtifact = (path: string, revisionFingerprint: string): string => (
  createHash('sha256').update(`${revisionFingerprint}:${path}`).digest('hex').slice(0, 16)
);

export const buildPackageSnapshotManifest = (
  mutationPaths: string[],
  revisionFingerprint: string,
): PackageSnapshotArtifact[] => (
  mutationPaths.map((artifactPath) => ({
    path: artifactPath,
    fingerprint: fingerprintArtifact(artifactPath, revisionFingerprint),
  }))
);

/** AE-9.9 — finalize package snapshot after DEPLOYED promotion. */
export const finalizePackageSnapshotScaffold = (
  run: PromotionRun,
  mutationPaths: string[] = [],
): { run: PromotionRun; snapshot: PackageSnapshot | null } => {
  if (run.state !== 'DEPLOYED') {
    return { run, snapshot: null };
  }

  const artifactManifest = buildPackageSnapshotManifest(mutationPaths, run.revisionFingerprint);
  const integrityHash = createHash('sha256')
    .update(JSON.stringify({
      changeSetId: run.changeSetId,
      revisionFingerprint: run.revisionFingerprint,
      promotionRunId: run.promotionRunId,
      artifactManifest,
    }))
    .digest('hex')
    .slice(0, 24);

  const snapshotId = run.packageSnapshotId ?? `pkg-snap:${integrityHash.slice(0, 12)}`;
  const snapshot: PackageSnapshot = {
    snapshotId,
    changeSetId: run.changeSetId,
    promotionRunId: run.promotionRunId,
    revisionFingerprint: run.revisionFingerprint,
    manifestVersion: PACKAGE_SNAPSHOT_MANIFEST_VERSION,
    artifactManifest,
    integrityHash,
    finalizedAt: new Date().toISOString(),
  };

  return {
    run: {
      ...run,
      packageSnapshotId: snapshotId,
    },
    snapshot,
  };
};
