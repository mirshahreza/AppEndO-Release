import {
  expandAgentScopeRoots,
  getAllowlistedSearchRoots,
  getPlanModeSearchRoots,
  isPlanModeReadablePath,
  matchGlobPattern,
  normalizeRelativePath,
  resolveAllowlistedPath,
  resolvePlanModeReadPath,
  walkAllowlistedFiles,
} from '../pathAllowlist';
import type { ToolExecutionContext } from '../../agent/types';
import type { NativeToolDefinition } from '../ToolRegistry';
export const GLOB_FILES_TOOL_NAME = 'glob_files';

const DEFAULT_MAX_RESULTS = 50;

export const executeGlobFiles = async (args: Record<string, unknown>, context?: ToolExecutionContext) => {
  const pattern = typeof args.pattern === 'string' ? args.pattern.trim() : '';
  if (!pattern) {
    return { ok: false as const, summary: 'Glob pattern is required.', error: 'missing_pattern' };
  }

  const scopePath = typeof args.path === 'string' && args.path.trim()
    ? normalizeRelativePath(args.path)
    : undefined;

  if (scopePath) {
    const resolved = context?.mode === 'plan'
      ? resolvePlanModeReadPath(scopePath)
      : resolveAllowlistedPath(scopePath);
    if (resolved.ok === false) {
      return { ok: false as const, summary: resolved.error, error: 'path_not_allowed' };
    }
  }

  const maxResults = typeof args.maxResults === 'number' && args.maxResults > 0
    ? Math.min(Math.floor(args.maxResults), 200)
    : DEFAULT_MAX_RESULTS;

  const roots = scopePath
    ? (expandAgentScopeRoots(scopePath) ?? [scopePath])
    : (context?.mode === 'plan' ? getPlanModeSearchRoots() : getAllowlistedSearchRoots());
  const matches: string[] = [];

  for (const root of roots) {
    if (context?.mode === 'plan' && !isPlanModeReadablePath(root)) continue;    for (const filePath of walkAllowlistedFiles(root)) {
      if (!matchGlobPattern(pattern, filePath)) continue;
      matches.push(filePath);
      if (matches.length >= maxResults) break;
    }
    if (matches.length >= maxResults) break;
  }

  matches.sort();

  return {
    ok: true as const,
    summary: matches.length > 0
      ? `Found ${matches.length} allowlisted file(s) matching "${pattern}".`
      : `No allowlisted files matched "${pattern}".`,
    data: {
      pattern,
      scopePath: scopePath ?? null,
      matchCount: matches.length,
      paths: matches,
      verifyHint: 'Use search_codebase then read_file to inspect matches.',
    },
  };
};

export const globFilesTool: NativeToolDefinition = {
  name: GLOB_FILES_TOOL_NAME,
  description: 'Lists allowlisted file paths matching a glob pattern. Use to discover files by name when you do not know exact paths. Returns matchCount and paths array. Example: glob_files({ pattern: "**/AppTableGrid.tsx", path: "src" }).',
  group: 'search',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern, e.g. **/AppTableGrid.tsx' },
      path: { type: 'string', description: 'Optional allowlisted directory scope.' },
      maxResults: { type: 'number', description: 'Maximum paths to return (default 50, max 200).' },
    },
    required: ['pattern'],
  },
  execute: (args, context) => executeGlobFiles(args, context),
};