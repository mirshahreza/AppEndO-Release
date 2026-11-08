import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import {
  AGENT_SEARCH_EXCLUDE_GLOBS,
  expandAgentScopeRoots,
  getAllowlistedSearchRoots,
  getPlanModeSearchRoots,
  getRepoRoot,
  isAgentSearchExcludedPath,
  isAllowlistedPath,
  isPlanModeReadablePath,
  normalizeRelativePath,
  resolveAllowlistedPath,
  resolvePlanModeReadPath,
  walkAllowlistedFiles,
} from '../pathAllowlist';
import {
  buildFeatureGraphSearchContext,
  findFeatureGraphNode,
  loadFeatureGraph,
  resolveFeatureSearchRoots,
  resolvePageKeyFromFilePath,
} from '../../../../shared/lib/featureGraphStore';
import { resolvePageKeyFromPathname } from '../../../../shared/lib/resolvePageKeyFromPath';
import { searchCodeChunks } from './codeChunkIndex';
import { searchWorkspaceEmbeddings, type WorkspaceVectorHit } from './workspaceEmbeddingsIndex';
import {
  extractPromptEngineeringTargets,
  hasPromptEngineeringTargets,
} from '../../../../shared/lib/appendoo/promptEngineeringTargets';
import type { ToolExecutionContext } from '../../agent/types';
import type { NativeToolDefinition } from '../ToolRegistry';
import {
  deriveRefineScopePaths,
  isComplexSearchQuery,
  mergeSearchMatchLists,
  refineSearchQueryFromMatches,
} from './searchCodebaseSubLoop';
const execFileAsync = promisify(execFile);

export const SEARCH_CODEBASE_TOOL_NAME = 'search_codebase';

export type SearchMatch = {
  path: string;
  line: number;
  column: number;
  /** Line text — only present when `includeText: true` (omitted by default to save tokens). */
  text?: string;
  /** Feature graph pageKey when the match path maps to a graph node (VC-3.3). */
  pageKey?: string;
  /** Studio label for `pageKey` when known. */
  label?: string;
};

const DEFAULT_MAX_RESULTS = 30;

type SearchMode = 'exact' | 'semantic' | 'hybrid';

const resolveSearchMode = (raw: unknown): SearchMode => {
  if (raw === 'exact' || raw === 'semantic' || raw === 'hybrid') return raw;
  return 'hybrid';
};

const mergeHybridMatches = (
  ripgrepMatches: SearchMatch[],
  chunkMatches: Array<{ path: string; startLine: number; endLine: number; symbol?: string; score?: number }>,
  maxResults: number,
  vectorMatches: WorkspaceVectorHit[] = [],
): SearchMatch[] => {
  const rankMap = new Map<string, { match: SearchMatch; score: number }>();

  ripgrepMatches.forEach((match, index) => {
    const key = `${match.path}:${match.line}`;
    const rrf = 1 / (60 + index + 1);
    rankMap.set(key, { match, score: rrf });
  });

  chunkMatches.forEach((chunk, index) => {
    const key = `${chunk.path}:${chunk.startLine}`;
    const rrf = 1 / (60 + index + 1);
    const existing = rankMap.get(key);
    const match: SearchMatch = existing?.match ?? {
      path: chunk.path,
      line: chunk.startLine,
      column: 1,
    };
    rankMap.set(key, {
      match,
      score: (existing?.score ?? 0) + rrf + (chunk.score ?? 0) * 0.01,
    });
  });

  // Third RRF signal: workspace embeddings (semantic match with zero lexical overlap).
  vectorMatches.forEach((hit, index) => {
    const key = `${hit.path}:${hit.startLine}`;
    const rrf = 1 / (60 + index + 1);
    const existing = rankMap.get(key);
    const match: SearchMatch = existing?.match ?? {
      path: hit.path,
      line: hit.startLine,
      column: 1,
    };
    rankMap.set(key, {
      match,
      score: (existing?.score ?? 0) + rrf,
    });
  });

  return [...rankMap.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults)
    .map((entry) => entry.match);
};

const parseRipgrepOutput = (stdout: string): SearchMatch[] => {
  const matches: SearchMatch[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) continue;

    const secondSeparator = line.indexOf(':', separatorIndex + 1);
    if (secondSeparator <= separatorIndex) continue;

    const filePath = line.slice(0, separatorIndex);
    const lineNumber = Number(line.slice(separatorIndex + 1, secondSeparator));
    const text = line.slice(secondSeparator + 1);
    if (!Number.isFinite(lineNumber)) continue;

    matches.push({
      path: normalizeRelativePath(filePath),
      line: lineNumber,
      column: 1,
      text,
    });
  }
  return matches;
};

