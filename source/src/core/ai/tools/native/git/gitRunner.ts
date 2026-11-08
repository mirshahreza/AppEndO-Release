import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getRepoRoot, isDeniedPath, normalizeRelativePath } from '../../pathAllowlist';
import { resolveJailedSubprocessEnv } from '../../subprocessEnvJail';

const execFileAsync = promisify(execFile);

export const GIT_COMMAND_TIMEOUT_MS = 30_000;
export const GIT_MAX_OUTPUT_BYTES = 512_000;

const GIT_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._~^/@-]{0,255}$/;
const GIT_BRANCH_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/;

const PROTECTED_BRANCH_NAMES = new Set(['main', 'master']);

export const validateGitRef = (ref: string): string | null => {
  const trimmed = ref.trim();
  if (!trimmed || !GIT_REF_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const validateGitBranchName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed || !GIT_BRANCH_NAME_PATTERN.test(trimmed)) {
    return null;
  }
  if (trimmed.includes('..') || trimmed.endsWith('.') || trimmed.endsWith('/')) {
    return null;
  }
  return trimmed;
};

const isProtectedGitBranch = (branchName: string): boolean =>
  PROTECTED_BRANCH_NAMES.has(branchName.trim().toLowerCase());

export const getGitHeadHash = async (): Promise<string | null> => {
  const result = await runGit(['rev-parse', 'HEAD']);
  if (!result.ok) return null;
  return result.stdout.trim() || null;
};

export const getGitCurrentBranch = async (): Promise<string> => {
  const result = await runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!result.ok) return 'HEAD';
  const branch = result.stdout.trim();
  return branch || 'HEAD';
};

export const gitBranchExists = async (branchName: string): Promise<boolean> => {
  const result = await runGit(['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
  return result.ok;
};

export const validateGitPath = (
  inputPath: string,
): { ok: true; relativePath: string } | { ok: false; error: string } => {
  const relativePath = normalizeRelativePath(inputPath);
  if (!relativePath || relativePath.includes('..')) {
    return { ok: false, error: 'Invalid path.' };
  }
  if (isDeniedPath(relativePath)) {
    return { ok: false, error: `Path not allowed: ${relativePath}` };
  }
  return { ok: true, relativePath };
};

export const truncateGitOutput = (output: string): { text: string; truncated: boolean } => {
  if (Buffer.byteLength(output, 'utf8') <= GIT_MAX_OUTPUT_BYTES) {
    return { text: output, truncated: false };
  }

  let truncated = output;
  while (truncated.length > 0 && Buffer.byteLength(truncated, 'utf8') > GIT_MAX_OUTPUT_BYTES) {
    truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
  }

  return { text: `${truncated}\n… [output truncated]`, truncated: true };
};

export const assertGitRepository = (): { ok: true; repoRoot: string } | { ok: false; error: string } => {
  const repoRoot = getRepoRoot();
  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    return { ok: false, error: 'Workspace is not a git repository.' };
  }
  return { ok: true, repoRoot };
};

export type RunGitSuccess = {
  ok: true;
  stdout: string;
  stderr: string;
  truncated: boolean;
};

export type RunGitFailure = {
  ok: false;
  error: string;
  summary: string;
};

export const runGit = async (args: readonly string[]): Promise<RunGitSuccess | RunGitFailure> => {
  const repoCheck = assertGitRepository();
  if (!repoCheck.ok) {
    return { ok: false, error: 'not_a_git_repo', summary: repoCheck.error };
  }

  try {
    const { stdout, stderr } = await execFileAsync('git', [...args], {
      cwd: repoCheck.repoRoot,
      timeout: GIT_COMMAND_TIMEOUT_MS,
      maxBuffer: GIT_MAX_OUTPUT_BYTES + 64_000,
      encoding: 'utf8',
      // V5 P09 § V5-14 / D-008 Option C — restricted env, not the full server process env.
      env: resolveJailedSubprocessEnv(),
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
      if (out.text.trim() || err.text.trim()) {
        return {
          ok: true,
          stdout: out.text,
          stderr: err.text,
          truncated: out.truncated || err.truncated,
        };
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: 'git_failed', summary: `Git command failed: ${message}` };
  }
};

export const formatGitToolResult = (
  result: RunGitSuccess | RunGitFailure,
  summaryPrefix: string,
): { ok: boolean; summary: string; error?: string; data?: Record<string, unknown> } => {
  if (!result.ok) {
    return { ok: false, summary: result.summary, error: result.error };
  }

  const output = [result.stdout, result.stderr].filter((chunk) => chunk.trim().length > 0).join('\n');
  const truncatedNote = result.truncated ? ' Output truncated.' : '';

  return {
    ok: true,
    summary: `${summaryPrefix}${truncatedNote}`,
    data: {
      output,
      truncated: result.truncated,
    },
  };
};
