import type { NativeToolDefinition } from '../../ToolRegistry';
import { createDraftId, putAgentDraft } from '../agentDraftStore';
import {
  validateGitBranchName,
  validateGitPath,
  validateGitRef,
} from './gitRunner';

export const GIT_COMMIT_TOOL_NAME = 'git_commit';
export const GIT_CHECKOUT_TOOL_NAME = 'git_checkout';
export const GIT_BRANCH_TOOL_NAME = 'git_branch';

const MAX_COMMIT_MESSAGE_LENGTH = 500;

const validateStagePaths = (paths: unknown): { ok: true; paths: string[] } | { ok: false; error: string } => {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { ok: false, error: 'paths must be a non-empty array when provided.' };
  }

  const normalized: string[] = [];
  for (const entry of paths) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return { ok: false, error: 'Each path must be a non-empty string.' };
    }
    const pathResult = validateGitPath(entry);
    if (!pathResult.ok) {
      return { ok: false, error: pathResult.error };
    }
    normalized.push(pathResult.relativePath);
  }

  return { ok: true, paths: normalized };
};

const executeGitCommit = async (args: Record<string, unknown>) => {
  const message = typeof args.message === 'string' ? args.message.trim() : '';
  if (!message) {
    return { ok: false as const, summary: 'Commit message is required.', error: 'missing_message' };
  }
  if (message.length > MAX_COMMIT_MESSAGE_LENGTH) {
    return {
      ok: false as const,
      summary: `Commit message exceeds ${MAX_COMMIT_MESSAGE_LENGTH} characters.`,
      error: 'message_too_long',
    };
  }

  const stageAll = args.stageAll === true;
  let paths: string[] | undefined;
  if (args.paths !== undefined) {
    let rawPaths: unknown = args.paths;
    if (typeof rawPaths === 'string' && rawPaths.trim()) {
      try {
        rawPaths = JSON.parse(rawPaths) as unknown;
      } catch {
        return { ok: false as const, summary: 'paths must be a JSON array of strings.', error: 'invalid_paths' };
      }
    }
    const pathResult = validateStagePaths(rawPaths);
    if (!pathResult.ok) {
      return { ok: false as const, summary: pathResult.error, error: 'invalid_paths' };
    }
    paths = pathResult.paths;
  }

  const draftId = createDraftId();
  const draft = putAgentDraft({
    kind: 'git_commit',
    id: draftId,
    message,
    stageAll: stageAll || undefined,
    paths,
  });

  const stageSummary = paths?.length
    ? `stage ${paths.length} path(s)`
    : stageAll
      ? 'stage all changes'
      : 'commit staged changes only';

  return {
    ok: true as const,
    summary: `Drafted git commit (${stageSummary}).`,
    data: {
      draftId: draft.id,
      message: draft.message,
      stageAll: draft.stageAll ?? false,
      paths: draft.paths ?? [],
    },
    artifacts: [{ kind: 'draft' as const, id: draft.id, label: `commit: ${message.slice(0, 48)}` }],
  };
};

const executeGitCheckout = async (args: Record<string, unknown>) => {
  const targetInput = typeof args.target === 'string' ? args.target : '';
  const target = validateGitRef(targetInput);
  if (!target) {
    return { ok: false as const, summary: 'A valid branch or ref is required.', error: 'invalid_target' };
  }

  const draftId = createDraftId();
  const draft = putAgentDraft({
    kind: 'git_checkout',
    id: draftId,
    target,
  });

  return {
    ok: true as const,
    summary: `Drafted git checkout to ${target}.`,
    data: { draftId: draft.id, target: draft.target },
    artifacts: [{ kind: 'draft' as const, id: draft.id, label: `checkout: ${target}` }],
  };
};

const executeGitBranch = async (args: Record<string, unknown>) => {
  const branchInput = typeof args.branchName === 'string' ? args.branchName : '';
  const branchName = validateGitBranchName(branchInput);
  if (!branchName) {
    return { ok: false as const, summary: 'A valid branch name is required.', error: 'invalid_branch_name' };
  }

  let startPoint: string | undefined;
  if (typeof args.startPoint === 'string' && args.startPoint.trim()) {
    const validated = validateGitRef(args.startPoint);
    if (!validated) {
      return { ok: false as const, summary: 'Invalid start point ref.', error: 'invalid_start_point' };
    }
    startPoint = validated;
  }

  const checkout = args.checkout !== false;

  const draftId = createDraftId();
  const draft = putAgentDraft({
    kind: 'git_branch',
    id: draftId,
    branchName,
    startPoint,
    checkout,
  });

  return {
    ok: true as const,
    summary: `Drafted git branch ${branchName}${checkout ? ' with checkout' : ''}.`,
    data: {
      draftId: draft.id,
      branchName: draft.branchName,
      startPoint: draft.startPoint,
      checkout: draft.checkout ?? true,
    },
    artifacts: [{ kind: 'draft' as const, id: draft.id, label: `branch: ${branchName}` }],
  };
};

const gitCommitTool: NativeToolDefinition = {
  name: GIT_COMMIT_TOOL_NAME,
  description: 'Drafts a git commit (requires user confirm before apply). Optionally stage paths or all changes first. Use after reviewing git_diff/git_status — never commits without confirm gate.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message.' },
      stageAll: { type: 'boolean', description: 'Stage all tracked/untracked changes before commit.' },
      paths: {
        type: 'string',
        description: 'JSON array of relative paths to stage before commit (overrides stageAll).',
      },
    },
    required: ['message'],
  },
  execute: (args) => executeGitCommit(args),
};

const gitCheckoutTool: NativeToolDefinition = {
  name: GIT_CHECKOUT_TOOL_NAME,
  description: 'Drafts switching to an existing branch or ref (requires user confirm before apply). Use when the user explicitly requests a branch change.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Branch name or git ref to checkout.' },
    },
    required: ['target'],
  },
  execute: (args) => executeGitCheckout(args),
};

const gitBranchTool: NativeToolDefinition = {
  name: GIT_BRANCH_TOOL_NAME,
  description: 'Drafts creating a new branch, optionally checking it out (requires user confirm before apply). Use for feature branches — confirm gate applies before apply.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      branchName: { type: 'string', description: 'New branch name.' },
      startPoint: { type: 'string', description: 'Optional ref to branch from (defaults to HEAD).' },
      checkout: { type: 'boolean', description: 'Checkout the new branch after creation (default true).' },
    },
    required: ['branchName'],
  },
  execute: (args) => executeGitBranch(args),
};

export const GIT_WRITE_TOOLS = [
  gitCommitTool,
  gitCheckoutTool,
  gitBranchTool,
] as const;
