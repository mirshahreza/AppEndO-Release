import fs from 'node:fs';
import path from 'node:path';
import {
  getAllowlistedSearchRoots,
  getPlanModeSearchRoots,
  isAgentSearchExcludedPath,
  normalizeRelativePath,
  walkAllowlistedFiles,
} from '../pathAllowlist';

export type IndexedCodeChunk = {
  path: string;
  startLine: number;
  endLine: number;
  symbol?: string;
  score?: number;
};

type StoredChunk = IndexedCodeChunk & {
  text: string;
  termFreq: Map<string, number>;
  termCount: number;
  /** Every detected symbol in the chunk with its line — `symbol` keeps only the first. */
  symbols: Array<{ name: string; line: number }>;
};

type IndexedFile = {
  mtimeMs: number;
  size: number;
  chunks: StoredChunk[];
};

const CHUNK_MAX_LINES = 80;
const CHUNK_OVERLAP_LINES = 8;
const MIN_TERM_LENGTH = 3;
/** How long a stat-sweep result stays trusted before we re-stat the tree (cheap, ~100ms). */
const STAT_SWEEP_TTL_MS = 10_000;
const INDEXABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.json']);

/** BM25 constants (standard Robertson defaults). */
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** Exact symbol-name match — the strongest relevance signal for identifier queries. */
const SYMBOL_EXACT_BONUS = 25;
const SYMBOL_PARTIAL_BONUS = 6;
const PATH_PARTIAL_BONUS = 3;

type IndexState = {
  files: Map<string, IndexedFile>;
  /** Document frequency per term across all chunks — BM25 idf input. */
  docFreq: Map<string, number>;
  chunkCount: number;
  totalTermCount: number;
  lastSweepAt: number;
};

const indexState: IndexState = {
  files: new Map(),
  docFreq: new Map(),
  chunkCount: 0,
  totalTermCount: 0,
  lastSweepAt: 0,
};

/**
 * CamelCase/underscore-aware tokenizer. `ApiClientInterface` must match the query
 * "api interface" — the previous lowercase-first tokenizer collapsed it into a single
 * opaque term, which blinded the whole chunk index for camelCase codebases.
 * Emits both the split parts and the joined lowercase identifier (exact-identifier queries).
 */
export const tokenizeCode = (text: string): string[] => {
  const rawIdentifiers = text.match(/[A-Za-z0-9_][A-Za-z0-9_-]*/g);
  if (!rawIdentifiers) return [];

  const terms: string[] = [];
  for (const identifier of rawIdentifiers) {
    const lower = identifier.toLowerCase();
    if (lower.length >= MIN_TERM_LENGTH) {
      terms.push(lower);
    }
    const parts = identifier
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[_\-\s]+/);
    if (parts.length > 1) {
      for (const part of parts) {
        const partLower = part.toLowerCase();
        if (partLower.length >= MIN_TERM_LENGTH && partLower !== lower) {
          terms.push(partLower);
        }
      }
    }
  }
  return terms;
};

const buildTermFreq = (text: string): { termFreq: Map<string, number>; termCount: number } => {
  const freq = new Map<string, number>();
  const terms = tokenizeCode(text);
  terms.forEach((term) => {
    freq.set(term, (freq.get(term) ?? 0) + 1);
  });
  return { termFreq: freq, termCount: terms.length };
};

