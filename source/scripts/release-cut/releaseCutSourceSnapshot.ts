import fs from 'node:fs';
import path from 'node:path';
import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';
import { cloneProfileFor } from './releaseCutCloneProfiles';
import { copyFileEnsured } from './artifacts';
import {
  materializeCloneProfileInSourceRoot,
  materializeCloneRepoRootGitignore,
} from './materializeCloneProfileArtifacts';
import { assertReleaseCutSourceSnapshotSanitized } from './releaseCutSnapshotSanitize';

export const SOURCE_SNAPSHOT_SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'agent-transcripts',
  '.cursor',
  '.claude',
  'terminals',
  'releases',
  'release',
  '.appendo-release-staging',
  '.appendo-hawiety-staging',
  '.appendo-deploy-staging',
  '.release-cut-runs',
]);

/** Hawiety paths must not appear in public OSS source snapshots */
/** Volatile or machine-local paths — never ship in clone snapshots (mirrors key .gitignore rules). */
export const SOURCE_SNAPSHOT_EXCLUDE_DIR_SEGMENTS = [
  `${path.sep}workspace${path.sep}appendoo${path.sep}agent-operational-state${path.sep}`,
  `${path.sep}workspace${path.sep}appendoo${path.sep}agent-runtime-events${path.sep}`,
  `${path.sep}workspace${path.sep}models${path.sep}`,
];

export const OSS_SOURCE_EXCLUDE_SEGMENTS = [
  `${path.sep}src${path.sep}server${path.sep}domain${path.sep}hwy${path.sep}`,
  `${path.sep}src${path.sep}domain${path.sep}hwy${path.sep}`,
  `${path.sep}src${path.sep}features${path.sep}hwy-`,
  `${path.sep}scripts${path.sep}hawiety-pack${path.sep}`,
  `${path.sep}scripts${path.sep}hwy-`,
  `${path.sep}runtime${path.sep}package-artifacts${path.sep}hawiety${path.sep}`,
  `${path.sep}dist${path.sep}release-cut${path.sep}`,
  `${path.sep}plans${path.sep}packages${path.sep}todo${path.sep}hawiety-package${path.sep}`,
];

/** Operator-local files that must never ship in a clone snapshot (repo root only). */
export function isExcludedLocalRuntimeFile(relFile: string): boolean {
  const norm = relFile.replace(/\\/g, '/');
  if (norm === 'settings.json') return true;
  if (norm === '.env') return true;
  if (norm === 'settings.json.install-backup') return true;
  if (norm.startsWith('settings.json.') && norm.endsWith('.tmp')) return true;
  return false;
}

export function isExcludedSnapshotBlob(relFile: string): boolean {
  if (isExcludedLocalRuntimeFile(relFile)) return true;
  const norm = relFile.replace(/\\/g, '/').toLowerCase();
  if (norm.endsWith('.onnx')) return true;
  return false;
}

function shouldExcludeOssSourcePath(absPath: string): boolean {
  const norm = absPath.replace(/\//g, path.sep);
  if (norm.includes(`${path.sep}hawiety-`) && norm.endsWith('.zip')) return true;
  return OSS_SOURCE_EXCLUDE_SEGMENTS.some((seg) => norm.includes(seg));
}

function shouldSkipDirectoryEntry(options: {
  mode: 'oss' | 'full';
  absPath: string;
  profileExtraSegments: string[];
}): boolean {
  const norm = options.absPath.replace(/\//g, path.sep);
  if (SOURCE_SNAPSHOT_EXCLUDE_DIR_SEGMENTS.some((seg) => norm.includes(seg))) return true;
  if (options.mode === 'oss' && shouldExcludeOssSourcePath(norm)) return true;
  return options.profileExtraSegments.some((seg) => norm.includes(seg));
}

export type CopySourceSnapshotOptions = {
  repoRoot: string;
  destRoot: string;
  mode: 'oss' | 'full';
  cloneProfileId: ReleaseCutCloneProfileId;
  sourceReadmeLines: string[];
};

export function copyReleaseCutSourceSnapshot(options: CopySourceSnapshotOptions): void {
  const { repoRoot, destRoot, mode, cloneProfileId, sourceReadmeLines } = options;
  const profile = cloneProfileFor(cloneProfileId);
  const sourceRoot = path.join(destRoot, 'source');
  fs.mkdirSync(sourceRoot, { recursive: true });

  const profileExtraSegments = profile.sourcePathExcludeSegments ?? [];

  const walk = (absDir: string): void => {
    if (shouldSkipDirectoryEntry({ mode, absPath: absDir, profileExtraSegments })) return;

    const relDir = path.relative(repoRoot, absDir);
    if (relDir) {
      fs.mkdirSync(path.join(sourceRoot, relDir), { recursive: true });
    }

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const full = path.join(absDir, entry.name);
      const rel = path.relative(repoRoot, full);
      if (!rel) continue;
      if (SOURCE_SNAPSHOT_SKIP_DIR_NAMES.has(entry.name)) continue;
      if (shouldSkipDirectoryEntry({ mode, absPath: full, profileExtraSegments })) continue;

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (isExcludedSnapshotBlob(rel)) continue;
        copyFileEnsured(full, path.join(sourceRoot, rel));
      }
    }
  };

  walk(repoRoot);

  const readmeName = mode === 'oss' ? 'PUBLIC_SOURCE_README.txt' : 'DEPLOY_SOURCE_README.txt';
  fs.writeFileSync(path.join(sourceRoot, readmeName), `${sourceReadmeLines.join('\n')}\n`, 'utf8');

  materializeCloneProfileInSourceRoot(sourceRoot, cloneProfileId);
  materializeCloneRepoRootGitignore(destRoot);
  assertReleaseCutSourceSnapshotSanitized(sourceRoot);
}
