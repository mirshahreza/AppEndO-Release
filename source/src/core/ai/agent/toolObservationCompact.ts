import { createHash, randomUUID } from 'crypto';
import type { ToolResult } from '../../../shared/api/contracts/ai/agentTypes';
import { persistToolOutputArtifactIfLarge } from './toolOutputArtifactStore';
import { GET_PROJECT_STANDARDS_TOOL_NAME } from '../tools/native/getProjectStandards';
import { READ_FILE_TOOL_NAME } from '../tools/native/readFile';
import { SEARCH_CODEBASE_TOOL_NAME } from '../tools/native/searchCodebase';
import { RUN_TESTS_TOOL_NAME } from '../tools/native/runTests';
import {
  GIT_BLAME_TOOL_NAME,
  GIT_DIFF_TOOL_NAME,
  GIT_LOG_TOOL_NAME,
  GIT_SHOW_TOOL_NAME,
  GIT_STATUS_TOOL_NAME,
} from '../tools/native/git/gitTools';

/** p-63 A3 — raised from 2,048: the old cap starved the model of tool output it needed. */
export const GENERIC_DATA_PREVIEW_MAX_CHARS = 8_000;
/**
 * Raised from a previous hard 500-char cap: real shards the system prompt tells the
 * model to load first (vibe-operator-playbook, vibe-coding-workflows) are ~7,000 chars —
 * a 500-char slice showed the model under 10% of its own operating instructions, silently
 * and with no banner. Matches the MAX_PLAN_DOC_CHARS convention used elsewhere for the
 * same "keep most of a real doc, banner when it doesn't fit" tradeoff.
 */
export const STANDARDS_SHARD_PREVIEW_MAX_CHARS = 12_000;
export const STANDARDS_QUERY_MAX_RULE_IDS = 20;
/** F.4 — do not compact tool payloads shorter than this (VS Code parity). */
export const MIN_COMPRESSIBLE_TOOL_CHARS = 1_024;
/**
 * Ceiling for read_file content kept in the LLM-facing preview. Higher than
 * GENERIC_DATA_PREVIEW_MAX_CHARS because source code is the tool's entire purpose —
 * dropping it (the previous behavior) left the model with line-count metadata only
 * and no actual code to read, on every single read_file call.
 */
export const READ_FILE_CONTENT_PREVIEW_MAX_CHARS = 40_000;
/** Per-match cap when search_codebase includeText matches are large enough to need trimming. */
export const SEARCH_MATCH_TEXT_PREVIEW_MAX_CHARS = 1_200;
/** git_diff/git_show/git_log/git_blame/git_status raw output — diffs are what the model must review before git_commit. */
export const GIT_OUTPUT_PREVIEW_MAX_CHARS = 20_000;
/** run_tests output — Vitest's pass/fail summary and stack traces are at the tail, so this preserves the end, not the start. */
export const RUN_TESTS_OUTPUT_PREVIEW_MAX_CHARS = 16_000;

export type CompactToolObservation = {
  ok: boolean;
  summary: string;
  error?: string;
  ref?: string;
  dataPreview?: unknown;
};

/** Full tool payloads keyed by ref — scoped to one `AgentOrchestrator.run()`. */
export class SessionToolObservationStore {
  private readonly observations = new Map<string, unknown>();

  /**
   * V5 Phase P09 §15 — `meta` is optional so every pre-existing caller (this file's own
   * `compactXxx` helpers, plus test-only direct callers) keeps working unchanged; the real
   * production call site (`compactToolObservation`, called from `AgentOrchestrator.ts`) always
   * supplies it, which is what makes `artifact_read_range`/`artifact_tail`/etc. reachable for a
   * real run. Without `meta`, the ref still works for `store.get()` (in-memory only) — it's the
   * durable-artifact persistence in `toolOutputArtifactStore.ts` that's skipped.
   */
  store(fullPayload: unknown, meta?: { toolCallId: string; toolName: string }): string {
    // V5 P09 §15 — was a hash of a per-instance sequence number (0,1,2,…), which was
    // globally-unique-enough while refs were purely in-memory and scoped to one run's Map. Now
    // that a large observation is ALSO persisted to disk keyed by this ref
    // (`toolOutputArtifactStore.ts`), two separate runs both starting their own sequence at 0
    // would collide and overwrite each other's artifacts — randomUUID gives real cross-run
    // uniqueness instead.
    const ref = `obs:${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    this.observations.set(ref, fullPayload);
    if (meta) {
      persistToolOutputArtifactIfLarge(ref, fullPayload, meta);
    }
    return ref;
  }

  get(ref: string): unknown | undefined {
    return this.observations.get(ref);
  }

  size(): number {
    return this.observations.size;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const countShardRuleLines = (content: string): number => (
  content.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('|') || trimmed.startsWith('- ');
  }).length
);

const isStructuredPayload = (data: unknown): boolean => {
  if (Array.isArray(data)) return true;
  if (!isRecord(data)) return false;
  return Object.keys(data).some((key) => (
    key === 'schema'
    || key === 'nodes'
    || key === 'bindings'
    || key === 'document'
    || key === 'bindingDefinitions'
    || key === 'matches'
    || key === 'standards'
    // get_server_function's statically-derived input/output contract (GAP-2 fix) —
    // must survive raw string truncation intact even when `source` pushes the
    // serialized payload past GENERIC_DATA_PREVIEW_MAX_CHARS.
    || key === 'contract'
  ));
};

const capGenericDataPreview = (data: unknown): unknown => {
  const serialized = JSON.stringify(data);
  if (serialized.length < MIN_COMPRESSIBLE_TOOL_CHARS) {
    return data;
  }
  if (isStructuredPayload(data)) {
    return data;
  }
  if (serialized.length <= GENERIC_DATA_PREVIEW_MAX_CHARS) {
    return data;
  }

  return {
    truncated: true,
    compressionBanner: `[Output compacted — ${serialized.length} → ${GENERIC_DATA_PREVIEW_MAX_CHARS} chars]`,
    originalChars: serialized.length,
    preview: `${serialized.slice(0, GENERIC_DATA_PREVIEW_MAX_CHARS)}…`,
  };
};

/** Cap a text field for the LLM preview; never return an empty/absent field for non-empty input. */
const capTextPreview = (
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } => {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, maxChars)}\n[Output compacted — ${text.length} → ${maxChars} chars]`,
    truncated: true,
  };
};