const detectSymbol = (line: string): string | undefined => {
  const patterns = [
    /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/,
    /^\s*export\s+const\s+([A-Za-z0-9_]+)\s*=/,
    /^\s*export\s+class\s+([A-Za-z0-9_]+)/,
    /^\s*export\s+type\s+([A-Za-z0-9_]+)/,
    /^\s*export\s+interface\s+([A-Za-z0-9_]+)/,
    /^\s*function\s+([A-Za-z0-9_]+)/,
    /^\s*class\s+([A-Za-z0-9_]+)/,
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
};

const chunkFileLines = (relativePath: string, lines: string[]): StoredChunk[] => {
  const chunks: StoredChunk[] = [];
  let index = 0;

  while (index < lines.length) {
    const startLine = index + 1;
    const endIndex = Math.min(lines.length, index + CHUNK_MAX_LINES);
    const slice = lines.slice(index, endIndex);
    const symbols: Array<{ name: string; line: number }> = [];
    slice.forEach((line, offset) => {
      const name = detectSymbol(line);
      if (name) symbols.push({ name, line: startLine + offset });
    });
    const text = slice.join('\n');
    const { termFreq, termCount } = buildTermFreq(text);
    chunks.push({
      path: relativePath,
      startLine,
      endLine: endIndex,
      symbol: symbols[0]?.name,
      symbols,
      text,
      termFreq,
      termCount,
    });
    if (endIndex >= lines.length) break;
    index = Math.max(index + 1, endIndex - CHUNK_OVERLAP_LINES);
  }

  return chunks;
};

const isIndexableFile = (relativePath: string): boolean => {
  if (isAgentSearchExcludedPath(relativePath)) return false;
  const ext = path.extname(relativePath).toLowerCase();
  return INDEXABLE_EXTENSIONS.has(ext);
};

const addFileToAggregates = (file: IndexedFile): void => {
  for (const chunk of file.chunks) {
    indexState.chunkCount += 1;
    indexState.totalTermCount += chunk.termCount;
    for (const term of chunk.termFreq.keys()) {
      indexState.docFreq.set(term, (indexState.docFreq.get(term) ?? 0) + 1);
    }
  }
};

const removeFileFromAggregates = (file: IndexedFile): void => {
  for (const chunk of file.chunks) {
    indexState.chunkCount -= 1;
    indexState.totalTermCount -= chunk.termCount;
    for (const term of chunk.termFreq.keys()) {
      const df = (indexState.docFreq.get(term) ?? 1) - 1;
      if (df <= 0) indexState.docFreq.delete(term);
      else indexState.docFreq.set(term, df);
    }
  }
};

const indexFile = (relativePath: string, mtimeMs: number, size: number): void => {
  try {
    const absolutePath = path.join(process.cwd(), relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) return;
    const normalized = normalizeRelativePath(relativePath);
    const previous = indexState.files.get(normalized);
    if (previous) removeFileFromAggregates(previous);
    const file: IndexedFile = { mtimeMs, size, chunks: chunkFileLines(normalized, lines) };
    indexState.files.set(normalized, file);
    addFileToAggregates(file);
  } catch {
    // Skip unreadable files.
  }
};

/**
 * Incremental refresh (Cursor/VS Code workspace-index model, local variant): walk + stat the
 * allowlisted tree (cheap), then re-read ONLY files whose mtime/size changed and drop deleted
 * ones. The old implementation re-read every file from scratch on a 5-minute TTL — a full
 * rebuild paid on the query path. A short TTL on the stat sweep keeps query bursts free.
 */
const refreshIndex = (planMode: boolean, force = false): void => {
  const now = Date.now();
  if (!force && now - indexState.lastSweepAt < STAT_SWEEP_TTL_MS && indexState.files.size > 0) {
    return;
  }
  indexState.lastSweepAt = now;

  const roots = planMode ? getPlanModeSearchRoots() : getAllowlistedSearchRoots();
  const seen = new Set<string>();

  roots.forEach((root) => {
    for (const filePath of walkAllowlistedFiles(root)) {
      if (!isIndexableFile(filePath)) continue;
      const normalized = normalizeRelativePath(filePath);
      seen.add(normalized);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(path.join(process.cwd(), filePath));
      } catch {
        continue;
      }
      const existing = indexState.files.get(normalized);
      if (!existing || existing.mtimeMs !== stat.mtimeMs || existing.size !== stat.size) {
        indexFile(filePath, stat.mtimeMs, stat.size);
      }
    }
  });

  for (const [filePath, file] of [...indexState.files.entries()]) {
    if (!seen.has(filePath)) {
      removeFileFromAggregates(file);
      indexState.files.delete(filePath);
    }
  }
};

const bm25Idf = (term: string): number => {
  const df = indexState.docFreq.get(term) ?? 0;
  const n = Math.max(1, indexState.chunkCount);
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
};

const scoreChunk = (chunk: StoredChunk, queryTerms: string[], avgTermCount: number): number => {
  if (queryTerms.length === 0) return 0;

  let score = 0;
  const pathLower = chunk.path.toLowerCase();
  const symbolNames = chunk.symbols.map((entry) => entry.name.toLowerCase());
  const symbolParts = symbolNames.length
    ? new Set(symbolNames.flatMap((name) => tokenizeCode(name)))
    : undefined;

  const lengthNorm = BM25_K1 * (1 - BM25_B + (BM25_B * chunk.termCount) / Math.max(1, avgTermCount));

  queryTerms.forEach((term) => {
    const tf = chunk.termFreq.get(term) ?? 0;
    if (tf > 0) {
      // BM25: distinctive terms count, boilerplate terms ("export", "type") barely do,
      // and long chunks no longer win just by containing more text.
      score += bm25Idf(term) * ((tf * (BM25_K1 + 1)) / (tf + lengthNorm));
    }
    if (symbolNames.length) {
      if (symbolNames.includes(term)) {
        score += SYMBOL_EXACT_BONUS;
      } else if (symbolParts?.has(term) || symbolNames.some((name) => name.includes(term))) {
        score += SYMBOL_PARTIAL_BONUS;
      }
    }
    if (pathLower.includes(term)) {
      score += PATH_PARTIAL_BONUS;
    }
  });

  return score;
};

