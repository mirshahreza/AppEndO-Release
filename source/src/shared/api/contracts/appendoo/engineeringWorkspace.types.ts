import type { ApplicationScopeRef } from './applicationScope.types';

export type EngineeringWorkspaceState =
  | 'OPEN'
  | 'FROZEN_FOR_VERIFICATION'
  | 'VERIFIED'
  | 'FAILED'
  | 'DISCARDED';

export type WorkspaceRevisionState =
  | 'OPEN'
  | 'FROZEN_FOR_VERIFICATION'
  | 'VERIFIED'
  | 'FAILED';

export type WorkspaceArtifactFingerprint = {
  artifactId: string;
  fingerprint: string;
  path?: string;
};

export type WorkspaceStorageRef = {
  kind: 'git_worktree' | 'git_branch' | 'isolated_path';
  ref: string;
  /** Composed from existing Git workspace primitives where applicable. */
  composedFrom?: 'appendoo_git_mcp' | 'git_workspace_service';
};

/** Isolated mutation workspace (Phase 15). */
export type EngineeringWorkspace = {
  workspaceId: string;
  applicationScopeRef: string;
  applicationScopeKey: string;
  changeSetId: string;
  baseIndexVersion?: string;
  baseRuntimeVersion?: string;
  baseArtifactFingerprints: WorkspaceArtifactFingerprint[];
  storageRef: WorkspaceStorageRef;
  state: EngineeringWorkspaceState;
  currentRevisionId: string;
  createdAt: string;
  expiresAt?: string;
  promotedAt?: string;
};

export type WorkspaceRevision = {
  revisionId: string;
  workspaceId: string;
  parentRevisionId?: string;
  revisionNumber: number;
  reason: string;
  state: WorkspaceRevisionState;
  baseRevisionFingerprint?: string;
  revisionFingerprint: string;
  createdAt: string;
  frozenAt?: string;
  verificationRunId?: string;
};

export type CreateEngineeringWorkspaceInput = {
  changeSetId: string;
  applicationScope: ApplicationScopeRef | null;
  baseIndexVersion?: string;
  baseRuntimeVersion?: string;
  baseArtifactFingerprints?: WorkspaceArtifactFingerprint[];
  storageRef?: WorkspaceStorageRef;
  expiresAt?: string;
};

export type CreateWorkspaceRevisionInput = {
  workspaceId: string;
  parentRevisionId?: string;
  reason: string;
};

export type WorkspaceRevisionVerificationResult = {
  passed: boolean;
  verificationRunId: string;
  revisionFingerprint: string;
  at: string;
};

export const ENGINEERING_WORKSPACE_MODEL_VERSION = '1.0.0';

/** Active application roots builders must not write to (Phase 15 hard rule). */
export const ACTIVE_APPLICATION_ROOT_DENY_PATTERNS = [
  'src/features/**/components/**',
  'src/server/routes/**',
  'src/server/services/**',
] as const;
