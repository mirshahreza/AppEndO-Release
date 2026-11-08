import type { NativeToolDefinition } from '../../ToolRegistry';
import {
  formatGitToolResult,
  runGit,
  validateGitPath,
  validateGitRef,
} from './gitRunner';

export const GIT_STATUS_TOOL_NAME = 'git_status';
export const GIT_DIFF_TOOL_NAME = 'git_diff';
export const GIT_LOG_TOOL_NAME = 'git_log';
export const GIT_SHOW_TOOL_NAME = 'git_show';
export const GIT_BLAME_TOOL_NAME = 'git_blame';

const DEFAULT_LOG_COUNT = 20;
const MAX_LOG_COUNT = 100;
const DEFAULT_CONTEXT_LINES = 3;
const MAX_CONTEXT_LINES = 20;

export const executeGitStatus = async (args: Record<string, unknown>) => {
  const gitArgs = ['status', '--porcelain=v2', '-b'];
  if (typeof args.path === 'string' && args.path.trim()) {
    const pathResult = validateGitPath(args.path);
    if (!pathResult.ok) {
      return { ok: false as const, summary: pathResult.error, error: 'path_not_allowed' };
    }
    gitArgs.push('--', pathResult.relativePath);
  }

  const result = await runGit(gitArgs);
  const formatted = formatGitToolResult(result, 'Git status retrieved.');
  return formatted.ok
    ? { ok: true as const, summary: formatted.summary, data: formatted.data }
    : { ok: false as const, summary: formatted.summary, error: formatted.error };
};

export const executeGitDiff = async (args: Record<string, unknown>) => {
  const gitArgs = ['diff'];
  if (args.staged === true) {
    gitArgs.push('--staged');
  }

  const contextLines = typeof args.contextLines === 'number' && args.contextLines > 0
    ? Math.min(Math.floor(args.contextLines), MAX_CONTEXT_LINES)
    : DEFAULT_CONTEXT_LINES;
  gitArgs.push(`-U${contextLines}`);

  if (typeof args.path === 'string' && args.path.trim()) {
    const pathResult = validateGitPath(args.path);
    if (!pathResult.ok) {
      return { ok: false as const, summary: pathResult.error, error: 'path_not_allowed' };
    }
    gitArgs.push('--', pathResult.relativePath);
  }

  const result = await runGit(gitArgs);
  const formatted = formatGitToolResult(result, 'Git diff retrieved.');
  return formatted.ok
    ? { ok: true as const, summary: formatted.summary, data: formatted.data }
    : { ok: false as const, summary: formatted.summary, error: formatted.error };
};