export const searchCodeChunks = (
  query: string,
  scopePaths: string[] | undefined,
  maxResults: number,
  planMode = false,
): IndexedCodeChunk[] => {
  const queryTerms = [...new Set(tokenizeCode(query))];
  if (queryTerms.length === 0) return [];

  refreshIndex(planMode);

  // Scoped searches filter the full index instead of rebuilding it from scoped roots —
  // the old code cached a scoped build as the global index, poisoning later searches.
  const scopePrefixes = scopePaths?.length
    ? scopePaths.map((scopePath) => normalizeRelativePath(scopePath).replace(/\/$/, ''))
    : undefined;
  const inScope = (chunkPath: string): boolean => {
    if (!scopePrefixes) return true;
    return scopePrefixes.some((prefix) => chunkPath === prefix || chunkPath.startsWith(`${prefix}/`));
  };

  const avgTermCount = indexState.chunkCount > 0
    ? indexState.totalTermCount / indexState.chunkCount
    : 1;

  const scored: Array<{ chunk: StoredChunk; score: number }> = [];
  for (const file of indexState.files.values()) {
    for (const chunk of file.chunks) {
      if (!inScope(chunk.path)) continue;
      const score = scoreChunk(chunk, queryTerms, avgTermCount);
      if (score > 0) scored.push({ chunk, score });
    }
  }

  return scored
    .sort((left, right) => right.score - left.score || left.chunk.path.localeCompare(right.chunk.path))
    .slice(0, maxResults)
    .map((entry) => ({
      path: entry.chunk.path,
      startLine: entry.chunk.startLine,
      endLine: entry.chunk.endLine,
      symbol: entry.chunk.symbol,
      score: entry.score,
    }));
};

/**
 * Exported-symbol lookup map (`export const/function/class/type/interface NAME` → location).
 * Symbols are detected during chunking anyway; keeping the map costs nothing and turns
 * "find X" identifier queries into an O(1) hit instead of a ranked guess.
 */
export const lookupExportedSymbol = (
  name: string,
  planMode = false,
): Array<{ path: string; startLine: number; symbol: string }> => {
  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  refreshIndex(planMode);
  const seen = new Set<string>();
  const hits: Array<{ path: string; startLine: number; symbol: string }> = [];
  for (const file of indexState.files.values()) {
    for (const chunk of file.chunks) {
      for (const entry of chunk.symbols) {
        if (entry.name.toLowerCase() !== needle) continue;
        const key = `${chunk.path}:${entry.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({ path: chunk.path, startLine: entry.line, symbol: entry.name });
      }
    }
  }
  return hits;
};

/** Iterate current chunks (path, text, line range) — feeds the embeddings index (Phase 2). */
export const listIndexedChunks = (
  planMode = false,
): Array<{ path: string; startLine: number; endLine: number; symbol?: string; text: string }> => {
  refreshIndex(planMode);
  const chunks: Array<{ path: string; startLine: number; endLine: number; symbol?: string; text: string }> = [];
  for (const file of indexState.files.values()) {
    for (const chunk of file.chunks) {
      chunks.push({
        path: chunk.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbol: chunk.symbol,
        text: chunk.text,
      });
    }
  }
  return chunks;
};

/** True once the in-memory chunk index has completed at least one warm-up pass. */
export const isCodeChunkIndexWarmed = (): boolean => indexState.files.size > 0;

/** Chunk count from the warmed in-memory index — no filesystem walk. */
export const getCodeChunkIndexChunkCount = (): number => indexState.chunkCount;

/** Visit warmed chunks without triggering a cold filesystem walk. */
export const visitWarmedChunks = (
  visitor: (chunk: { path: string; text: string }) => void,
): void => {
  for (const file of indexState.files.values()) {
    for (const chunk of file.chunks) {
      visitor({ path: chunk.path, text: chunk.text });
    }
  }
};

/** Build the index off the query path (server boot warm-up). Safe to call repeatedly. */
export const warmCodeChunkIndex = (): void => {
  refreshIndex(false, true);
};

/** Test-only — reset in-memory index between cases. */
export const resetCodeChunkIndexForTests = (): void => {
  indexState.files.clear();
  indexState.docFreq.clear();
  indexState.chunkCount = 0;
  indexState.totalTermCount = 0;
  indexState.lastSweepAt = 0;
};
