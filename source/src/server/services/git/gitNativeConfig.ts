import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  assertGitRepository,
  GIT_COMMAND_TIMEOUT_MS,
  validateGitBranchName,
} from '../../../core/ai/tools/native/git/gitRunner';
import { getRepoRoot } from '../../../core/ai/tools/pathAllowlist';
import { DEFAULT_GIT_REMOTE_NAME } from '../../../shared/api/contracts/git/constants';

const execFileAsync = promisify(execFile);

export type GitRemoteOrigin = {
  remoteName: string;
  remoteUrl: string;
};

export type EnsureOriginRemoteResult = {
  action: 'added' | 'updated' | 'unchanged';
  previousUrl?: string;
};

export const STANDARD_WORKSPACE_GITIGNORE = `node_modules/
build/
dist/
dev-dist/
coverage/
.DS_Store
*.log
.env*
!.env.example
settings.json
.appendo-git-credentials.json
packages-storage/
workspace/temp/
workspace/**/locks/
workspace/designer/preview-logs/
workspace/appendoo/
workspace/models/
workspace/feedback-attachments/
.ai-session-work/
`;

const runGit = async (
  args: readonly string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> => {
  const { stdout, stderr } = await execFileAsync('git', [...args], {
    cwd,
    timeout: GIT_COMMAND_TIMEOUT_MS,
    encoding: 'utf8',
    env,
  });
  return {
    stdout: String(stdout ?? ''),
    stderr: String(stderr ?? ''),
  };
};

const runGitConfig = async (
  args: readonly string[],
  cwd: string,
): Promise<string | null> => {
  try {
    const { stdout } = await runGit(args, cwd);
    const value = stdout.trim();
    return value || null;
  } catch {
    return null;
  }
};

export const isGitRepository = (cwd: string = getRepoRoot()): boolean => (
  fs.existsSync(path.join(cwd, '.git'))
);

export const initGitRepository = async (
  defaultBranch: string,
  cwd: string = getRepoRoot(),
): Promise<void> => {
  const branch = validateGitBranchName(defaultBranch) ?? 'main';
  try {
    await runGit(['init', '-b', branch], cwd);
  } catch {
    await runGit(['init'], cwd);
    await runGit(['checkout', '-b', branch], cwd);
  }
};

export const ensureWorkspaceGitignore = (cwd: string = getRepoRoot()): boolean => {
  const gitignorePath = path.join(cwd, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    return false;
  }
  fs.writeFileSync(gitignorePath, STANDARD_WORKSPACE_GITIGNORE, 'utf8');
  return true;
};

export const ensureOriginRemote = async (
  remoteUrl: string,
  remoteName: string = DEFAULT_GIT_REMOTE_NAME,
  cwd: string = getRepoRoot(),
): Promise<EnsureOriginRemoteResult> => {
  const trimmedUrl = remoteUrl.trim();
  if (!trimmedUrl) {
    throw new Error('Remote URL is required.');
  }

  const existing = await runGitConfig(['config', '--get', `remote.${remoteName}.url`], cwd);
  if (!existing) {
    await runGit(['remote', 'add', remoteName, trimmedUrl], cwd);
    return { action: 'added' };
  }

  if (existing === trimmedUrl) {
    return { action: 'unchanged' };
  }

  await runGit(['remote', 'set-url', remoteName, trimmedUrl], cwd);
  return { action: 'updated', previousUrl: existing };
};

export const setUpstreamTracking = async (
  branch: string,
  remoteName: string = DEFAULT_GIT_REMOTE_NAME,
  cwd: string = getRepoRoot(),
): Promise<void> => {
  const validated = validateGitBranchName(branch);
  if (!validated) {
    throw new Error('Invalid branch name.');
  }

  await runGit(['branch', '--set-upstream-to', `${remoteName}/${validated}`, validated], cwd);
};

const branchExistsLocally = async (branch: string, cwd: string): Promise<boolean> => {
  try {
    await runGit(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], cwd);
    return true;
  } catch {
    return false;
  }
};

export const checkoutOrCreateBranch = async (
  branch: string,
  cwd: string = getRepoRoot(),
): Promise<void> => {
  const validated = validateGitBranchName(branch);
  if (!validated) {
    throw new Error('Invalid branch name.');
  }

  const current = await runGitConfig(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (current === validated) {
    return;
  }

  if (await branchExistsLocally(validated, cwd)) {
    await runGit(['checkout', validated], cwd);
    return;
  }

  await runGit(['checkout', '-b', validated], cwd);
};

export const readGitRemoteOrigin = async (
  remoteName: string = DEFAULT_GIT_REMOTE_NAME,
): Promise<GitRemoteOrigin | null> => {
  const repoCheck = assertGitRepository();
  const cwd = repoCheck.ok ? repoCheck.repoRoot : getRepoRoot();

  const remoteUrl = await runGitConfig(['config', '--get', `remote.${remoteName}.url`], cwd);
  if (!remoteUrl) {
    return null;
  }

  return { remoteName, remoteUrl };
};

export const readGitDefaultBranch = async (
  remoteName: string = DEFAULT_GIT_REMOTE_NAME,
): Promise<string | null> => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    return null;
  }

  const symbolic = await runGitConfig(
    ['symbolic-ref', '--quiet', `refs/remotes/${remoteName}/HEAD`],
    repoCheck.repoRoot,
  );
  if (symbolic) {
    const parts = symbolic.split('/');
    const branch = parts[parts.length - 1]?.trim();
    if (branch) {
      return branch;
    }
  }

  return await runGitConfig(['config', '--get', 'init.defaultBranch'], repoCheck.repoRoot);
};