type CompactMeta = { toolName: string; toolCallId?: string };
const storeMeta = (meta: CompactMeta): { toolCallId: string; toolName: string } | undefined => (
  meta.toolCallId ? { toolCallId: meta.toolCallId, toolName: meta.toolName } : undefined
);

const compactReadFile = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  const data = isRecord(result.data) ? result.data : {};
  const startLine = typeof data.startLine === 'number' ? data.startLine : 1;
  const endLine = typeof data.endLine === 'number' ? data.endLine : startLine;
  const rawContent = typeof data.content === 'string' ? data.content : '';
  const contentPreview = capTextPreview(rawContent, READ_FILE_CONTENT_PREVIEW_MAX_CHARS);

  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: {
      path: data.path,
      startLine,
      endLine,
      totalLines: data.totalLines,
      lineCount: Math.max(0, endLine - startLine + 1),
      truncated: Boolean(data.truncated) || contentPreview.truncated,
      // Actual code — the model cannot use read_file to inform drafting without this.
      content: contentPreview.text,
    },
  };
};

const compactProjectStandards = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  const data = isRecord(result.data) ? result.data : {};

  if (typeof data.content === 'string') {
    const content = data.content;
    const contentPreview = capTextPreview(content, STANDARDS_SHARD_PREVIEW_MAX_CHARS);
    return {
      ok: result.ok,
      summary: result.summary,
      error: result.error,
      ref: store.store(result.data, storeMeta(meta)),
      dataPreview: {
        path: data.path,
        shard: data.shard,
        ruleCount: countShardRuleLines(content),
        truncated: contentPreview.truncated,
        preview: contentPreview.text,
      },
    };
  }

  if (Array.isArray(data.standards)) {
    const standards = data.standards as Array<{ id?: string }>;
    return {
      ok: result.ok,
      summary: result.summary,
      error: result.error,
      ref: store.store(result.data, storeMeta(meta)),
      dataPreview: {
        matchCount: standards.length,
        ids: standards
          .slice(0, STANDARDS_QUERY_MAX_RULE_IDS)
          .map((rule) => rule.id)
          .filter((id): id is string => typeof id === 'string'),
      },
    };
  }

  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: capGenericDataPreview(data),
  };
};

const compactSearchCodebase = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  const data = isRecord(result.data) ? result.data : {};
  const rawMatches = Array.isArray(data.matches) ? data.matches : [];

  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: {
      query: data.query,
      pageKey: data.pageKey,
      scopePath: data.scopePath,
      matchCount: data.matchCount ?? rawMatches.length,
      matches: rawMatches.map((match) => {
        if (!isRecord(match)) return match;
        // `text` is only present when the model explicitly opted in via includeText: true
        // (searchCodebase.ts default-omits it to save tokens at the source) — honor that
        // choice instead of silently discarding it again here.
        const text = typeof match.text === 'string'
          ? capTextPreview(match.text, SEARCH_MATCH_TEXT_PREVIEW_MAX_CHARS).text
          : undefined;
        return {
          path: match.path,
          line: match.line,
          ...(typeof match.pageKey === 'string' ? { pageKey: match.pageKey } : {}),
          ...(text !== undefined ? { text } : {}),
        };
      }),
    },
  };
};

