import fs from 'node:fs';
import path from 'node:path';
import {
  appendoVerticalStagingDir,
  APPENDO_VERTICAL_REPO_NAME,
  resolveAppEndOVerticalClonePath,
} from './appendoVerticalRepo';
import {
  appendoReleaseStagingDir,
  APPENDO_RELEASE_REPO_NAME,
  resolveAppEndOReleaseClonePath,
} from './appendoReleaseRepo';
import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';
import { releaseCutRepoRoot } from './versionManifest';

/** Production server deploy target — one isolated root + public URL per git line. */
export type ReleaseCutServerDeployTargetId = 'oss' | 'vertical';

export type ReleaseCutServerDeployTarget = {
  targetId: ReleaseCutServerDeployTargetId;
  cloneProfileId: ReleaseCutCloneProfileId;
  label: string;
  publishRepoName: string;
  /** Filesystem root on the server (UNC, local mirror, or SSH-mounted path). */
  deployRootEnvVar: string;
  /** Optional public base URL for smoke / operator docs (never used for file transfer). */
  deployUrlEnvVar: string;
};

export const RELEASE_CUT_SERVER_DEPLOY_TARGETS: Record<
  ReleaseCutServerDeployTargetId,
  ReleaseCutServerDeployTarget
> = {
  oss: {
    targetId: 'oss',
    cloneProfileId: 'oss',
    label: 'AppEndO-Release production',
    publishRepoName: APPENDO_RELEASE_REPO_NAME,
    deployRootEnvVar: 'APPENDO_DEPLOY_ROOT_OSS',
    deployUrlEnvVar: 'APPENDO_DEPLOY_URL_OSS',
  },
  vertical: {
    targetId: 'vertical',
    cloneProfileId: 'vertical',
    label: 'AppEndO-Vertical production',
    publishRepoName: APPENDO_VERTICAL_REPO_NAME,
    deployRootEnvVar: 'APPENDO_DEPLOY_ROOT_VERTICAL',
    deployUrlEnvVar: 'APPENDO_DEPLOY_URL_VERTICAL',
  },
};

const PER_LINE_LOCAL_FILE = 'deploy.target.local.json';
const PER_LINE_EXAMPLE_FILE = 'deploy.target.example.json';

export type DeployTargetLocalConfig = {
  deployRoot?: string;
  publicUrl?: string;
};

/** Sibling publish clone (../AppEndO-Release or ../AppEndO-Vertical). */
export function resolvePublishClonePath(
  targetId: ReleaseCutServerDeployTargetId,
  repoRoot = releaseCutRepoRoot(),
): string {
  if (targetId === 'oss') {
    return resolveAppEndOReleaseClonePath(repoRoot);
  }
  return resolveAppEndOVerticalClonePath(repoRoot);
}

export function deployTargetLocalConfigPath(
  targetId: ReleaseCutServerDeployTargetId,
  repoRoot = releaseCutRepoRoot(),
): string {
  return path.join(resolvePublishClonePath(targetId, repoRoot), PER_LINE_LOCAL_FILE);
}

export function deployTargetExampleConfigPath(
  targetId: ReleaseCutServerDeployTargetId,
  repoRoot = releaseCutRepoRoot(),
): string {
  return path.join(resolvePublishClonePath(targetId, repoRoot), PER_LINE_EXAMPLE_FILE);
}

function readPublishCloneLocalConfig(
  targetId: ReleaseCutServerDeployTargetId,
  repoRoot: string,
): DeployTargetLocalConfig | undefined {
  const abs = deployTargetLocalConfigPath(targetId, repoRoot);
  if (!fs.existsSync(abs)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8')) as DeployTargetLocalConfig;
}

export function resolveServerDeployRoot(
  targetId: ReleaseCutServerDeployTargetId,
  repoRoot = releaseCutRepoRoot(),
): string {
  const target = RELEASE_CUT_SERVER_DEPLOY_TARGETS[targetId];
  const local = readPublishCloneLocalConfig(targetId, repoRoot)?.deployRoot?.trim();
  if (local) {
    return local;
  }
  const fromEnv = process.env[target.deployRootEnvVar]?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const clonePath = resolvePublishClonePath(targetId, repoRoot);
  throw new Error(
    `Missing deploy root for ${targetId}. In the publish clone \`${clonePath}\`, copy deploy.target.example.json → deploy.target.local.json, or set ${target.deployRootEnvVar}.`,
  );
}

export function resolveServerDeployPublicUrl(
  targetId: ReleaseCutServerDeployTargetId,
  repoRoot = releaseCutRepoRoot(),
): string | undefined {
  const target = RELEASE_CUT_SERVER_DEPLOY_TARGETS[targetId];
  const local = readPublishCloneLocalConfig(targetId, repoRoot)?.publicUrl?.trim();
  if (local) {
    return local;
  }
  const fromEnv = process.env[target.deployUrlEnvVar]?.trim();
  return fromEnv || undefined;
}

export function stagingDirForDeployTarget(
  targetId: ReleaseCutServerDeployTargetId,
  repoRoot: string,
  platformVersion: string,
): string {
  if (targetId === 'oss') {
    return appendoReleaseStagingDir(repoRoot, platformVersion);
  }
  return appendoVerticalStagingDir(repoRoot, platformVersion);
}

export const RELEASE_CUT_INCREMENTAL_DEPLOY_DIRS = ['dist', 'packages'] as const;