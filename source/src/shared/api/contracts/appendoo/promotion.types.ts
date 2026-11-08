/** Runtime promotion lifecycle (Phase 19). */
export type PromotionState =
  | 'PENDING'
  | 'PREFLIGHT'
  | 'CHECKPOINT'
  | 'STAGING'
  | 'PROMOTING'
  | 'DEPLOYED'
  | 'FAILED'
  | 'ROLLED_BACK';

export type PromotionCheckpoint = {
  checkpointId: string;
  capturedAt: string;
  sourceFingerprints: Record<string, string>;
  packageManifestVersion?: string;
  runtimeRegistrationVersion?: string;
  migrationState?: string;
  indexVersion?: string;
};

export type PromotionPreflightResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/** Promotion run bound to verified workspace revision (Phase 19). */
export type PromotionRun = {
  promotionRunId: string;
  changeSetId: string;
  workspaceId: string;
  revisionId: string;
  revisionFingerprint: string;
  verificationRunId: string;
  state: PromotionState;
  checkpoint?: PromotionCheckpoint;
  preflight?: PromotionPreflightResult;
  deployedAt?: string;
  rolledBackAt?: string;
  packageSnapshotId?: string;
  startedAt: string;
  completedAt?: string;
};

export type PackageDnaStatus = 'PARTIAL' | 'VERIFIED' | 'STALE' | 'FAILED';

export type PackageSnapshotArtifact = {
  path: string;
  fingerprint: string;
};

/** Post-DEPLOYED package snapshot record (Phase 19). */
export type PackageSnapshot = {
  snapshotId: string;
  changeSetId: string;
  promotionRunId: string;
  revisionFingerprint: string;
  manifestVersion: string;
  artifactManifest: PackageSnapshotArtifact[];
  integrityHash: string;
  finalizedAt: string;
  /** AE-9.10 — export manifest roundtrip validated after finalize. */
  roundtripValidated?: boolean;
  exportManifestVersion?: string;
};

export type PackageDnaReport = {
  reportId: string;
  packageId?: string;
  status: PackageDnaStatus;
  sourceFingerprint: string;
  dnaFingerprint: string;
  verificationRef: string;
  compiledAt: string;
};

export type StartPromotionInput = {
  changeSetId: string;
  workspaceId: string;
  revisionId: string;
  revisionFingerprint: string;
  verificationRunId: string;
};

export const PROMOTION_ENGINE_VERSION = '1.0.0';
