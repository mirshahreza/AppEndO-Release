#!/usr/bin/env tsx
/**
 * Push staged AppEndO-Release tree into the public **AppEndO-Release** git clone (sibling repo).
 *
 * Prereqs:
 *   - npm run release:export-appendo-release (after green build)
 *   - git clone <public-remote> ../AppEndO-Release  (or set APPENDO_RELEASE_REPO_PATH)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { appendoReleaseStagingDir, APPENDO_RELEASE_REPO_NAME, resolveAppEndOReleaseClonePath } from './appendoReleaseRepo';
import { assertReleaseCutSourceSnapshotSanitized } from './releaseCutSnapshotSanitize';
import { readReleaseCutVersions, releaseCutRepoRoot } from './versionManifest';

const REPO_ROOT = releaseCutRepoRoot();

const GIT_SPAWN_OPTS = {
  encoding: 'utf8' as const,
  shell: false as const,
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
};

function git(cwd: string, args: string[]): void {
  const child = spawnSync('git', args, { cwd, ...GIT_SPAWN_OPTS });
  if (child.error) {
    throw new Error(`git ${args.join(' ')} failed: ${child.error.message}`);
  }
  if (child.status !== 0) {
    const err = child.stderr || child.stdout || '';
    const tail = err.length > 4000 ? `${err.slice(-4000)}` : err;
    throw new Error(`git ${args.join(' ')} failed: ${tail}`);
  }
}

export function syncStagingToClone(stagingDir: string, clonePath: string): void {
  if (!fs.existsSync(path.join(clonePath, '.git'))) {
    throw new Error(`Missing git clone at ${clonePath}. git clone <remote-url> "${clonePath}"`);
  }

  spawnSync('git', ['fetch', 'origin'], { cwd: clonePath, ...GIT_SPAWN_OPTS });
  const branch =
    spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: clonePath, ...GIT_SPAWN_OPTS }).stdout?.trim() ||
    'main';
  const resetRemote = spawnSync('git', ['reset', '--hard', `origin/${branch}`], {
    cwd: clonePath,
    ...GIT_SPAWN_OPTS,
  });
  if (resetRemote.status !== 0) {
    git(clonePath, ['reset', '--hard']);
    spawnSync('git', ['clean', '-fdx'], { cwd: clonePath, ...GIT_SPAWN_OPTS });
  }

  const sourceDir = path.join(stagingDir, 'source');
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing ${sourceDir} — run npm run release:export-appendo-release first`);
  }
  assertReleaseCutSourceSnapshotSanitized(sourceDir);

  for (const name of fs.readdirSync(clonePath)) {
    if (name === '.git') continue;
    fs.rmSync(path.join(clonePath, name), { recursive: true, force: true });
  }

  for (const entry of fs.readdirSync(stagingDir, { withFileTypes: true })) {
    const src = path.join(stagingDir, entry.name);
    const dest = path.join(clonePath, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

export function pushAppEndOReleaseTree(options?: { repoRoot?: string; pushRemote?: boolean }): string {
  const repoRoot = options?.repoRoot ?? REPO_ROOT;
  const pushRemote = options?.pushRemote ?? true;
  const version = readReleaseCutVersions().platform;
  const stagingDir = appendoReleaseStagingDir(repoRoot, version);
  const clonePath = resolveAppEndOReleaseClonePath(repoRoot);

  if (!fs.existsSync(stagingDir)) {
    throw new Error(`Missing ${stagingDir} — run npm run release:export-appendo-release first`);
  }

  syncStagingToClone(stagingDir, clonePath);

  git(clonePath, ['add', '-A']);
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: clonePath, encoding: 'utf8' });
  if (!status.stdout?.trim()) {
    return `AppEndO-Release: no changes (${clonePath})`;
  }

  git(clonePath, ['commit', '-m', `AppEndO public release v${version}`]);
  const tagName = `v${version}`;
  const tagProbe = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tagName}^{}`], {
    cwd: clonePath,
    encoding: 'utf8',
  });
  if (tagProbe.status === 0) {
    git(clonePath, ['tag', '-d', tagName]);
  }
  git(clonePath, ['tag', '-a', tagName, '-m', `AppEndO v${version}`]);

  if (pushRemote) {
    const branch =
      spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: clonePath, encoding: 'utf8' }).stdout?.trim() ||
      'main';
    const pushMain = spawnSync('git', ['push', '-u', 'origin', branch], { cwd: clonePath, encoding: 'utf8' });
    if (pushMain.status !== 0) {
      const err = `${pushMain.stderr || pushMain.stdout}`;
      if (err.includes('Repository not found')) {
        throw new Error(
          `GitHub repo missing for origin. Run: gh auth login && gh repo create mirshahreza/${APPENDO_RELEASE_REPO_NAME} --public && npm run release:push-appendo-release`,
        );
      }
      throw new Error(`git push -u origin ${branch} failed: ${err}`);
    }
    spawnSync('git', ['push', 'origin', `:refs/tags/${tagName}`], { cwd: clonePath, ...GIT_SPAWN_OPTS });
    git(clonePath, ['push', 'origin', tagName]);
  }

  return pushRemote
    ? `Pushed ${APPENDO_RELEASE_REPO_NAME} ${tagName} from ${clonePath}`
    : `Committed ${APPENDO_RELEASE_REPO_NAME} ${tagName} locally at ${clonePath} (no push)`;
}

function main(): void {
  console.log(pushAppEndOReleaseTree());
}

const isMainModule =
  process.argv[1] != null &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMainModule) {
  main();
}
