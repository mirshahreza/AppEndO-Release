import { describe, expect, it } from 'vitest';
import {
  compactToolObservation,
  GENERIC_DATA_PREVIEW_MAX_CHARS,
  GIT_OUTPUT_PREVIEW_MAX_CHARS,
  READ_FILE_CONTENT_PREVIEW_MAX_CHARS,
  RUN_TESTS_OUTPUT_PREVIEW_MAX_CHARS,
  SEARCH_MATCH_TEXT_PREVIEW_MAX_CHARS,
  SessionToolObservationStore,
  STANDARDS_SHARD_PREVIEW_MAX_CHARS,
  STANDARDS_QUERY_MAX_RULE_IDS,
} from '../toolObservationCompact';
import { GET_PROJECT_STANDARDS_TOOL_NAME } from '../../tools/native/getProjectStandards';
import { READ_FILE_TOOL_NAME } from '../../tools/native/readFile';
import { SEARCH_CODEBASE_TOOL_NAME } from '../../tools/native/searchCodebase';
import { RUN_TESTS_TOOL_NAME } from '../../tools/native/runTests';
import { GIT_DIFF_TOOL_NAME } from '../../tools/native/git/gitTools';

describe('SessionToolObservationStore', () => {
  it('stores full payload and returns stable ref', () => {
    const store = new SessionToolObservationStore();
    const ref = store.store({ content: 'full body' });
    // V5 P09 §15 — ref format widened from an 8-hex sequence hash to a 12-hex randomUUID slice
    // for real cross-run global uniqueness now that large observations are also disk-persisted.
    expect(ref).toMatch(/^obs:[a-f0-9]{12}$/);
    expect(store.get(ref)).toEqual({ content: 'full body' });
    expect(store.size()).toBe(1);
  });

  it('V5 P09 §15 — with toolCallId meta, a large payload is ALSO durably persisted under the same ref (end-to-end wiring, not just the in-memory store)', async () => {
    const { loadToolOutputArtifact } = await import('../toolOutputArtifactStore');
    const store = new SessionToolObservationStore();
    const bigContent = 'x'.repeat(5_000);

    const ref = store.store({ content: bigContent }, { toolCallId: 'call-e2e', toolName: 'read_file' });

    expect(store.get(ref)).toEqual({ content: bigContent });
    const artifact = loadToolOutputArtifact(ref);
    expect(artifact).toBeDefined();
    expect(artifact!.meta.toolCallId).toBe('call-e2e');
    expect(JSON.parse(artifact!.content).content).toBe(bigContent);
  });

  it('without meta (pre-existing callers), no durable artifact is created — only the in-memory ref', async () => {
    const { loadToolOutputArtifact } = await import('../toolOutputArtifactStore');
    const store = new SessionToolObservationStore();
    const bigContent = 'y'.repeat(5_000);

    const ref = store.store({ content: bigContent });

    expect(store.get(ref)).toEqual({ content: bigContent });
    expect(loadToolOutputArtifact(ref)).toBeUndefined();
  });
});

