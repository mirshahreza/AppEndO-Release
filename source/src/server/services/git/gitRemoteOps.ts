import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  assertGitRepository,
  getGitCurrentBranch,
  GIT_COMMAND_TIMEOUT_MS,
  GIT_MAX_OUTPUT_BYTES,
  runGit,
  truncateGitOutput,
  type RunGitFailure,
  type RunGitSuccess,
} from '../../../core/ai/tools/native/git/gitRunner';
import type { GitMutationResult, GitSettings } from '../../../shared/api/contracts/git/types';
import { HttpError } from '../../errors/HttpError';
import { buildGitExecEnv } from './gitConnection';
import { getGitChanges, stageGitPaths } from './gitWorkspace';
import { resolveGitRuntime, type GitRuntimeContext } from './gitRuntime';

const execFileAsync = promisify(execFile);

const MAX_COMMIT_MESSAGE_LENGTH = 500;

const assertGitEnabledOrThrow = (settings: GitSettings): void => {
  if (!settings.enabled) {
    throw new HttpError(400, 'Git integration is disabled.');
  }
};

const resolveRuntimeOrThrow = async (settings: GitSettings): Promise<GitRuntimeContext> => {
  const runtime = await resolveGitRuntime(settings);
  if (!runtime.remoteUrl.trim()) {
    throw new HttpError(400, 'Remote URL is not configured.');
  }
  return runtime;
};

const runGitWithRuntime = async (
  runtime: GitRuntimeContext,
  args: readonly string[],
): Promise<RunGitSuccess | RunGitFailure> => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    return { ok: false, error: 'not_a_git_repo', summary: repoCheck.error };
  }

  const env = buildGitExecEnv(runtime.auth);

  try {
    const { stdout, stderr } = await execFileAsync('git', [...args], {
      cwd: repoCheck.repoRoot,
      timeout: GIT_COMMAND_TIMEOUT_MS,
      maxBuffer: GIT_MAX_OUTPUT_BYTES + 64_000,
      encoding: 'utf8',
      env,
    });
    const truncatedStdout = truncateGitOutput(stdout);
    const truncatedStderr = truncateGitOutput(stderr);
    return {
      ok: true,
      stdout: truncatedStdout.text,
      stderr: truncatedStderr.text,
      truncated: truncatedStdout.truncated || truncatedStderr.truncated,
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        signal?: string;
      };
      if (execError.killed || execError.signal === 'SIGTERM') {
        return { ok: false, error: 'timeout', summary: 'Git command timed out.' };
      }

      const out = truncateGitOutput(String(execError.stdout ?? ''));
      const err = truncateGitOutput(String(execError.stderr ?? ''));
      const combined = [out.text, err.text].filter((chunk) => chunk.trim().length > 0).join('\n');
      if (combined.trim()) {
        return { ok: false, error: 'git_failed', summary: combined.trim() };
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: 'git_failed', summary: `Git command failed: ${message}` };
  }
};

const assertGitRepositoryOrThrow = async (): Promise<void> => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    throw new HttpError(400, repoCheck.error);
  }
};

const assertGitCommandSuccess = (
  result: RunGitSuccess | RunGitFailure,
  action: string,
): void => {
  if (result.ok === false) {
    throw new HttpError(400, result.summary || `Git ${action} failed.`);
  }
};

const resolveActiveBranch = async (): Promise<string> => {
  const branch = await getGitCurrentBranch();
  if (!branch || branch === 'HEAD') {
    throw new HttpError(400, 'Could not resolve the current branch.');
  }
  return branch;
};

const formatPathSummary = (paths: string[]): string => {
  if (paths.length === 0) {
    return '';
  }
  if (paths.length === 1) {
    return paths[0];
  }
  if (paths.length === 2) {
    return `${paths[0]} and ${paths[1]}`;
  }
  return `${paths[0]}, ${paths[1]} and ${paths.length - 2} more`;
};

