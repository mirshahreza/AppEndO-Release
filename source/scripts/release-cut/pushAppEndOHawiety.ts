#!/usr/bin/env tsx
/**
 * Push staged tree into the private **AppEndO-Hawiety** git clone (sibling repo).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  appendoHawietyStagingDir,
  APPENDO_HAWIETY_REPO_NAME,
  resolveAppEndOHawietyClonePath,
} from './appendoHawietyRepo';
import { syncStagingToClone } from './pushAppEndORelease';
import { readReleaseCutVersions, releaseCutRepoRoot } from './versionManifest';

const REPO_ROOT = releaseCutRepoRoot();

function git(cwd: string, args: string[]): void {
  const child = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });
  if (child.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${child.stderr || child.stdout}`);
  }
}

export function pushAppEndOHawietyTree(options?: { repoRoot?: string; pushRemote?: boolean }): string {
  const repoRoot = options?.repoRoot ?? REPO_ROOT;
  const pushRemote = options?.pushRemote ?? true;
  const versions = readReleaseCutVersions();
  const version = versions.platform;
  const stagingDir = appendoHawietyStagingDir(repoRoot, version);
  const clonePath = resolveAppEndOHawietyClonePath(repoRoot);

  if (!fs.existsSync(stagingDir)) {
    throw new Error(`Missing ${stagingDir} — run npm run release:export-appendo-hawiety first`);
  }

  syncStagingToClone(stagingDir, clonePath);

  git(clonePath, ['add', '-A']);
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: clonePath, encoding: 'utf8' });
  if (!status.stdout?.trim()) {
    return `${APPENDO_HAWIETY_REPO_NAME}: no changes (${clonePath})`;
  }

  const hwy = versions.packages.hawiety ?? '?';
  git(clonePath, ['commit', '-m', `AppEndO Hawiety v${version} (hawiety ${hwy})`]);
  const tagName = `hawiety/v${version}`;
  const tagProbe = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tagName}^{}`], {
    cwd: clonePath,
    encoding: 'utf8',
  });
  if (tagProbe.status === 0) {
    git(clonePath, ['tag', '-d', tagName]);
  }
  git(clonePath, ['tag', '-a', tagName, '-m', `AppEndO Hawiety v${version} · hawiety ${hwy}`]);

  if (pushRemote) {
    const branch =
      spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: clonePath, encoding: 'utf8' }).stdout?.trim() ||
      'main';
    const pushMain = spawnSync('git', ['push', '-u', 'origin', branch], { cwd: clonePath, encoding: 'utf8' });
    if (pushMain.status !== 0) {
      const err = `${pushMain.stderr || pushMain.stdout}`;
      if (err.includes('Repository not found')) {
        throw new Error(
          `GitHub repo missing. Run: gh repo create mirshahreza/${APPENDO_HAWIETY_REPO_NAME} --private && npm run release:push-appendo-hawiety`,
        );
      }
      throw new Error(`git push -u origin ${branch} failed: ${err}`);
    }
    git(clonePath, ['push', 'origin', tagName]);
  }

  return pushRemote
    ? `Pushed ${APPENDO_HAWIETY_REPO_NAME} ${tagName} from ${clonePath}`
    : `Committed ${APPENDO_HAWIETY_REPO_NAME} ${tagName} locally at ${clonePath} (no push)`;
}

function main(): void {
  console.log(pushAppEndOHawietyTree());
}

const isMainModule =
  process.argv[1] != null &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMainModule) {
  main();
}
