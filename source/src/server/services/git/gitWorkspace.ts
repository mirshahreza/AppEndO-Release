import { executeGitDiff, executeGitStatus } from '../../../core/ai/tools/native/git/gitTools';
import {
  assertGitRepository,
  getGitCurrentBranch,
  gitBranchExists,
  runGit,
  truncateGitOutput,
  validateGitBranchName,
  validateGitPath,
} from '../../../core/ai/tools/native/git/gitRunner';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../errors/HttpError';
import type {
  GitBranchesPayload,
  GitChangeSection,
  GitChangesPayload,
  GitDiffPayload,
  GitDiscardRequest,
  GitMutationResult,
} from '../../../shared/api/contracts/git/types';
import { parseGitPorcelainV2 } from './gitPorcelainParser';

const DEFAULT_DIFF_CONTEXT_LINES = 3;

const readGitBlob = async (spec: string): Promise<string> => {
  const result = await runGit(['show', spec]);
  if (!result.ok) {
    return '';
  }
  return result.stdout;
};

const readWorkingTreeFile = (relativePath: string): string => {
  const repoCheck = assertGitRepository();
  if (!repoCheck.ok) {
    return '';
  }

  const absolutePath = path.join(repoCheck.repoRoot, relativePath);
  try {
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return '';
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    return truncateGitOutput(content).text;
  } catch {
    return '';
  }
};

const readGitDiffSides = async (
  relativePath: string,
  section: GitChangeSection,
): Promise<{ baseline: string; current: string }> => {
  const gitPath = relativePath.replace(/\\/g, '/');

  if (section === 'untracked') {
    return {
      baseline: '',
      current: readWorkingTreeFile(gitPath),
    };
  }

  if (section === 'staged') {
    return {
      baseline: await readGitBlob(`HEAD:${gitPath}`),
      current: await readGitBlob(`:${gitPath}`),
    };
  }

  return {
    baseline: await readGitBlob(`HEAD:${gitPath}`),
    current: readWorkingTreeFile(gitPath),
  };
};

const assertGitRepositoryOrThrow = async (): Promise<void> => {
  const statusResult = await executeGitStatus({});
  if (!statusResult.ok && statusResult.error === 'not_a_git_repo') {
    throw new HttpError(400, statusResult.summary);
  }
};

const validatePathsOrThrow = (paths: unknown): string[] => {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new HttpError(400, 'paths must be a non-empty array.');
  }

  const normalized: string[] = [];
  for (const entry of paths) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new HttpError(400, 'Each path must be a non-empty string.');
    }
    const pathResult = validateGitPath(entry);
    if (!pathResult.ok) {
      throw new HttpError(400, pathResult.error);
    }
    normalized.push(pathResult.relativePath);
  }

  return normalized;
};

const assertGitCommandSuccess = (result: Awaited<ReturnType<typeof runGit>>, action: string): void => {
  if (!result.ok) {
    throw new HttpError(400, result.summary || `Git ${action} failed.`);
  }
};

export const getGitChanges = async (): Promise<GitChangesPayload> => {
  const statusResult = await executeGitStatus({});
  if (!statusResult.ok) {
    throw new HttpError(400, statusResult.summary);
  }

  const output = typeof statusResult.data?.output === 'string' ? statusResult.data.output : '';
  return parseGitPorcelainV2(output);
};

const parseGitDiffSection = (
  section: unknown,
  staged: boolean,
): GitChangeSection => {
  if (section === 'staged' || section === 'unstaged' || section === 'untracked') {
    return section;
  }
  return staged ? 'staged' : 'unstaged';
};

