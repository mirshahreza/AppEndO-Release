import type { NativeToolDefinition } from '../ToolRegistry';
import { loadToolOutputArtifact } from '../../agent/toolOutputArtifactStore';

/**
 * V5 Phase P09 §15 "Large Output Defense must be runtime-level" — the phase doc's literal tool
 * quartet, made real and reachable. Every large tool observation is already durably persisted as
 * a `ToolOutputArtifact` (`toolOutputArtifactStore.ts`, wired from `toolObservationCompact.ts`)
 * keyed by the same `ref` the model already sees in a compacted observation — these tools let the
 * model actually use that ref instead of it being a dead end (confirmed, before this phase, no
 * tool ever consumed it).
 */

const ERROR_LIKE_LINE_PATTERN = /error|fail|exception|traceback|✗|✖/i;

const resolveArtifact = (args: Record<string, unknown>) => {
  const artifactId = typeof args.artifactId === 'string' ? args.artifactId.trim() : '';
  if (!artifactId) {
    return { ok: false as const, summary: 'artifactId is required.', error: 'missing_artifact_id' };
  }
  const artifact = loadToolOutputArtifact(artifactId);
  if (!artifact) {
    return {
      ok: false as const,
      summary: `No artifact found for "${artifactId}" — it may have been below the compaction threshold (no artifact was created) or the ref is invalid.`,
      error: 'artifact_not_found',
    };
  }
  return { ok: true as const, artifactId, ...artifact };
};

export const ARTIFACT_READ_RANGE_TOOL_NAME = 'artifact_read_range';
export const artifactReadRangeTool: NativeToolDefinition = {
  name: ARTIFACT_READ_RANGE_TOOL_NAME,
  description: 'Retrieves a line range from a large tool output artifact (identified by the "ref" field in a prior compacted tool observation). Use when a previous read_file/run_tests/git_diff/etc. result was truncated and you need a part beyond what was shown inline. Example: artifact_read_range({ artifactId: "obs:a1b2c3d4", startLine: 200, endLine: 260 }).',
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      artifactId: { type: 'string', description: 'The "ref" value from a prior compacted tool observation.' },
      startLine: { type: 'number', description: '1-based start line (default 1).' },
      endLine: { type: 'number', description: '1-based inclusive end line (default startLine + 200).' },
    },
    required: ['artifactId'],
  },
  execute: async (args) => {
    const resolved = resolveArtifact(args);
    if (!resolved.ok) return resolved;

    if (resolved.meta.contentType !== 'text') {
      return {
        ok: false,
        summary: `Artifact "${resolved.artifactId}" is structured JSON, not line-oriented text — use artifact_search instead.`,
        error: 'not_line_oriented',
      };
    }

    const lines = resolved.content.split('\n');
    const startLine = typeof args.startLine === 'number' && args.startLine > 0 ? Math.floor(args.startLine) : 1;
    const endLine = typeof args.endLine === 'number' && args.endLine >= startLine
      ? Math.min(Math.floor(args.endLine), lines.length)
      : Math.min(startLine + 200 - 1, lines.length);

    const sliceStart = Math.max(1, startLine);
    const sliceEnd = Math.max(sliceStart, endLine);
    const numbered = lines.slice(sliceStart - 1, sliceEnd)
      .map((line, index) => `${sliceStart + index}|${line}`)
      .join('\n');

    return {
      ok: true,
      summary: `Read lines ${sliceStart}-${sliceEnd} of ${lines.length} from artifact "${resolved.artifactId}".`,
      data: { artifactId: resolved.artifactId, startLine: sliceStart, endLine: sliceEnd, totalLines: lines.length, content: numbered },
    };
  },
};