/** Like capTextPreview but keeps the tail — for output where the useful part (e.g. a test failure summary) is at the end. */
const capTailTextPreview = (
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } => {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `[Output compacted — first ${text.length - maxChars} chars removed]\n…\n${text.slice(-maxChars)}`,
    truncated: true,
  };
};

const compactGitOutput = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  const data = isRecord(result.data) ? result.data : {};
  const rawOutput = typeof data.output === 'string' ? data.output : '';
  const outputPreview = capTextPreview(rawOutput, GIT_OUTPUT_PREVIEW_MAX_CHARS);

  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: {
      truncated: Boolean(data.truncated) || outputPreview.truncated,
      // Full diff/log/blame/status text — the model must actually see this to draft an
      // accurate commit message or confirm a diff, not just know that output exists.
      output: outputPreview.text,
    },
  };
};

const compactRunTests = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  const data = isRecord(result.data) ? result.data : {};
  const rawOutput = typeof data.output === 'string' ? data.output : '';
  // Vitest prints its pass/fail summary and failure stack traces last — keep the tail so a
  // failed run actually tells the model what broke, not just that something did.
  const outputPreview = capTailTextPreview(rawOutput, RUN_TESTS_OUTPUT_PREVIEW_MAX_CHARS);

  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: {
      suite: data.suite,
      testFiles: data.testFiles,
      exitCode: data.exitCode,
      truncated: Boolean(data.truncated) || outputPreview.truncated,
      output: outputPreview.text,
    },
  };
};

const compactFetchUrl = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  const data = isRecord(result.data) ? result.data : {};
  const rawBody = typeof data.body === 'string' ? data.body : '';
  const bodyPreview = capTextPreview(rawBody, READ_FILE_CONTENT_PREVIEW_MAX_CHARS);

  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: {
      url: data.url,
      status: data.status,
      contentType: data.contentType,
      format: data.format,
      truncated: Boolean(data.truncated) || bodyPreview.truncated,
      body: bodyPreview.text,
    },
  };
};

const compactScreenshotUrl = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  const data = isRecord(result.data) ? result.data : {};
  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: {
      url: data.url,
      finalUrl: data.finalUrl,
      mimeType: data.mimeType,
      byteLength: data.byteLength,
      fullPage: data.fullPage,
      width: data.width,
      height: data.height,
      imageOmitted: true,
    },
  };
};

const compactGeneric = (
  result: ToolResult,
  store: SessionToolObservationStore,
  meta: CompactMeta,
): CompactToolObservation => {
  if (result.data === undefined) {
    return {
      ok: result.ok,
      summary: result.summary,
      error: result.error,
    };
  }

  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    ref: store.store(result.data, storeMeta(meta)),
    dataPreview: capGenericDataPreview(result.data),
  };
};

/**
 * Build a token-efficient tool observation for LLM context; full payload lives in the store, and
 * — V5 Phase P09 §15 — durably as a `ToolOutputArtifact` when `toolCallId` is supplied and the
 * payload is large enough (`toolOutputArtifactStore.ts`), retrievable via `artifact_read_range`/
 * `artifact_tail`/`artifact_search`/`artifact_list_errors`.
 */
export const compactToolObservation = (
  toolName: string,
  result: ToolResult,
  store: SessionToolObservationStore,
  toolCallId?: string,
): CompactToolObservation => {
  // A failed call can still carry useful `data` (e.g. run_tests failure output with the
  // actual stack trace) — only take the lean path when there is genuinely nothing to compact.
  // Do not gate this on `result.ok`: that previously discarded failure data unconditionally,
  // which is exactly the case where the model needs the detail most (to self-correct).
  if (result.data === undefined) {
    return {
      ok: result.ok,
      summary: result.summary,
      error: result.error,
    };
  }

  const meta: CompactMeta = { toolName, toolCallId };

  switch (toolName) {
    case READ_FILE_TOOL_NAME:
      return compactReadFile(result, store, meta);
    case GET_PROJECT_STANDARDS_TOOL_NAME:
      return compactProjectStandards(result, store, meta);
    case SEARCH_CODEBASE_TOOL_NAME:
      return compactSearchCodebase(result, store, meta);
    case RUN_TESTS_TOOL_NAME:
      return compactRunTests(result, store, meta);
    case GIT_DIFF_TOOL_NAME:
    case GIT_SHOW_TOOL_NAME:
    case GIT_LOG_TOOL_NAME:
    case GIT_BLAME_TOOL_NAME:
    case GIT_STATUS_TOOL_NAME:
      return compactGitOutput(result, store, meta);
    case 'fetch_url':
      return compactFetchUrl(result, store, meta);
    case 'screenshot_url':
      return compactScreenshotUrl(result, store, meta);
    default:
      return compactGeneric(result, store, meta);
  }
};

export const serializeCompactToolObservation = (
  observation: CompactToolObservation,
): string => JSON.stringify(observation);