export const suggestGitCommitMessage = async (
  settings: GitSettings,
  paths?: string[],
): Promise<{ message: string }> => {
  await assertGitRepositoryOrThrow();
  const changes = await getGitChanges();
  let candidates = changes.entries.filter((entry) => entry.section === 'staged');

  if (Array.isArray(paths) && paths.length > 0) {
    const pathSet = new Set(paths);
    candidates = changes.entries.filter((entry) => pathSet.has(entry.path));
  }

  if (candidates.length === 0) {
    throw new HttpError(400, 'No changes to suggest a commit message for.');
  }

  const modified = candidates.filter((entry) => entry.statusCode === 'M' || entry.statusCode === 'R').map((e) => e.path);
  const added = candidates.filter((entry) => entry.statusCode === 'A' || entry.statusCode === 'C').map((e) => e.path);
  const deleted = candidates.filter((entry) => entry.statusCode === 'D').map((e) => e.path);
  const other = candidates
    .filter((entry) => !['M', 'R', 'A', 'C', 'D'].includes(entry.statusCode))
    .map((e) => e.path);

  const parts: string[] = [];
  if (modified.length > 0) {
    parts.push(`Update ${formatPathSummary(modified)}`);
  }
  if (added.length > 0) {
    parts.push(`Add ${formatPathSummary(added)}`);
  }
  if (deleted.length > 0) {
    parts.push(`Remove ${formatPathSummary(deleted)}`);
  }
  if (other.length > 0) {
    parts.push(`Change ${formatPathSummary(other)}`);
  }

  const body = parts.join('; ') || `Change ${formatPathSummary(candidates.map((entry) => entry.path))}`;
  const prefix = settings.commitMessage?.template?.trim();
  const message = prefix ? `${prefix}: ${body}` : body;

  return {
    message: message.slice(0, MAX_COMMIT_MESSAGE_LENGTH),
  };
};

const collectUntrackedPaths = (entries: Awaited<ReturnType<typeof getGitChanges>>['entries']): string[] => (
  [...new Set(
    entries
      .filter((entry) => !entry.denied && entry.section === 'untracked')
      .map((entry) => entry.path),
  )]
);

export const commitGitChanges = async (message: string): Promise<GitMutationResult> => {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Commit message is required.');
  }
  if (trimmed.length > MAX_COMMIT_MESSAGE_LENGTH) {
    throw new HttpError(400, `Commit message exceeds ${MAX_COMMIT_MESSAGE_LENGTH} characters.`);
  }

  await assertGitRepositoryOrThrow();
  const changes = await getGitChanges();
  const committableEntries = changes.entries.filter((entry) => !entry.denied);
  const hasStaged = committableEntries.some((entry) => entry.section === 'staged');
  const hasUnstagedTracked = committableEntries.some((entry) => entry.section === 'unstaged');
  const untrackedPaths = collectUntrackedPaths(changes.entries);

  if (!hasStaged && !hasUnstagedTracked && untrackedPaths.length === 0) {
    throw new HttpError(400, 'No changes to commit.');
  }

  if (hasUnstagedTracked) {
    assertGitCommandSuccess(await runGit(['add', '-u']), 'stage');
  }
  if (untrackedPaths.length > 0) {
    await stageGitPaths(untrackedPaths);
  }

  assertGitCommandSuccess(await runGit(['commit', '-m', trimmed]), 'commit');
  return { success: true, message: 'Committed changes.' };
};

export const fetchGitRemote = async (settings: GitSettings): Promise<GitMutationResult> => {
  assertGitEnabledOrThrow(settings);
  await assertGitRepositoryOrThrow();
  const runtime = await resolveRuntimeOrThrow(settings);
  assertGitCommandSuccess(
    await runGitWithRuntime(runtime, ['fetch', runtime.remoteName, '--prune']),
    'fetch',
  );
  return { success: true, message: 'Fetched from remote.' };
};

export const pullGitRemote = async (settings: GitSettings): Promise<GitMutationResult> => {
  assertGitEnabledOrThrow(settings);
  await assertGitRepositoryOrThrow();
  const runtime = await resolveRuntimeOrThrow(settings);
  const branch = await resolveActiveBranch();
  assertGitCommandSuccess(
    await runGitWithRuntime(runtime, ['pull', runtime.remoteName, branch, '--ff-only']),
    'pull',
  );
  return { success: true, message: `Pulled ${branch} from remote.` };
};

export const pushGitRemote = async (settings: GitSettings): Promise<GitMutationResult> => {
  assertGitEnabledOrThrow(settings);
  await assertGitRepositoryOrThrow();
  const runtime = await resolveRuntimeOrThrow(settings);
  const branch = await resolveActiveBranch();
  assertGitCommandSuccess(
    await runGitWithRuntime(runtime, ['push', runtime.remoteName, `HEAD:refs/heads/${branch}`]),
    'push',
  );
  return { success: true, message: `Pushed ${branch} to remote.` };
};

export const syncGitRemote = async (settings: GitSettings): Promise<GitMutationResult> => {
  await fetchGitRemote(settings);
  await pullGitRemote(settings);
  await pushGitRemote(settings);
  return { success: true, message: 'Sync complete: fetch, pull, and push succeeded.' };
};