const searchWithRipgrep = async (
  query: string,
  scopePaths: string[] | undefined,
  maxResults: number,
  caseSensitive: boolean,
  planMode = false,
): Promise<SearchMatch[] | null> => {
  const roots = scopePaths?.length
    ? scopePaths
    : (planMode ? getPlanModeSearchRoots() : getAllowlistedSearchRoots());

  const allowedRoots = planMode
    ? roots.filter((root) => isPlanModeReadablePath(root))
    : roots.filter((root) => isAllowlistedPath(root) || isAllowlistedPath(`${root}/`));
  if (allowedRoots.length === 0) return [];

  const resolvePath = planMode ? resolvePlanModeReadPath : resolveAllowlistedPath;

  const args = [
    '-n',
    '--no-heading',
    '--max-count',
    String(maxResults),
    '--glob',
    '!node_modules/**',
    ...AGENT_SEARCH_EXCLUDE_GLOBS.flatMap((pattern) => ['--glob', `!${pattern}`]),
  ];

  if (!caseSensitive) {
    args.push('-i');
  }

  args.push(
    query,
    ...allowedRoots
      .map((root) => resolvePath(root))
      .filter((item): item is Extract<typeof item, { ok: true }> => item.ok)
      .map((item) => item.relativePath),
  );

  try {
    const { stdout } = await execFileAsync('rg', args, {
      cwd: getRepoRoot(),
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
    return parseRipgrepOutput(stdout).slice(0, maxResults);
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & { stdout?: string; code?: number | string };
    if (execError.code === 'ENOENT') return null;
    if (execError.code === 1 || execError.code === '1') return [];
    if (execError.stdout) {
      return parseRipgrepOutput(execError.stdout).slice(0, maxResults);
    }
    throw error;
  }
};

const searchWithNode = (
  query: string,
  scopePaths: string[] | undefined,
  maxResults: number,
  caseSensitive: boolean,
  planMode = false,
): SearchMatch[] => {
  const matches: SearchMatch[] = [];
  const pattern = caseSensitive ? query : query.toLowerCase();
  const roots = scopePaths?.length
    ? scopePaths
    : (planMode ? getPlanModeSearchRoots() : getAllowlistedSearchRoots());
  const resolvePath = planMode ? resolvePlanModeReadPath : resolveAllowlistedPath;

  for (const root of roots) {
    if (planMode) {
      if (!isPlanModeReadablePath(root)) continue;
    } else if (!isAllowlistedPath(root) && !isAllowlistedPath(`${root}/`)) {
      continue;
    }

    for (const filePath of walkAllowlistedFiles(root)) {
      if (isAgentSearchExcludedPath(filePath)) continue;

      const resolved = resolvePath(filePath);
      if (!resolved.ok) continue;

      let content: string;
      try {
        content = fs.readFileSync(resolved.absolutePath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const lineText = lines[index] ?? '';
        const haystack = caseSensitive ? lineText : lineText.toLowerCase();
        const columnIndex = haystack.indexOf(pattern);
        if (columnIndex < 0) continue;

        matches.push({
          path: resolved.relativePath,
          line: index + 1,
          column: columnIndex + 1,
          text: lineText.trim(),
        });

        if (matches.length >= maxResults) {
          return matches;
        }
      }
    }
  }

  return matches;
};

const resolvePageKeyScopePaths = (
  pageKey: string,
  includeShared: boolean,
): { ok: true; scopePaths: string[] } | { ok: false; summary: string; error: string } => {
  let graph;
  try {
    graph = loadFeatureGraph();
  } catch {
    return {
      ok: false,
      summary: 'Feature graph not found. Run npm run codegen:ai-index after registry changes.',
      error: 'feature_graph_missing',
    };
  }

  const node = findFeatureGraphNode(graph, pageKey);
  if (!node) {
    const knownKeys = graph.nodes.map((entry) => entry.pageKey).join(', ');
    return {
      ok: false,
      summary: `No graph node for pageKey "${pageKey}". Known keys: ${knownKeys}`,
      error: 'page_key_not_found',
    };
  }

  const scopePaths = resolveFeatureSearchRoots(node);
  if (scopePaths.length === 0) {
    return {
      ok: false,
      summary: `Graph node "${pageKey}" has no searchable paths.`,
      error: 'empty_scope',
    };
  }

  if (includeShared) {
    scopePaths.push('src/shared');
  }

  return { ok: true, scopePaths: [...new Set(scopePaths)] };
};

const slimSearchMatches = (
  matches: SearchMatch[],
  includeText: boolean,
): SearchMatch[] => {
  if (includeText) return matches;
  return matches.map(({ path, line, column, pageKey, label }) => {
    const slim: SearchMatch = { path, line, column };
    if (pageKey) slim.pageKey = pageKey;
    if (label) slim.label = label;
    return slim;
  });
};

const annotateMatchesWithFeatureGraph = (matches: SearchMatch[]): SearchMatch[] => {
  let graph;
  try {
    graph = loadFeatureGraph();
  } catch {
    return matches;
  }

  return matches.map((match) => {
    const resolvedPageKey = resolvePageKeyFromFilePath(match.path, graph);
    if (!resolvedPageKey) return match;

    const node = findFeatureGraphNode(graph, resolvedPageKey);
    if (!node) {
      return { ...match, pageKey: resolvedPageKey };
    }

    return {
      ...match,
      pageKey: node.pageKey,
      label: node.label,
    };
  });
};

const resolveScopedFeatureGraph = (
  pageKey: string,
): ReturnType<typeof buildFeatureGraphSearchContext> | undefined => {
  let graph;
  try {
    graph = loadFeatureGraph();
  } catch {
    return undefined;
  }

  const node = findFeatureGraphNode(graph, pageKey);
  if (!node) return undefined;

  return buildFeatureGraphSearchContext(node, graph);
};

export const executeSearchCodebase = async (args: Record<string, unknown>, context?: ToolExecutionContext) => {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    return { ok: false as const, summary: 'Search query is required.', error: 'missing_query' };
  }

  const scopePath = typeof args.path === 'string' && args.path.trim()
    ? normalizeRelativePath(args.path)
    : undefined;
  const explicitPageKey = typeof args.pageKey === 'string' ? args.pageKey.trim() : '';
  const includeShared = args.includeShared === true;

  let scopePaths: string[] | undefined;
  let pageKey = explicitPageKey;

  if (!scopePath && !pageKey && context?.pageContext) {
    const promptTargets = extractPromptEngineeringTargets(query);
    if (!hasPromptEngineeringTargets(promptTargets)) {
      pageKey = context.pageContext.pageKey?.trim()
        || resolvePageKeyFromPathname(context.pageContext.path)
        || '';
    }
  }

  if (scopePath) {
    if (context?.mode === 'plan') {
      if (!isPlanModeReadablePath(scopePath)) {
        return {
          ok: false as const,
          summary: `Search path "${scopePath}" is outside Plan mode scope (plans/core/ and plans/packages/ only).`,
          error: 'path_not_allowed',
        };
      }
    } else if (!isAllowlistedPath(scopePath) && !isAllowlistedPath(`${scopePath}/`)) {
      return {
        ok: false as const,
        summary: `Search path "${scopePath}" is outside the agent allowlist.`,
        error: 'path_not_allowed',
      };
    }
    scopePaths = expandAgentScopeRoots(scopePath) ?? [scopePath];
  } else if (pageKey) {
    const resolved = resolvePageKeyScopePaths(pageKey, includeShared);
    if (!resolved.ok) {
      return { ok: false as const, summary: resolved.summary, error: resolved.error };
    }
    scopePaths = resolved.scopePaths;
  }

  const maxResults = typeof args.maxResults === 'number' && args.maxResults > 0
    ? Math.min(Math.floor(args.maxResults), 100)
    : DEFAULT_MAX_RESULTS;
  const caseSensitive = args.caseSensitive === true;
  const includeText = args.includeText === true;
  const searchMode = resolveSearchMode(args.mode);
  const planMode = context?.mode === 'plan';
  const effectiveScope = scopePaths ?? (planMode ? getPlanModeSearchRoots() : undefined);

  let rawMatches: SearchMatch[] = [];

  // Vector search never runs in plan mode (plan scope is a handful of md files) and is a
  // no-op returning [] until an embeddings model is configured and the index has content.
  const vectorHitsPromise: Promise<WorkspaceVectorHit[]> = (!planMode && searchMode !== 'exact')
    ? searchWorkspaceEmbeddings(query, effectiveScope, maxResults).catch(() => [])
    : Promise.resolve([]);

  if (searchMode === 'semantic') {
    const chunkHits = searchCodeChunks(query, effectiveScope, maxResults, planMode);
    const vectorHits = await vectorHitsPromise;
    rawMatches = vectorHits.length > 0
      ? mergeHybridMatches([], chunkHits, maxResults, vectorHits)
      : chunkHits.map((chunk) => ({
        path: chunk.path,
        line: chunk.startLine,
        column: 1,
      }));
  } else {
    const ripgrepMatches = await searchWithRipgrep(query, effectiveScope, maxResults, caseSensitive, planMode);
    const rgMatches = ripgrepMatches === null
      ? searchWithNode(query, effectiveScope, maxResults, caseSensitive, planMode)
      : ripgrepMatches.length > 0
        ? ripgrepMatches
        : searchWithNode(query, effectiveScope, maxResults, caseSensitive, planMode);

    if (searchMode === 'hybrid') {
      const chunkHits = searchCodeChunks(query, effectiveScope, maxResults, planMode);
      const vectorHits = await vectorHitsPromise;
      rawMatches = mergeHybridMatches(rgMatches, chunkHits, maxResults, vectorHits);
      if (rawMatches.length === 0 && chunkHits.length > 0) {
        rawMatches = chunkHits.map((chunk) => ({
          path: chunk.path,
          line: chunk.startLine,
          column: 1,
        }));
      }
      if (rawMatches.length === 0) {
        rawMatches = rgMatches;
      }
    } else {
      rawMatches = rgMatches;
      if (
        rawMatches.length === 0
        && query.split(/\s+/).filter((term) => term.length >= 3).length >= 2
      ) {
        const chunkHits = searchCodeChunks(query, effectiveScope, maxResults, planMode);
        rawMatches = chunkHits.map((chunk) => ({
          path: chunk.path,
          line: chunk.startLine,
          column: 1,
        }));
      }
    }
  }

  let subLoopRefined = false;
  if (
    isComplexSearchQuery(query)
    && rawMatches.length > 0
    && searchMode !== 'exact'
  ) {
    const refinedQuery = refineSearchQueryFromMatches(query, rawMatches);
    const refineScopes = deriveRefineScopePaths(rawMatches);
    if (refinedQuery !== query && refineScopes.length > 0) {
      const refinedChunks = searchCodeChunks(refinedQuery, refineScopes, maxResults, planMode);
      const refinedMatches = refinedChunks.map((chunk) => ({
        path: chunk.path,
        line: chunk.startLine,
        column: 1,
      }));
      if (refinedMatches.length > 0) {
        rawMatches = mergeSearchMatchLists(rawMatches, refinedMatches, maxResults);
        subLoopRefined = true;
      }
    }
  }

  const annotatedMatches = annotateMatchesWithFeatureGraph(rawMatches);
  const matches = slimSearchMatches(annotatedMatches, includeText);
  const featureGraph = pageKey ? resolveScopedFeatureGraph(pageKey) : undefined;
  const graphPageKeys = pageKey
    ? undefined
    : [...new Set(matches.map((match) => match.pageKey).filter((key): key is string => Boolean(key)))];

  const scopeLabel = scopePath ?? (pageKey ? `pageKey:${pageKey}` : null);

  return {
    ok: true as const,
    summary: matches.length > 0
      ? `Found ${matches.length} match(es) for "${query}"${subLoopRefined ? ' (refined sub-search)' : ''}. Verify with read_file (startLine/endLine) before citing code.`
      : `No matches found for "${query}".`,
    data: {
      query,
      mode: searchMode,
      subLoopRefined,
      pageKey: pageKey || null,
      scopePath: scopeLabel,
      scopePaths: effectiveScope ?? null,
      includeText,
      matchCount: matches.length,
      matches,
      featureGraph: featureGraph ?? null,
      graphPageKeys: graphPageKeys?.length ? graphPageKeys : null,
      verifyHint: 'Call read_file with startLine/endLine from search hits before citing code.',
    },
  };
};

export const searchCodebaseTool: NativeToolDefinition = {
  name: SEARCH_CODEBASE_TOOL_NAME,
  description: 'Searches the allowlisted codebase with ripgrep, semantic chunk index, or hybrid (default). Complex queries auto-run a refine sub-search (E.2). Scope with pageKey or path. Follow hits with read_file. Example: search_codebase({ query: "AppTableGrid validation", pageKey: "users", mode: "hybrid" }).',
  group: 'search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search text or regex pattern.' },
      mode: {
        type: 'string',
        enum: ['exact', 'semantic', 'hybrid'],
        description: 'Search mode: exact (ripgrep only), semantic (chunk index), hybrid (default — merges both).',
      },
      pageKey: {
        type: 'string',
        description: 'Studio pageKey (e.g. package-manager, edge) — scopes search to that feature graph node.',
      },
      path: { type: 'string', description: 'Optional allowlisted directory or file scope (overrides pageKey).' },
      includeShared: {
        type: 'boolean',
        description: 'When using pageKey, also search src/shared/ (default false).',
      },
      maxResults: { type: 'number', description: 'Maximum matches to return (default 30, max 100).' },
      caseSensitive: { type: 'boolean', description: 'Case-sensitive search (default false).' },
      includeText: {
        type: 'boolean',
        description: 'Include matched line text in results (default false — use read_file to verify hits).',
      },
    },
    required: ['query'],
  },
  execute: (args, context) => executeSearchCodebase(args, context),
};
