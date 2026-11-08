import { createHash } from 'node:crypto';
import type {
  PackageSnapshot,
  PackageSnapshotArtifact,
} from '../../api/contracts/appendoo/promotion.types';
import { PACKAGE_SNAPSHOT_MANIFEST_VERSION } from './packageSnapshotFinalizeScaffold';

export const PACKAGE_SNAPSHOT_EXPORT_MANIFEST_VERSION = '1.0.0';

export type PackageSnapshotExportManifest = {
  manifestVersion: string;
  snapshotId: string;
  changeSetId: string;
  promotionRunId: string;
  revisionFingerprint: string;
  snapshotManifestVersion: string;
  integrityHash: string;
  artifactManifest: PackageSnapshotArtifact[];
  exportedAt: string;
};

export type PackageSnapshotRoundtripResult = {
  ok: boolean;
  errors: string[];
  manifest: PackageSnapshotExportManifest;
};

const recomputeIntegrityHash = (input: {
  changeSetId: string;
  revisionFingerprint: string;
  promotionRunId: string;
  artifactManifest: PackageSnapshotArtifact[];
}): string => (
  createHash('sha256')
    .update(JSON.stringify({
      changeSetId: input.changeSetId,
      revisionFingerprint: input.revisionFingerprint,
      promotionRunId: input.promotionRunId,
      artifactManifest: input.artifactManifest,
    }))
    .digest('hex')
    .slice(0, 24)
);

/** AE-9.10 — build portable export manifest from finalized snapshot. */
export const buildPackageSnapshotExportManifest = (
  snapshot: PackageSnapshot,
  exportedAt = new Date().toISOString(),
): PackageSnapshotExportManifest => ({
  manifestVersion: PACKAGE_SNAPSHOT_EXPORT_MANIFEST_VERSION,
  snapshotId: snapshot.snapshotId,
  changeSetId: snapshot.changeSetId,
  promotionRunId: snapshot.promotionRunId,
  revisionFingerprint: snapshot.revisionFingerprint,
  snapshotManifestVersion: snapshot.manifestVersion,
  integrityHash: snapshot.integrityHash,
  artifactManifest: snapshot.artifactManifest,
  exportedAt,
});

export const parsePackageSnapshotExportManifest = (
  raw: unknown,
): PackageSnapshotExportManifest | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const input = raw as Partial<PackageSnapshotExportManifest>;
  if (
    typeof input.manifestVersion !== 'string'
    || typeof input.snapshotId !== 'string'
    || typeof input.changeSetId !== 'string'
    || typeof input.promotionRunId !== 'string'
    || typeof input.revisionFingerprint !== 'string'
    || typeof input.integrityHash !== 'string'
    || !Array.isArray(input.artifactManifest)
  ) {
    return null;
  }

  const artifactManifest = input.artifactManifest.filter((item): item is PackageSnapshotArtifact => (
    Boolean(item)
    && typeof item === 'object'
    && typeof (item as PackageSnapshotArtifact).path === 'string'
    && typeof (item as PackageSnapshotArtifact).fingerprint === 'string'
  ));

  return {
    manifestVersion: input.manifestVersion,
    snapshotId: input.snapshotId,
    changeSetId: input.changeSetId,
    promotionRunId: input.promotionRunId,
    revisionFingerprint: input.revisionFingerprint,
    snapshotManifestVersion: typeof input.snapshotManifestVersion === 'string'
      ? input.snapshotManifestVersion
      : PACKAGE_SNAPSHOT_MANIFEST_VERSION,
    integrityHash: input.integrityHash,
    artifactManifest,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString(),
  };
};

/** AE-9.10 — serialize → parse → integrity roundtrip validation. */
export const validatePackageSnapshotRoundtrip = (
  snapshot: PackageSnapshot,
): PackageSnapshotRoundtripResult => {
  const errors: string[] = [];
  const manifest = buildPackageSnapshotExportManifest(snapshot);
  const serialized = JSON.stringify(manifest);
  const parsed = parsePackageSnapshotExportManifest(JSON.parse(serialized));

  if (!parsed) {
    return {
      ok: false,
      errors: ['Export manifest failed to parse after serialization.'],
      manifest,
    };
  }

  if (parsed.snapshotId !== snapshot.snapshotId) {
    errors.push('Export manifest snapshotId mismatch.');
  }
  if (parsed.integrityHash !== snapshot.integrityHash) {
    errors.push('Export manifest integrityHash mismatch.');
  }
  if (parsed.artifactManifest.length !== snapshot.artifactManifest.length) {
    errors.push('Export manifest artifact count mismatch.');
  }

  const recomputed = recomputeIntegrityHash({
    changeSetId: parsed.changeSetId,
    revisionFingerprint: parsed.revisionFingerprint,
    promotionRunId: parsed.promotionRunId,
    artifactManifest: parsed.artifactManifest,
  });

  if (recomputed !== parsed.integrityHash) {
    errors.push('Export manifest integrity hash failed roundtrip recompute.');
  }

  return {
    ok: errors.length === 0,
    errors,
    manifest,
  };
};

/** JSON export buffer for scaffold roundtrip (no live ZIP). */
export const buildPackageSnapshotExportBuffer = (
  snapshot: PackageSnapshot,
): Buffer => Buffer.from(`${JSON.stringify(buildPackageSnapshotExportManifest(snapshot), null, 2)}\n`, 'utf8');