export const ARTIFACT_TAIL_TOOL_NAME = 'artifact_tail';
export const artifactTailTool: NativeToolDefinition = {
  name: ARTIFACT_TAIL_TOOL_NAME,
  description: 'Retrieves the last N characters of a large tool output artifact. Use for a truncated read_file/git_diff/git_show whose inline preview kept the head — the tail is where the file/diff actually ends. Example: artifact_tail({ artifactId: "obs:a1b2c3d4", maxChars: 3000 }).',
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      artifactId: { type: 'string', description: 'The "ref" value from a prior compacted tool observation.' },
      maxChars: { type: 'number', description: 'Max characters to return from the end (default 3000, max 20000).' },
    },
    required: ['artifactId'],
  },
  execute: async (args) => {
    const resolved = resolveArtifact(args);
    if (!resolved.ok) return resolved;

    if (resolved.meta.contentType !== 'text') {
      return {
        ok: false,
        summary: `Artifact "${resolved.artifactId}" is structured JSON, not line-oriented text — use artifact_search instead.`,
        error: 'not_line_oriented',
      };
    }

    const maxChars = typeof args.maxChars === 'number' && args.maxChars > 0
      ? Math.min(Math.floor(args.maxChars), 20_000)
      : 3_000;
    const tail = resolved.content.slice(-maxChars);

    return {
      ok: true,
      summary: `Tail of artifact "${resolved.artifactId}" (last ${tail.length} of ${resolved.content.length} characters).`,
      data: { artifactId: resolved.artifactId, byteLength: resolved.meta.byteLength, content: tail },
    };
  },
};

export const ARTIFACT_SEARCH_TOOL_NAME = 'artifact_search';
export const artifactSearchTool: NativeToolDefinition = {
  name: ARTIFACT_SEARCH_TOOL_NAME,
  description: 'Case-insensitive substring search over a large tool output artifact, returning matching lines with line numbers. Use to find a specific symbol/path/message inside a truncated large output without retrieving the whole thing. Example: artifact_search({ artifactId: "obs:a1b2c3d4", query: "TypeError" }).',
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      artifactId: { type: 'string', description: 'The "ref" value from a prior compacted tool observation.' },
      query: { type: 'string', description: 'Case-insensitive substring to search for.' },
      maxMatches: { type: 'number', description: 'Max matching lines to return (default 20, max 100).' },
    },
    required: ['artifactId', 'query'],
  },
  execute: async (args) => {
    const resolved = resolveArtifact(args);
    if (!resolved.ok) return resolved;

    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return { ok: false, summary: 'query is required.', error: 'missing_query' };
    }

    const maxMatches = typeof args.maxMatches === 'number' && args.maxMatches > 0
      ? Math.min(Math.floor(args.maxMatches), 100)
      : 20;
    const needle = query.toLowerCase();
    const lines = resolved.content.split('\n');
    const matches = lines
      .map((line, index) => ({ line: index + 1, text: line }))
      .filter((entry) => entry.text.toLowerCase().includes(needle))
      .slice(0, maxMatches);

    return {
      ok: true,
      summary: `Found ${matches.length} matching line(s) for "${query}" in artifact "${resolved.artifactId}"${matches.length === maxMatches ? ' (capped)' : ''}.`,
      data: { artifactId: resolved.artifactId, query, matchCount: matches.length, matches },
    };
  },
};

export const ARTIFACT_LIST_ERRORS_TOOL_NAME = 'artifact_list_errors';
export const artifactListErrorsTool: NativeToolDefinition = {
  name: ARTIFACT_LIST_ERRORS_TOOL_NAME,
  description: 'Lists error/failure-looking lines (error, fail, exception, traceback, ✗) from a large tool output artifact, with line numbers — a fast way to scan a truncated run_tests/git output for what broke. Example: artifact_list_errors({ artifactId: "obs:a1b2c3d4" }).',
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      artifactId: { type: 'string', description: 'The "ref" value from a prior compacted tool observation.' },
      maxMatches: { type: 'number', description: 'Max matching lines to return (default 30, max 100).' },
    },
    required: ['artifactId'],
  },
  execute: async (args) => {
    const resolved = resolveArtifact(args);
    if (!resolved.ok) return resolved;

    const maxMatches = typeof args.maxMatches === 'number' && args.maxMatches > 0
      ? Math.min(Math.floor(args.maxMatches), 100)
      : 30;
    const lines = resolved.content.split('\n');
    const matches = lines
      .map((line, index) => ({ line: index + 1, text: line }))
      .filter((entry) => ERROR_LIKE_LINE_PATTERN.test(entry.text))
      .slice(0, maxMatches);

    return {
      ok: true,
      summary: `Found ${matches.length} error-like line(s) in artifact "${resolved.artifactId}"${matches.length === maxMatches ? ' (capped)' : ''}.`,
      data: { artifactId: resolved.artifactId, matchCount: matches.length, matches },
    };
  },
};