export const getGitDiff = async (
  path: string,
  staged: boolean,
  sectionInput?: GitChangeSection,
): Promise<GitDiffPayload> => {
  const pathResult = validateGitPath(path);
  if (!pathResult.ok) {
    throw new HttpError(400, pathResult.error);
  }

  const section = sectionInput ?? parseGitDiffSection(undefined, staged);
  const diffStaged = section === 'staged';

  const diffResult = await executeGitDiff({
    path: pathResult.relativePath,
    staged: diffStaged,
    contextLines: DEFAULT_DIFF_CONTEXT_LINES,
  });

  if (!diffResult.ok) {
    throw new HttpError(400, diffResult.summary);
  }

  const diff = typeof diffResult.data?.output === 'string' ? diffResult.data.output : '';
  const truncated = diffResult.data?.truncated === true;
  const sides = await readGitDiffSides(pathResult.relativePath, section);
  const baselineTruncated = truncateGitOutput(sides.baseline);
  const currentTruncated = truncateGitOutput(sides.current);

  return {
    path: pathResult.relativePath,
    staged: diffStaged,
    section,
    diff,
    truncated: truncated || baselineTruncated.truncated || currentTruncated.truncated,
    baseline: baselineTruncated.text,
    current: currentTruncated.text,
  };
};

export const stageGitPaths = async (paths: string[]): Promise<GitMutationResult> => {
  await assertGitRepositoryOrThrow();
  const normalized = validatePathsOrThrow(paths);
  assertGitCommandSuccess(await runGit(['add', '--', ...normalized]), 'stage');
  return { success: true, message: `Staged ${normalized.length} path(s).` };
};

export const unstageGitPaths = async (paths: string[]): Promise<GitMutationResult> => {
  await assertGitRepositoryOrThrow();
  const normalized = validatePathsOrThrow(paths);
  assertGitCommandSuccess(await runGit(['restore', '--staged', '--', ...normalized]), 'unstage');
  return { success: true, message: `Unstaged ${normalized.length} path(s).` };
};

export const discardGitChanges = async (request: GitDiscardRequest): Promise<GitMutationResult> => {
  await assertGitRepositoryOrThrow();

  if (request.all === true) {
    assertGitCommandSuccess(await runGit(['restore', '.']), 'discard all');
    return { success: true, message: 'Discarded all unstaged changes.' };
  }

  const normalized = request.paths ? validatePathsOrThrow(request.paths) : [];

  if (request.untracked === true) {
    if (normalized.length === 0) {
      throw new HttpError(400, 'paths must be provided when discarding untracked files.');
    }
    assertGitCommandSuccess(await runGit(['clean', '-fd', '--', ...normalized]), 'clean');
    return { success: true, message: `Removed ${normalized.length} untracked path(s).` };
  }

  if (normalized.length === 0) {
    throw new HttpError(400, 'paths must be a non-empty array.');
  }

  assertGitCommandSuccess(await runGit(['restore', '--staged', '--', ...normalized]), 'unstage');
  assertGitCommandSuccess(await runGit(['restore', '--', ...normalized]), 'discard');
  return { success: true, message: `Discarded changes for ${normalized.length} path(s).` };
};

export const listGitBranches = async (): Promise<GitBranchesPayload> => {
  await assertGitRepositoryOrThrow();

  const current = await getGitCurrentBranch();
  const currentBranch = current === 'HEAD' ? null : current;

  const listResult = await runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
  if (!listResult.ok) {
    throw new HttpError(400, listResult.summary || 'Failed to list git branches.');
  }

  const branches = listResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      current: name === currentBranch,
    }))
    .sort((left, right) => {
      if (left.current) return -1;
      if (right.current) return 1;
      return left.name.localeCompare(right.name);
    });

  return {
    current: currentBranch,
    branches,
  };
};

export const checkoutGitBranch = async (branch: string): Promise<GitMutationResult> => {
  await assertGitRepositoryOrThrow();

  const validated = validateGitBranchName(branch);
  if (!validated) {
    throw new HttpError(400, 'Invalid branch name.');
  }

  const current = await getGitCurrentBranch();
  if (current === validated) {
    return { success: true, message: `Already on ${validated}.` };
  }

  if (!(await gitBranchExists(validated))) {
    throw new HttpError(400, `Branch "${validated}" does not exist locally.`);
  }

  assertGitCommandSuccess(await runGit(['checkout', validated]), 'checkout');
  return { success: true, message: `Switched to branch ${validated}.` };
};
