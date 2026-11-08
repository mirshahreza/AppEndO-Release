import { spawnSync } from 'node:child_process';

function git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const child = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return {
    ok: child.status === 0,
    stdout: (child.stdout ?? '').trim(),
    stderr: (child.stderr ?? '').trim(),
  };
}

function gitOrThrow(args: string[], cwd: string): string {
  const result = git(args, cwd);
  if (!result.ok) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export function getHeadSha(cwd: string): string {
  return gitOrThrow(['rev-parse', 'HEAD'], cwd);
}

export function getCurrentBranch(cwd: string): string {
  return gitOrThrow(['branch', '--show-current'], cwd);
}

export function isWorkingTreeClean(cwd: string): boolean {
  return git(['status', '--porcelain'], cwd).stdout.length === 0;
}

export function createReleaseCommit(cwd: string, message: string): string {
  gitOrThrow(
    [
      'add',
      'scripts/release-cut/releaseCutVersions.json',
      'package.json',
      'scripts/cms-phase1/pack-cms-package.ts',
      'src/core/packages/hawietyPackage.ts',
      'src/core/packages/remoteHubsPackage.ts',
    ],
    cwd,
  );
  gitOrThrow(['commit', '-m', message], cwd);
  return getHeadSha(cwd);
}

export function createAnnotatedTag(cwd: string, tagName: string, message: string): void {
  gitOrThrow(['tag', '-a', tagName, '-m', message], cwd);
}

export function deleteLocalTag(cwd: string, tagName: string): void {
  git(['tag', '-d', tagName], cwd);
}

export function tagExists(cwd: string, tagName: string): boolean {
  const result = git(['rev-parse', `refs/tags/${tagName}`], cwd);
  return result.ok;
}

export function ensureAnnotatedTag(cwd: string, tagName: string, message: string): void {
  if (tagExists(cwd, tagName)) return;
  createAnnotatedTag(cwd, tagName, message);
}

export function pushRelease(cwd: string, tagName: string): void {
  gitOrThrow(['push'], cwd);
  gitOrThrow(['push', 'origin', tagName], cwd);
}
