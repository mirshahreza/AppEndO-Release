import { createHash } from 'node:crypto';
import type { ApplicationScopeRef } from '../../api/contracts/appendoo/applicationScope.types';
import type {
  CompileChangeGraphInput,
  ChangeGraph,
  ChangeNode,
} from '../../api/contracts/appendoo/changeGraph.types';
import { CHANGE_GRAPH_COMPILER_VERSION } from '../../api/contracts/appendoo/changeGraph.types';
import type {
  CreateEngineeringWorkspaceInput,
  CreateWorkspaceRevisionInput,
  EngineeringWorkspace,
  WorkspaceRevision,
  WorkspaceStorageRef,
} from '../../api/contracts/appendoo/engineeringWorkspace.types';
import {
  ACTIVE_APPLICATION_ROOT_DENY_PATTERNS,
  ENGINEERING_WORKSPACE_MODEL_VERSION,
} from '../../api/contracts/appendoo/engineeringWorkspace.types';

const nowIso = (): string => new Date().toISOString();

const buildId = (prefix: string, seed: string): string => {
  const hash = createHash('sha256').update(`${seed}:${Date.now()}`).digest('hex').slice(0, 12);
  return `${prefix}:${hash}`;
};

const fingerprintRevision = (workspaceId: string, revisionNumber: number, reason: string): string => {
  return createHash('sha256')
    .update(`${workspaceId}:${revisionNumber}:${reason}`)
    .digest('hex')
    .slice(0, 16);
};

const defaultStorageRef = (changeSetId: string): WorkspaceStorageRef => ({
  kind: 'git_branch',
  ref: `appendoo/ws/${changeSetId}`,
  composedFrom: 'git_workspace_service',
});

/** AE-7.1 scaffold — isolated workspace with initial OPEN revision. */
export const createEngineeringWorkspaceScaffold = (
  input: CreateEngineeringWorkspaceInput,
): { workspace: EngineeringWorkspace; revision: WorkspaceRevision } => {
  const scopeKey = input.applicationScope?.scopeKey ?? 'platform:unknown';
  const workspaceId = buildId('ws', `${input.changeSetId}:${scopeKey}`);
  const revisionId = buildId('rev', workspaceId);
  const createdAt = nowIso();
  const revisionNumber = 1;
  const reason = 'initial';
  const revisionFingerprint = fingerprintRevision(workspaceId, revisionNumber, reason);

  const revision: WorkspaceRevision = {
    revisionId,
    workspaceId,
    revisionNumber,
    reason,
    state: 'OPEN',
    revisionFingerprint,
    createdAt,
  };

  const workspace: EngineeringWorkspace = {
    workspaceId,
    applicationScopeRef: scopeKey,
    applicationScopeKey: scopeKey,
    changeSetId: input.changeSetId,
    baseIndexVersion: input.baseIndexVersion,
    baseRuntimeVersion: input.baseRuntimeVersion,
    baseArtifactFingerprints: input.baseArtifactFingerprints ?? [],
    storageRef: input.storageRef ?? defaultStorageRef(input.changeSetId),
    state: 'OPEN',
    currentRevisionId: revisionId,
    createdAt,
    expiresAt: input.expiresAt,
  };

  return { workspace, revision };
};

/** Create child repair revision after verification failure (R1 fail → R2 repair). */
export const createRepairRevisionScaffold = (
  workspace: EngineeringWorkspace,
  currentRevision: WorkspaceRevision,
  input: CreateWorkspaceRevisionInput,
): WorkspaceRevision => {
  const revisionNumber = currentRevision.revisionNumber + 1;
  const createdAt = nowIso();
  const revisionFingerprint = fingerprintRevision(workspace.workspaceId, revisionNumber, input.reason);

  return {
    revisionId: buildId('rev', `${workspace.workspaceId}:${revisionNumber}`),
    workspaceId: workspace.workspaceId,
    parentRevisionId: currentRevision.revisionId,
    revisionNumber,
    reason: input.reason,
    state: 'OPEN',
    baseRevisionFingerprint: currentRevision.revisionFingerprint,
    revisionFingerprint,
    createdAt,
  };
};

/** AE-7.1 scaffold — empty change graph bound to change set and scope. */
export const compileChangeGraphScaffold = (input: CompileChangeGraphInput): ChangeGraph => {
  const scopeKey = input.applicationScope?.scopeKey ?? 'platform:unknown';
  const nodes = input.nodes ?? [];

  return {
    changeGraphId: buildId('cg', `${input.changeSetId}:${scopeKey}`),
    changeSetId: input.changeSetId,
    applicationScopeRef: scopeKey,
    revision: 1,
    nodes,
    compiledAt: nowIso(),
    compilerVersion: CHANGE_GRAPH_COMPILER_VERSION,
  };
};

export const summarizeEngineeringWorkspace = (
  workspace: EngineeringWorkspace,
  revision: WorkspaceRevision,
): {
  workspaceId: string;
  changeSetId: string;
  applicationScopeKey: string;
  revisionId: string;
  revisionNumber: number;
  revisionState: WorkspaceRevision['state'];
  modelVersion: string;
} => ({
  workspaceId: workspace.workspaceId,
  changeSetId: workspace.changeSetId,
  applicationScopeKey: workspace.applicationScopeKey,
  revisionId: revision.revisionId,
  revisionNumber: revision.revisionNumber,
  revisionState: revision.state,
  modelVersion: ENGINEERING_WORKSPACE_MODEL_VERSION,
});

export const isActiveRootMutation = (relativePath: string): boolean => {
  const normalized = relativePath.replace(/\\/g, '/');
  return ACTIVE_APPLICATION_ROOT_DENY_PATTERNS.some((pattern) => {
    const regexSource = pattern
      .replace(/\*\*/g, '§§')
      .replace(/\*/g, '[^/]+')
      .replace(/§§/g, '.*');
    return new RegExp(`^${regexSource}$`).test(normalized);
  });
};

export type { ChangeNode };
