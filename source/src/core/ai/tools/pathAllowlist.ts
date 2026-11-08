import fs from 'fs';
import path from 'path';

/** Shared allowlist roots for agent read/search tools. */
export const AGENT_RUNTIME_READ_ROOTS = [
  'workspace/server-functions/',
  'workspace/designer/',
  'workspace/platform-registry/',
] as const;

export const AGENT_ALLOWLIST_ROOTS = [
  'src/features/',
  'src/shared/',
  'src/core/',
  'src/config/',
  'src/server/',
  'src/domain/',
  'src/components/',
  ...AGENT_RUNTIME_READ_ROOTS,
  'docs/',
  'plans/core/todo/',
  'plans/core/next/',
  'plans/packages/',
  'AGENTS.md',
] as const;

export const AGENT_DENY_PATTERNS = [
  /^\.env/i,
  /(^|\/)settings\.json$/i,
  /credentials/i,
  /node_modules/i,
] as const;

/** Excluded from agent search/glob by default — use read_file on explicit test paths when needed. */
export const AGENT_SEARCH_EXCLUDE_GLOBS = [
  '**/__tests__/**',
  '**/*.test.ts',
  '**/*.test.tsx',
] as const;

export const isAgentSearchExcludedPath = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  return AGENT_SEARCH_EXCLUDE_GLOBS.some((pattern) => matchGlobPattern(pattern, normalized));
};

const TEXT_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.sql', '.yml', '.yaml', '.txt',
]);

export const getRepoRoot = (): string => process.cwd();

export const normalizeRelativePath = (input: string): string => (
  input.replace(/\\/g, '/').replace(/^\.\/+/, '').trim()
);

export const isDeniedPath = (relativePath: string): boolean => (
  AGENT_DENY_PATTERNS.some((pattern) => pattern.test(relativePath))
);

export const isAllowlistedPath = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || isDeniedPath(normalized)) return false;
  if (normalized === 'AGENTS.md') return true;
  if (normalized === 'runtime' || normalized === 'workspace') return true;

  return AGENT_ALLOWLIST_ROOTS.some((root) => {
    if (root === 'AGENTS.md') return false;
    const rootDir = root.endsWith('/') ? root.slice(0, -1) : root;
    return normalized === rootDir || normalized.startsWith(root);
  });
};

export const PLAN_MODE_DOCUMENT_ROOTS = [
  'plans/core/todo/',
  'plans/core/next/',
  'plans/packages/',
] as const;

const isUnderPlanModeRoot = (normalized: string): boolean => (
  PLAN_MODE_DOCUMENT_ROOTS.some((root) => normalized.startsWith(root))
);

/** Plan mode read scope — markdown design documents under plans/core/ or plans/packages/. */
export const isPlanModeDocumentPath = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  return isUnderPlanModeRoot(normalized) && normalized.endsWith('.md');
};

/** Plan mode read/search scope — any path under plans/core/ or plans/packages/. */
export const isPlanModeReadablePath = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  return PLAN_MODE_DOCUMENT_ROOTS.some((root) => {
    const rootDir = root.slice(0, -1);
    return normalized === rootDir || normalized.startsWith(root);
  });
};

export const getPlanModeSearchRoots = (): string[] => [
  'plans/core/todo',
  'plans/core/next',
  'plans/packages',
];

export const resolvePlanModeReadPath = (input: string): PathResolution => {
  const resolved = resolveAllowlistedPath(input);
  if (resolved.ok === false) {
    return resolved;
  }

  if (!isPlanModeReadablePath(resolved.relativePath)) {
    return {
      ok: false,
      error: `Plan mode read scope is limited to plans/core/ and plans/packages/ (got "${resolved.relativePath}").`,
    };
  }

  return resolved;
};

export type PathResolution =
  | { ok: true; relativePath: string; absolutePath: string }
  | { ok: false; error: string };

export const resolveAllowlistedPath = (input: string): PathResolution => {
  const relativePath = normalizeRelativePath(input);
  if (!relativePath) {
    return { ok: false, error: 'Path is required.' };
  }

  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath)) {
    return { ok: false, error: 'Absolute paths are not allowed.' };
  }

  if (relativePath.split('/').some((segment) => segment === '..')) {
    return { ok: false, error: 'Parent directory segments are not allowed.' };
  }

  if (!isAllowlistedPath(relativePath)) {
    return { ok: false, error: `Path "${relativePath}" is outside the agent allowlist.` };
  }

  const repoRoot = path.resolve(getRepoRoot());
  const absolutePath = path.resolve(repoRoot, relativePath);
  const resolvedRelative = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

  if (!resolvedRelative || resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) {
    return { ok: false, error: 'Path escapes repository root.' };
  }

  if (isDeniedPath(resolvedRelative)) {
    return { ok: false, error: `Path "${resolvedRelative}" is denied.` };
  }

  return { ok: true, relativePath: resolvedRelative, absolutePath };
};

export const getAllowlistedSearchRoots = (): string[] => (
  AGENT_ALLOWLIST_ROOTS
    .filter((root) => root !== 'AGENTS.md')
    .map((root) => (root.endsWith('/') ? root.slice(0, -1) : root))
);

/** Expand `workspace` (or legacy `runtime`) scope to concrete module read roots for glob/search tools. */
export const expandAgentScopeRoots = (scopePath: string): string[] | null => {
  const normalized = normalizeRelativePath(scopePath);
  if (normalized !== 'workspace' && normalized !== 'runtime') {
    return null;
  }

  return AGENT_RUNTIME_READ_ROOTS.map((root) => (root.endsWith('/') ? root.slice(0, -1) : root));
};

export const isLikelyTextFile = (relativePath: string): boolean => {
  const extension = path.extname(relativePath).toLowerCase();
  if (relativePath === 'AGENTS.md' || relativePath.endsWith('.md')) return true;
  return TEXT_FILE_EXTENSIONS.has(extension);
};

export const walkAllowlistedFiles = function* walkAllowlistedFiles(
  relativeDir: string,
): Generator<string> {
  const resolved = resolveAllowlistedPath(relativeDir);
  if (!resolved.ok) return;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved.absolutePath);
  } catch {
    return;
  }

  if (stat.isFile()) {
    if (isLikelyTextFile(resolved.relativePath)) {
      yield resolved.relativePath;
    }
    return;
  }

  if (!stat.isDirectory()) return;

  const entries = fs.readdirSync(resolved.absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    const childRelative = resolved.relativePath
      ? `${resolved.relativePath}/${entry.name}`
      : entry.name;

    if (isDeniedPath(childRelative)) continue;
    if (!isAllowlistedPath(childRelative) && !isAllowlistedPath(`${childRelative}/`)) continue;

    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      yield* walkAllowlistedFiles(childRelative);
      continue;
    }

    if (entry.isFile() && isLikelyTextFile(childRelative) && !isAgentSearchExcludedPath(childRelative)) {
      yield childRelative;
    }
  }
};

export const matchGlobPattern = (pattern: string, filePath: string): boolean => {
  const normalizedPattern = normalizeRelativePath(pattern);
  const normalizedPath = normalizeRelativePath(filePath);
  const regexSource = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '[^/]');

  return new RegExp(`^${regexSource}$`).test(normalizedPath);
};