describe('compactToolObservation', () => {
  it('keeps read_file content in the LLM preview when under the cap', () => {
    const store = new SessionToolObservationStore();
    // Short enough to stay under READ_FILE_CONTENT_PREVIEW_MAX_CHARS.
    const fullContent = Array.from({ length: 20 }, (_, index) => `${index + 1}|line ${index}`).join('\n');

    const compact = compactToolObservation(READ_FILE_TOOL_NAME, {
      ok: true,
      summary: 'Read 20 line(s) from src/foo.ts (200 total).',
      data: {
        path: 'src/foo.ts',
        startLine: 1,
        endLine: 20,
        totalLines: 200,
        truncated: false,
        content: fullContent,
      },
    }, store);

    // The model must actually see the code it asked to read — this was previously
    // dropped entirely, leaving only line-count metadata (agent could never use
    // read_file to inform a code draft).
    expect(compact.dataPreview).toEqual({
      path: 'src/foo.ts',
      startLine: 1,
      endLine: 20,
      totalLines: 200,
      lineCount: 20,
      truncated: false,
      content: fullContent,
    });
    expect(compact.ref).toBeTruthy();
    expect(store.get(compact.ref!)).toMatchObject({ content: fullContent });
  });

  it('truncates (not drops) read_file content beyond the preview cap, with a visible banner', () => {
    const store = new SessionToolObservationStore();
    const hugeContent = Array.from(
      { length: 2_000 },
      (_, index) => `${index + 1}|const line${index} = ${index};`,
    ).join('\n');
    expect(hugeContent.length).toBeGreaterThan(READ_FILE_CONTENT_PREVIEW_MAX_CHARS);

    const compact = compactToolObservation(READ_FILE_TOOL_NAME, {
      ok: true,
      summary: 'Read 2000 line(s) from src/big.ts (2000 total).',
      data: {
        path: 'src/big.ts',
        startLine: 1,
        endLine: 2000,
        totalLines: 2000,
        truncated: false,
        content: hugeContent,
      },
    }, store);

    const preview = compact.dataPreview as { content: string; truncated: boolean };
    expect(preview.content.length).toBeLessThan(hugeContent.length);
    expect(preview.content).toContain('Output compacted');
    expect(preview.truncated).toBe(true);
    // Full content is still retrievable by ref even though the LLM-facing copy is capped.
    expect(store.get(compact.ref!)).toMatchObject({ content: hugeContent });
  });

  it('keeps a real-sized shard (e.g. vibe-operator-playbook, ~7KB) intact under the cap', () => {
    const store = new SessionToolObservationStore();
    // Real shards the system prompt tells the model to load first are ~7,000 chars —
    // this used to be hard-truncated to 500 chars (under 10% of the doc), silently.
    const realisticShardContent = `${'| rule | value |\n'.repeat(300)}- bullet rule\n`;
    expect(realisticShardContent.length).toBeLessThan(STANDARDS_SHARD_PREVIEW_MAX_CHARS);

    const compact = compactToolObservation(GET_PROJECT_STANDARDS_TOOL_NAME, {
      ok: true,
      summary: 'Loaded standards shard.',
      data: {
        shard: 'vibe-operator-playbook',
        path: 'docs/standards/vibe-operator-playbook.md',
        content: realisticShardContent,
      },
    }, store);

    const preview = compact.dataPreview as { preview: string; ruleCount: number; truncated: boolean };
    expect(preview.preview).toBe(realisticShardContent);
    expect(preview.truncated).toBe(false);
    expect(preview.ruleCount).toBeGreaterThan(0);
  });

  it('truncates (with a banner) a shard that exceeds the preview cap', () => {
    const store = new SessionToolObservationStore();
    const longContent = `${'| rule | value |\n'.repeat(2_000)}- bullet rule\n`;
    expect(longContent.length).toBeGreaterThan(STANDARDS_SHARD_PREVIEW_MAX_CHARS);

    const compact = compactToolObservation(GET_PROJECT_STANDARDS_TOOL_NAME, {
      ok: true,
      summary: 'Loaded standards shard.',
      data: {
        shard: 'ui-grid',
        path: 'docs/standards/ui-grid.md',
        content: longContent,
      },
    }, store);

    const preview = compact.dataPreview as { preview: string; ruleCount: number; truncated: boolean };
    expect(preview.preview.length).toBeLessThan(longContent.length);
    expect(preview.preview).toContain('Output compacted');
    expect(preview.truncated).toBe(true);
    expect(preview.ruleCount).toBeGreaterThan(0);
    expect((store.get(compact.ref!) as { content: string }).content).toBe(longContent);
  });

  it('returns rule ids only for get_project_standards query mode', () => {
    const store = new SessionToolObservationStore();
    const standards = Array.from({ length: 25 }, (_, index) => ({
      id: `rule-${index}`,
      title: `Rule ${index}`,
      value: `Value ${index}`,
      appliesTo: ['grid'],
    }));

    const compact = compactToolObservation(GET_PROJECT_STANDARDS_TOOL_NAME, {
      ok: true,
      summary: 'Found 25 project standard(s).',
      data: { standards },
    }, store);

    const preview = compact.dataPreview as { matchCount: number; ids: string[] };
    expect(preview.matchCount).toBe(25);
    expect(preview.ids).toHaveLength(STANDARDS_QUERY_MAX_RULE_IDS);
    expect(preview.ids[0]).toBe('rule-0');
    expect(preview.ids).not.toContain('rule-24');
  });

  it('keeps search_codebase match text when the caller opted in via includeText', () => {
    const store = new SessionToolObservationStore();
    const compact = compactToolObservation(SEARCH_CODEBASE_TOOL_NAME, {
      ok: true,
      summary: 'Found 2 match(es).',
      data: {
        query: 'AppTableGrid',
        matchCount: 2,
        matches: [
          { path: 'src/a.ts', line: 10, column: 1, text: 'export const AppTableGrid = () => {}' },
          { path: 'src/b.ts', line: 42, column: 1, text: 'import { AppTableGrid } from "./a"' },
        ],
      },
    }, store);

    // searchCodebase.ts already omits `text` by default (includeText: false) — the
    // compaction layer must not discard it a second time when the model deliberately
    // asked for it, or includeText: true becomes a no-op.
    const preview = compact.dataPreview as { matches: Array<{ path: string; line: number; pageKey?: string; text?: string }> };
    expect(preview.matches).toEqual([
      { path: 'src/a.ts', line: 10, text: 'export const AppTableGrid = () => {}' },
      { path: 'src/b.ts', line: 42, text: 'import { AppTableGrid } from "./a"' },
    ]);
  });

  it('truncates an individual search_codebase match text beyond the per-match cap', () => {
    const store = new SessionToolObservationStore();
    const longText = 'x'.repeat(SEARCH_MATCH_TEXT_PREVIEW_MAX_CHARS + 200);

    const compact = compactToolObservation(SEARCH_CODEBASE_TOOL_NAME, {
      ok: true,
      summary: 'Found 1 match(es).',
      data: {
        query: 'x',
        matchCount: 1,
        matches: [{ path: 'src/a.ts', line: 10, text: longText }],
      },
    }, store);

    const preview = compact.dataPreview as { matches: Array<{ text?: string }> };
    expect(preview.matches[0]?.text?.length).toBeLessThan(longText.length);
    expect(preview.matches[0]?.text).toContain('Output compacted');
  });

  it('keeps get_server_function contract intact even when source pushes the payload past the generic cap', () => {
    const store = new SessionToolObservationStore();
    const bigSource = 'x'.repeat(GENERIC_DATA_PREVIEW_MAX_CHARS + 5_000);

    const compact = compactToolObservation('get_server_function', {
      ok: true,
      summary: 'Loaded server function "Sample" (POST /api/scheduler/sample-heartbeat).',
      data: {
        id: 'scheduler.sample-heartbeat',
        source: bigSource,
        contract: {
          requestExample: {},
          validationFields: [],
          outputFields: [],
          queryFields: [],
          paramFields: [],
          hasNoDetectedFields: true,
        },
      },
    }, store);

    // The generic compactor would otherwise raw-string-slice the serialized JSON at 2048
    // chars and could cut `contract` off entirely (or garble it) depending on field order —
    // it must be preserved as a real object, not a truncated string fragment.
    const preview = compact.dataPreview as { contract?: { hasNoDetectedFields?: boolean }; source: string };
    expect(preview.contract).toEqual({
      requestExample: {},
      validationFields: [],
      outputFields: [],
      queryFields: [],
      paramFields: [],
      hasNoDetectedFields: true,
    });
    expect(preview.source).toBe(bigSource);
  });

  it('caps generic tool data preview at 2KB JSON', () => {
    const store = new SessionToolObservationStore();
    const hugePayload = { blob: 'x'.repeat(GENERIC_DATA_PREVIEW_MAX_CHARS + 500) };

    const compact = compactToolObservation('list_dir', {
      ok: true,
      summary: 'Listed directory.',
      data: hugePayload,
    }, store);

    const preview = compact.dataPreview as { truncated: boolean; originalChars: number };
    expect(preview.truncated).toBe(true);
    expect(preview.originalChars).toBeGreaterThan(GENERIC_DATA_PREVIEW_MAX_CHARS);
    expect(store.get(compact.ref!)).toEqual(hugePayload);
  });

  it('passes through failed results without store ref when there is no data to compact', () => {
    const store = new SessionToolObservationStore();
    const compact = compactToolObservation(READ_FILE_TOOL_NAME, {
      ok: false,
      summary: 'File not found.',
      error: 'not_found',
    }, store);

    expect(compact).toEqual({
      ok: false,
      summary: 'File not found.',
      error: 'not_found',
    });
    expect(store.size()).toBe(0);
  });

  it('keeps git_diff output intact when under the cap', () => {
    const store = new SessionToolObservationStore();
    const diffOutput = 'diff --git a/foo.ts b/foo.ts\n+added line\n-removed line\n';

    const compact = compactToolObservation(GIT_DIFF_TOOL_NAME, {
      ok: true,
      summary: 'git diff completed.',
      data: { output: diffOutput, truncated: false },
    }, store);

    const preview = compact.dataPreview as { output: string; truncated: boolean };
    expect(preview.output).toBe(diffOutput);
    expect(preview.truncated).toBe(false);
  });

  it('truncates (with a banner) a git_diff output beyond the cap instead of raw-string-slicing the JSON', () => {
    const store = new SessionToolObservationStore();
    const hugeDiff = Array.from(
      { length: 2_000 },
      (_, index) => `+line ${index} changed`,
    ).join('\n');
    expect(hugeDiff.length).toBeGreaterThan(GIT_OUTPUT_PREVIEW_MAX_CHARS);

    const compact = compactToolObservation(GIT_DIFF_TOOL_NAME, {
      ok: true,
      summary: 'git diff completed.',
      data: { output: hugeDiff, truncated: false },
    }, store);

    const preview = compact.dataPreview as { output: string; truncated: boolean };
    expect(preview.output.length).toBeLessThan(hugeDiff.length);
    expect(preview.output).toContain('Output compacted');
    expect(preview.truncated).toBe(true);
    expect(store.get(compact.ref!)).toMatchObject({ output: hugeDiff });
  });

  it('preserves run_tests failure output — a failed tool call must not silently discard its data', () => {
    const store = new SessionToolObservationStore();
    const failureOutput = 'FAIL src/foo.test.ts\nAssertionError: expected 1 to be 2';

    const compact = compactToolObservation(RUN_TESTS_TOOL_NAME, {
      ok: false,
      summary: 'test:critical failed (exit 1).',
      error: 'tests_failed',
      data: {
        suite: 'critical',
        exitCode: 1,
        truncated: false,
        output: failureOutput,
      },
    }, store);

    // Previously the top-level `!result.ok` check discarded `data` unconditionally here —
    // the model would see "tests failed" with zero information about what actually broke.
    expect(compact.ok).toBe(false);
    expect(compact.error).toBe('tests_failed');
    const preview = compact.dataPreview as { output: string; exitCode: number };
    expect(preview.output).toBe(failureOutput);
    expect(preview.exitCode).toBe(1);
  });

  it('keeps the tail (not the head) of a large run_tests output, since Vitest prints the failure summary last', () => {
    const store = new SessionToolObservationStore();
    const noise = 'x'.repeat(RUN_TESTS_OUTPUT_PREVIEW_MAX_CHARS + 2_000);
    const failureOutput = `${noise}\nFAIL src/foo.test.ts — the actual failure reason`;

    const compact = compactToolObservation(RUN_TESTS_TOOL_NAME, {
      ok: false,
      summary: 'test:critical failed (exit 1).',
      error: 'tests_failed',
      data: { suite: 'critical', exitCode: 1, truncated: false, output: failureOutput },
    }, store);

    const preview = compact.dataPreview as { output: string };
    expect(preview.output).toContain('the actual failure reason');
    expect(preview.output).not.toContain(noise);
    expect(preview.output.length).toBeLessThan(failureOutput.length);
  });

  it('omits screenshot_url image bytes from the LLM preview', () => {
    const store = new SessionToolObservationStore();
    const imageBase64 = Buffer.from('fake-jpeg').toString('base64');
    const compact = compactToolObservation('screenshot_url', {
      ok: true,
      summary: 'Screenshot of example.com (1280×720, 9 bytes JPEG).',
      data: {
        url: 'https://example.com/page',
        finalUrl: 'https://example.com/page',
        mimeType: 'image/jpeg',
        byteLength: 9,
        fullPage: false,
        width: 1280,
        height: 720,
        imageBase64,
      },
    }, store);

    const preview = compact.dataPreview as { imageOmitted?: boolean; imageBase64?: string; byteLength?: number };
    expect(preview.imageOmitted).toBe(true);
    expect(preview.imageBase64).toBeUndefined();
    expect(preview.byteLength).toBe(9);
    expect(store.get(compact.ref!)).toEqual(expect.objectContaining({ imageBase64 }));
  });

  it('keeps fetch_url page body in the LLM preview', () => {
    const store = new SessionToolObservationStore();
    const compact = compactToolObservation('fetch_url', {
      ok: true,
      summary: 'Fetched example.com as markdown.',
      data: {
        url: 'https://example.com/page',
        status: 200,
        contentType: 'text/html',
        format: 'markdown',
        truncated: false,
        body: '# Hello\n\nWorld',
      },
    }, store);

    const preview = compact.dataPreview as { body?: string; format?: string };
    expect(preview.format).toBe('markdown');
    expect(preview.body).toContain('# Hello');
  });
});
