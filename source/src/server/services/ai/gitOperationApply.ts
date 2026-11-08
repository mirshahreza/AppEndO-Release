import type { GitOperationChangeSet } from '../../../shared/api/contracts/ai/agentTypes';
import {
  formatGitToolResult,
  getGitCurrentBranch,
  getGitHeadHash,
  gitBranchExists,
  runGit,
  validateGitBranchName,
  validateGitPath,
  validateGitRef,
} from '../../../core/ai/tools/native/git/gitRunner';

export type GitOperationBeforeSnapshot = {
  branch: string;
  headHash: string | null;
  branchExisted?: boolean;
  createdBranch?: string;
};

const failApply = (summary: string): never => {
  throw new Error(summary);
};

const assertGitSuccess = (result: Awaited<ReturnType<typeof runGit>>, action: string): void => {
  if (!result.ok) {
    failApply(result.summary || `Git ${action} failed.`);
  }
};

export const applyGitOperationChangeSet = async (
  changeSet: GitOperationChangeSet,
): Promise<{ target: string; before: GitOperationBeforeSnapshot }> => {
  const branch = await getGitCurrentBranch();
  const headHash = await getGitHeadHash();

  switch (changeSet.operation) {
    case 'commit':
      return applyGitCommit(changeSet, { branch, headHash });
    case 'checkout':
      return applyGitCheckout(changeSet, { branch, headHash });
    case 'branch':
      return applyGitBranch(changeSet, { branch, headHash });
    default:
      failApply(`Unsupported git operation "${String(changeSet.operation)}".`);
  }
};

const applyGitCommit = async (
  changeSet: GitOperationChangeSet,
  before: GitOperationBeforeSnapshot,
): Promise<{ target: string; before: GitOperationBeforeSnapshot }> => {
  const message = changeSet.message?.trim();
  if (!message) {
    failApply('Git commit requires a message.');
  }

  if (changeSet.paths?.length) {
    const stagedPaths: string[] = [];
    changeSet.paths.forEach((entry) => {
      const pathResult = validateGitPath(entry);
      if (!pathResult.ok) {
        failApply(pathResult.error);
      }
      stagedPaths.push(pathResult.relativePath);
    });
    assertGitSuccess(await runGit(['add', '--', ...stagedPaths]), 'add');
  } else if (changeSet.stageAll) {
    assertGitSuccess(await runGit(['add', '-A']), 'add');
  }

  const commitResult = await runGit(['commit', '-m', message]);
  const formatted = formatGitToolResult(commitResult, 'Git commit applied.');
  if (!formatted.ok) {
    failApply(formatted.summary);
  }

  return {
    target: `commit:${message.slice(0, 48)}`,
    before,
  };
};

const applyGitCheckout = async (
  changeSet: GitOperationChangeSet,
  before: GitOperationBeforeSnapshot,
): Promise<{ target: string; before: GitOperationBeforeSnapshot }> => {
  const target = validateGitRef(changeSet.target ?? '');
  if (!target) {
    failApply('Git checkout requires a valid target ref.');
  }

  assertGitSuccess(await runGit(['checkout', target]), 'checkout');

  return {
    target: `checkout:${target}`,
    before,
  };
};

const applyGitBranch = async (
  changeSet: GitOperationChangeSet,
  before: GitOperationBeforeSnapshot,
): Promise<{ target: string; before: GitOperationBeforeSnapshot }> => {
  const branchName = validateGitBranchName(changeSet.branchName ?? '');
  if (!branchName) {
    failApply('Git branch requires a valid branch name.');
  }

  const branchExisted = await gitBranchExists(branchName);
  const branchArgs = ['branch', branchName];
  if (changeSet.startPoint) {
    const startPoint = validateGitRef(changeSet.startPoint);
    if (!startPoint) {
      failApply('Invalid git branch start point.');
    }
    branchArgs.push(startPoint);
  }

  if (!branchExisted) {
    assertGitSuccess(await runGit(branchArgs), 'branch');
  }

  if (changeSet.checkout !== false) {
    assertGitSuccess(await runGit(['checkout', branchName]), 'checkout');
  }

  return {
    target: `branch:${branchName}`,
    before: {
      ...before,
      branchExisted,
      createdBranch: branchExisted ? undefined : branchName,
    },
  };
};

export const rollbackGitOperationSnapshot = async (
  before: GitOperationBeforeSnapshot,
  target: string,
): Promise<void> => {
  if (target.startsWith('commit:') && before.headHash) {
    await runGit(['reset', '--mixed', before.headHash]);
    if (before.branch && before.branch !== 'HEAD') {
      await runGit(['checkout', before.branch]);
    }
    return;
  }

  if (target.startsWith('checkout:') && before.branch) {
    await runGit(['checkout', before.branch]);
    return;
  }

  if (target.startsWith('branch:')) {
    if (before.branch) {
      await runGit(['checkout', before.branch]);
    }
    if (before.createdBranch && before.branchExisted === false) {
      await runGit(['branch', '-d', before.createdBranch]);
    }
  }
};
