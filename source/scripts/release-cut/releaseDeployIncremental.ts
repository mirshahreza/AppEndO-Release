import fs from 'node:fs';
import path from 'node:path';
import { copyFileEnsured, sha256File } from './artifacts';
import {
  RELEASE_CUT_INCREMENTAL_DEPLOY_DIRS,
  type ReleaseCutServerDeployTargetId,
  resolveServerDeployPublicUrl,
  resolveServerDeployRoot,
  stagingDirForDeployTarget,
} from './releaseCutServerDeployTargets';
import { readReleaseCutVersions, releaseCutRepoRoot } from './versionManifest';

const DEPLOY_STATE_FILE = '.appendo-deploy-state.json';

export type DeployFileEntry = { rel: string; sha256: string };

export type DeployState = {
  targetId: ReleaseCutServerDeployTargetId;
  platformVersion: string;
  deployedAt: string;
  publicUrl?: string;
  files: DeployFileEntry[];
};

export type IncrementalDeployResult = {
  targetId: ReleaseCutServerDeployTargetId;
  targetRoot: string;
  stagingDir: string;
  copied: number;
  skipped: number;
  removedStale: number;
};

type PackageArtifactRow = { packageId: string; fileName: string; sha256: string };

function readStagingManifest(stagingDir: string): {
  platformVersion: string;
  packageArtifacts: PackageArtifactRow[];
} {
  const manifestPath = path.join(stagingDir, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath} — run export for this target first`);
  }
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    platformVersion?: string;
    packageArtifacts?: PackageArtifactRow[];
  };
  return {
    platformVersion: String(parsed.platformVersion ?? readReleaseCutVersions().platform),
    packageArtifacts: Array.isArray(parsed.packageArtifacts) ? parsed.packageArtifacts : [],
  };
}

function listFilesUnder(stagingDir: string, relDir: string): string[] {
  const abs = path.join(stagingDir, relDir);
  if (!fs.existsSync(abs)) {
    return [];
  }
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else {
        out.push(`${relDir}/${rel}`.replace(/\\/g, '/'));
      }
    }
  };
  walk(abs, '');
  return out;
}

function buildDesiredFileMap(stagingDir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const dir of RELEASE_CUT_INCREMENTAL_DEPLOY_DIRS) {
    for (const rel of listFilesUnder(stagingDir, dir)) {
      const abs = path.join(stagingDir, rel);
      map.set(rel.replace(/\\/g, '/'), sha256File(abs));
    }
  }

  const { packageArtifacts } = readStagingManifest(stagingDir);
  for (const row of packageArtifacts) {
    const underPackages = `packages/${row.fileName}`;
    const absPackages = path.join(stagingDir, underPackages);
    if (fs.existsSync(absPackages)) {
      map.set(underPackages, row.sha256);
    }
  }

  return map;
}

function readDeployState(targetRoot: string): DeployState | undefined {
  const statePath = path.join(targetRoot, DEPLOY_STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf8')) as DeployState;
}

function writeDeployState(targetRoot: string, state: DeployState): void {
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.writeFileSync(path.join(targetRoot, DEPLOY_STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function incrementalDeployToTarget(options: {
  targetId: ReleaseCutServerDeployTargetId;
  repoRoot?: string;
  platformVersion?: string;
  stagingDir?: string;
  targetRoot?: string;
  full?: boolean;
  dryRun?: boolean;
  pruneRemovedFiles?: boolean;
}): IncrementalDeployResult {
  const repoRoot = options.repoRoot ?? releaseCutRepoRoot();
  const platformVersion = options.platformVersion ?? readReleaseCutVersions().platform;
  const stagingDir =
    options.stagingDir ?? stagingDirForDeployTarget(options.targetId, repoRoot, platformVersion);
  if (!fs.existsSync(stagingDir)) {
    throw new Error(
      `Missing staging ${stagingDir} — run release:export for ${options.targetId} (platform v${platformVersion}) first`,
    );
  }

  const targetRoot = options.targetRoot ?? resolveServerDeployRoot(options.targetId, repoRoot);
  const desired = buildDesiredFileMap(stagingDir);
  const prior = options.full ? undefined : readDeployState(targetRoot);
  const priorByRel = new Map((prior?.files ?? []).map((f) => [f.rel, f.sha256]));

  let copied = 0;
  let skipped = 0;

  for (const [rel, sha256] of desired) {
    if (!options.full && priorByRel.get(rel) === sha256) {
      skipped += 1;
      continue;
    }
    const src = path.join(stagingDir, rel);
    const dest = path.join(targetRoot, rel);
    if (!fs.existsSync(src)) {
      continue;
    }
    if (options.dryRun) {
      copied += 1;
      continue;
    }
    copyFileEnsured(src, dest);
    copied += 1;
  }

  let removedStale = 0;
  if (options.pruneRemovedFiles && prior && !options.dryRun) {
    const desiredRels = new Set(desired.keys());
    for (const old of prior.files) {
      if (desiredRels.has(old.rel)) {
        continue;
      }
      const stale = path.join(targetRoot, old.rel);
      if (fs.existsSync(stale)) {
        fs.rmSync(stale, { force: true });
        removedStale += 1;
      }
    }
  }

  const files: DeployFileEntry[] = [...desired.entries()].map(([rel, sha256]) => ({ rel, sha256 }));
  if (!options.dryRun) {
    writeDeployState(targetRoot, {
      targetId: options.targetId,
      platformVersion,
      deployedAt: new Date().toISOString(),
      publicUrl: resolveServerDeployPublicUrl(options.targetId, repoRoot),
      files,
    });
  }

  return {
    targetId: options.targetId,
    targetRoot,
    stagingDir,
    copied,
    skipped,
    removedStale,
  };
}

export function deployReleaseCutTargets(options: {
  targetIds: ReleaseCutServerDeployTargetId[];
  repoRoot?: string;
  full?: boolean;
  dryRun?: boolean;
}): IncrementalDeployResult[] {
  return options.targetIds.map((targetId) =>
    incrementalDeployToTarget({
      targetId,
      repoRoot: options.repoRoot,
      full: options.full,
      dryRun: options.dryRun,
    }),
  );
}