const executeGitLog = async (args: Record<string, unknown>) => {
  const maxCount = typeof args.maxCount === 'number' && args.maxCount > 0
    ? Math.min(Math.floor(args.maxCount), MAX_LOG_COUNT)
    : DEFAULT_LOG_COUNT;

  const gitArgs = ['log', '--oneline', '--decorate', `-n`, String(maxCount)];

  if (typeof args.since === 'string' && args.since.trim()) {
    const since = args.since.trim();
    if (since.length > 64 || /[;&|`$]/.test(since)) {
      return { ok: false as const, summary: 'Invalid since value.', error: 'invalid_since' };
    }
    gitArgs.push(`--since=${since}`);
  }

  if (typeof args.path === 'string' && args.path.trim()) {
    const pathResult = validateGitPath(args.path);
    if (!pathResult.ok) {
      return { ok: false as const, summary: pathResult.error, error: 'path_not_allowed' };
    }
    gitArgs.push('--', pathResult.relativePath);
  }

  const result = await runGit(gitArgs);
  const formatted = formatGitToolResult(result, `Git log (${maxCount} max).`);
  return formatted.ok
    ? { ok: true as const, summary: formatted.summary, data: formatted.data }
    : { ok: false as const, summary: formatted.summary, error: formatted.error };
};

const executeGitShow = async (args: Record<string, unknown>) => {
  const refInput = typeof args.ref === 'string' ? args.ref : '';
  const ref = validateGitRef(refInput);
  if (!ref) {
    return { ok: false as const, summary: 'A valid git ref is required.', error: 'missing_ref' };
  }

  const gitArgs = ['show', '--stat', '--format=fuller', ref];
  if (args.includePatch === true) {
    gitArgs.splice(1, 0, '--patch');
  }

  if (typeof args.path === 'string' && args.path.trim()) {
    const pathResult = validateGitPath(args.path);
    if (!pathResult.ok) {
      return { ok: false as const, summary: pathResult.error, error: 'path_not_allowed' };
    }
    gitArgs.push('--', pathResult.relativePath);
  }

  const result = await runGit(gitArgs);
  const formatted = formatGitToolResult(result, `Git show ${ref}.`);
  return formatted.ok
    ? { ok: true as const, summary: formatted.summary, data: formatted.data }
    : { ok: false as const, summary: formatted.summary, error: formatted.error };
};

const executeGitBlame = async (args: Record<string, unknown>) => {
  const pathInput = typeof args.path === 'string' ? args.path : '';
  if (!pathInput.trim()) {
    return { ok: false as const, summary: 'File path is required.', error: 'missing_path' };
  }

  const pathResult = validateGitPath(pathInput);
  if (!pathResult.ok) {
    return { ok: false as const, summary: pathResult.error, error: 'path_not_allowed' };
  }

  const gitArgs = ['blame', '--line-porcelain'];
  const startLine = typeof args.startLine === 'number' && args.startLine > 0
    ? Math.floor(args.startLine)
    : undefined;
  const endLine = typeof args.endLine === 'number' && args.endLine > 0
    ? Math.floor(args.endLine)
    : undefined;

  if (startLine !== undefined && endLine !== undefined && endLine >= startLine) {
    gitArgs.push(`-L${startLine},${endLine}`);
  } else if (startLine !== undefined) {
    gitArgs.push(`-L${startLine},`);
  }

  gitArgs.push('--', pathResult.relativePath);

  const result = await runGit(gitArgs);
  const formatted = formatGitToolResult(result, `Git blame for ${pathResult.relativePath}.`);
  return formatted.ok
    ? { ok: true as const, summary: formatted.summary, data: formatted.data }
    : { ok: false as const, summary: formatted.summary, error: formatted.error };
};

const gitStatusTool: NativeToolDefinition = {
  name: GIT_STATUS_TOOL_NAME,
  description: 'Shows git working tree status (porcelain v2 with branch and ahead/behind). Use before proposing commits or when the user asks what changed. Optional path scopes to a subdirectory.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Optional path scope (relative to repo root).' },
    },
  },
  execute: (args) => executeGitStatus(args),
};

const gitDiffTool: NativeToolDefinition = {
  name: GIT_DIFF_TOOL_NAME,
  description: 'Shows unstaged or staged diff for the repo or a scoped path. Use to inspect changes before git_commit drafts. Set staged=true for index-only diff.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      staged: { type: 'boolean', description: 'When true, diff staged changes (--staged).' },
      path: { type: 'string', description: 'Optional path scope (relative to repo root).' },
      contextLines: { type: 'number', description: 'Unified context lines (default 3, max 20).' },
    },
  },
  execute: (args) => executeGitDiff(args),
};

const gitLogTool: NativeToolDefinition = {
  name: GIT_LOG_TOOL_NAME,
  description: 'Shows recent commit history (oneline, decorated). Use when the user asks what was committed recently or to find a ref for blame/show.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      maxCount: { type: 'number', description: 'Max commits (default 20, max 100).' },
      since: { type: 'string', description: 'Optional --since filter (e.g. "2.weeks").' },
      path: { type: 'string', description: 'Optional path scope (relative to repo root).' },
    },
  },
  execute: (args) => executeGitLog(args),
};

const gitShowTool: NativeToolDefinition = {
  name: GIT_SHOW_TOOL_NAME,
  description: 'Shows a commit or object (stat + metadata; optional patch). Use to inspect a specific ref without checking it out.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      ref: { type: 'string', description: 'Commit ref (hash, branch, tag, HEAD, etc.).' },
      path: { type: 'string', description: 'Optional path scope within the ref.' },
      includePatch: { type: 'boolean', description: 'Include full patch output (default false).' },
    },
    required: ['ref'],
  },
  execute: (args) => executeGitShow(args),
};

const gitBlameTool: NativeToolDefinition = {
  name: GIT_BLAME_TOOL_NAME,
  description: 'Shows line-by-line blame for an allowlisted file. Use after read_file to see who last touched specific lines.',
  group: 'git',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path in the repository.' },
      startLine: { type: 'number', description: 'Optional 1-based start line.' },
      endLine: { type: 'number', description: 'Optional 1-based end line.' },
    },
    required: ['path'],
  },
  execute: (args) => executeGitBlame(args),
};

export const GIT_READ_TOOLS = [
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitShowTool,
  gitBlameTool,
] as const;
