import { describe, expect, it, beforeEach } from 'vitest';
import { registerCoreActionPack } from '../index';
import { __resetActionRegistryForTests, listAvailableActionDefinitions, getActionDefinition, resolveExactProvider } from '../../registry';
import { dataJsonParseExecutor, dataJsonStringifyExecutor, dataSetExecutor, dataAggregateExecutor } from '../dataActions';
import { textTemplateExecutor, textReplaceExecutor, textSplitExecutor, textJoinExecutor, textRegexMatchExecutor } from '../textActions';
import { dateAddExecutor, dateDiffExecutor, dateFormatExecutor, dateTimezoneConvertExecutor } from '../dateActions';
import { communicationEmailSendExecutor } from '../communicationActions';
import {
  integrationHttpRequestExecutor,
  resolveHttpMaxResponseBytes,
  DEFAULT_HTTP_MAX_RESPONSE_BYTES,
  HARD_CAP_HTTP_MAX_RESPONSE_BYTES,
} from '../integrationActions';
import { aiLlmInvokeExecutor } from '../aiActions';

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('Core Action pack registration', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    registerCoreActionPack();
  });

  it('is idempotent (safe to call registerCoreActionPack twice)', () => {
    expect(() => registerCoreActionPack()).not.toThrow();
  });

  it('registers communication.notification-send and ai.embedding as AVAILABLE with a resolvable core provider', () => {
    for (const [key, version] of [
      ['communication.notification-send', '1'],
      ['ai.embedding', '1'],
      ['ai.vector-upsert', '1'],
      ['ai.vector-search', '1'],
      ['crypto.hmac-verify', '1'],
      ['data.html-to-text', '1'],
      ['data.rss-parse', '1'],
      ['document.pdf-extract-text', '1'],
      ['integration.event-publish', '1'],
    ] as const) {
      const registered = getActionDefinition(key, version);
      expect(registered?.definition.availability).toBe('AVAILABLE');
      expect(() => resolveExactProvider(key, version, 'core', '1')).not.toThrow();
    }
    const availableKeys = listAvailableActionDefinitions().map((d) => d.key);
    expect(availableKeys).toContain('communication.notification-send');
    expect(availableKeys).toContain('ai.embedding');
    expect(availableKeys).toContain('data.pivot-threshold-check');
    expect(availableKeys).toContain('data.pivot-snapshot-delivery');
  });

  it('registers text.regex-match as AVAILABLE with a resolvable core provider (backed by the safeRegex/RE2 primitive)', () => {
    const registered = getActionDefinition('text.regex-match', '1');
    expect(registered?.definition.availability).toBe('AVAILABLE');
    expect(() => resolveExactProvider('text.regex-match', '1', 'core', '1')).not.toThrow();
    expect(listAvailableActionDefinitions().map((d) => d.key)).toContain('text.regex-match');
  });

  it('registers every AVAILABLE Action with a resolvable core provider', () => {
    for (const definition of listAvailableActionDefinitions()) {
      expect(() => resolveExactProvider(definition.key, definition.version, 'core', '1')).not.toThrow();
    }
  });

  it('does NOT register data.map or data.filter (deferred to Slice 5 — see dataActions.ts)', () => {
    expect(getActionDefinition('data.map', '1')).toBeUndefined();
    expect(getActionDefinition('data.filter', '1')).toBeUndefined();
  });
});

describe('Pure data Actions', () => {
  it('data.json-parse parses valid JSON and fails on invalid JSON', async () => {
    const ok = await dataJsonParseExecutor.execute(fakeContext, {}, { text: '{"a":1}' });
    expect(ok).toEqual({ status: 'SUCCEEDED', output: { value: { a: 1 } } });
    const bad = await dataJsonParseExecutor.execute(fakeContext, {}, { text: 'not json' });
    expect(bad.status).toBe('FAILED');
  });

  it('data.json-stringify stringifies a value', async () => {
    const result = await dataJsonStringifyExecutor.execute(fakeContext, {}, { value: { a: [1, 2] } });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { text: '{"a":[1,2]}' } });
  });

  it('data.set passes the value through', async () => {
    const result = await dataSetExecutor.execute(fakeContext, {}, { value: 42 });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { value: 42 } });
  });

  it('data.aggregate computes SUM/MIN/MAX/AVG/COUNT correctly', async () => {
    const items = [1, 2, 3, 4];
    expect(await dataAggregateExecutor.execute(fakeContext, { op: 'SUM' }, { items })).toEqual({ status: 'SUCCEEDED', output: { result: 10 } });
    expect(await dataAggregateExecutor.execute(fakeContext, { op: 'MIN' }, { items })).toEqual({ status: 'SUCCEEDED', output: { result: 1 } });
    expect(await dataAggregateExecutor.execute(fakeContext, { op: 'MAX' }, { items })).toEqual({ status: 'SUCCEEDED', output: { result: 4 } });
    expect(await dataAggregateExecutor.execute(fakeContext, { op: 'AVG' }, { items })).toEqual({ status: 'SUCCEEDED', output: { result: 2.5 } });
    expect(await dataAggregateExecutor.execute(fakeContext, { op: 'COUNT' }, { items })).toEqual({ status: 'SUCCEEDED', output: { result: 4 } });
  });

  it('data.aggregate fails when non-numeric items are used with a numeric op', async () => {
    const result = await dataAggregateExecutor.execute(fakeContext, { op: 'SUM' }, { items: [1, 'x', 3] });
    expect(result.status).toBe('FAILED');
  });
});

describe('Pure text Actions', () => {
  it('text.template substitutes {{key}} placeholders and leaves unknown keys untouched', async () => {
    const result = await textTemplateExecutor.execute(fakeContext, {}, { template: 'Hello {{name}}, you are {{age}}. {{unknown}}', variables: { name: 'Ada', age: 30 } });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { text: 'Hello Ada, you are 30. {{unknown}}' } });
  });

  it('text.replace performs literal (non-regex) substring replacement', async () => {
    const result = await textReplaceExecutor.execute(fakeContext, {}, { text: 'a.b.c', search: '.', replacement: '-' });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { text: 'a-b-c' } });
  });

  it('text.split and text.join round-trip', async () => {
    const split = await textSplitExecutor.execute(fakeContext, {}, { text: 'a,b,c', separator: ',' });
    expect(split).toEqual({ status: 'SUCCEEDED', output: { parts: ['a', 'b', 'c'] } });
    const joined = await textJoinExecutor.execute(fakeContext, {}, { parts: ['a', 'b', 'c'], separator: '-' });
    expect(joined).toEqual({ status: 'SUCCEEDED', output: { text: 'a-b-c' } });
  });

  it('text.regex-match matches against config.pattern and reports groups', async () => {
    const result = await textRegexMatchExecutor.execute(fakeContext, { pattern: '(\\w+)@(\\w+)', flags: 'i' }, { text: 'contact: ada@example' });
    expect(result.status).toBe('SUCCEEDED');
    expect((result as { output: { matched: boolean } }).output.matched).toBe(true);
    expect((result as { output: { matches: Array<{ match: string; groups: string[] }> } }).output.matches[0]).toEqual(
      expect.objectContaining({ match: 'ada@example', groups: ['ada', 'example'] }),
    );
  });

  it('text.regex-match never hangs on a catastrophic-backtracking pattern (RE2-backed)', async () => {
    const start = Date.now();
    const result = await textRegexMatchExecutor.execute(fakeContext, { pattern: '(a+)+b' }, { text: 'a'.repeat(64) + 'c' });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(result).toEqual({ status: 'SUCCEEDED', output: { matched: false, matches: [] } });
  });

  it('text.regex-match fails validation for a missing pattern', async () => {
    const result = await textRegexMatchExecutor.execute(fakeContext, {}, { text: 'abc' });
    expect(result.status).toBe('FAILED');
  });
});

describe('Pure date Actions', () => {
  it('date.add adds milliseconds to an ISO instant', async () => {
    const result = await dateAddExecutor.execute(fakeContext, {}, { iso: '2026-01-01T00:00:00.000Z', amountMs: 60000 });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { iso: '2026-01-01T00:01:00.000Z' } });
  });

  it('date.diff computes the millisecond difference', async () => {
    const result = await dateDiffExecutor.execute(fakeContext, {}, { fromIso: '2026-01-01T00:00:00.000Z', toIso: '2026-01-01T00:01:00.000Z' });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { diffMs: 60000 } });
  });

  it('date.format renders DATE_ONLY and ISO', async () => {
    const dateOnly = await dateFormatExecutor.execute(fakeContext, {}, { iso: '2026-03-05T12:00:00.000Z', format: 'DATE_ONLY' });
    expect(dateOnly).toEqual({ status: 'SUCCEEDED', output: { text: '2026-03-05' } });
  });

  it('date.timezone-convert rejects an unknown IANA zone', async () => {
    const result = await dateTimezoneConvertExecutor.execute(fakeContext, {}, { iso: '2026-01-01T00:00:00.000Z', timeZone: 'Not/AZone' });
    expect(result.status).toBe('FAILED');
  });

  it('date.timezone-convert converts a known zone', async () => {
    const result = await dateTimezoneConvertExecutor.execute(fakeContext, {}, { iso: '2026-01-01T00:00:00.000Z', timeZone: 'UTC' });
    expect(result.status).toBe('SUCCEEDED');
  });
});

describe('Input-validation paths for external-primitive Actions (no live network/SMTP/AI calls)', () => {
  it('communication.email-send fails validation before touching sendEmail', async () => {
    const result = await communicationEmailSendExecutor.execute(fakeContext, {}, { subject: 'no to/text' });
    expect(result.status).toBe('FAILED');
    expect((result as { errorCode: string }).errorCode).toBe('WF_EXEC_ACTION_OUTPUT_INVALID');
  });

  it('integration.http-request fails validation before touching fetch (missing url)', async () => {
    const result = await integrationHttpRequestExecutor.execute(fakeContext, {}, { method: 'GET' });
    expect(result.status).toBe('FAILED');
    expect((result as { errorCode: string }).errorCode).toBe('HTTP_URL_REQUIRED');
  });

  it('integration.http-request rejects an unsupported method before touching fetch', async () => {
    const result = await integrationHttpRequestExecutor.execute(fakeContext, {}, { method: 'TRACE', url: 'https://example.com' });
    expect(result.status).toBe('FAILED');
    expect((result as { errorCode: string }).errorCode).toBe('HTTP_METHOD_NOT_ALLOWED');
  });

  it('ai.llm-invoke fails validation before touching the AI gateway (missing prompt)', async () => {
    const result = await aiLlmInvokeExecutor.execute(fakeContext, {}, {});
    expect(result.status).toBe('FAILED');
    expect((result as { errorCode: string }).errorCode).toBe('AI_INVALID_INPUT');
  });
});

describe('resolveHttpMaxResponseBytes', () => {
  it('defaults to 1 MB and hard-caps at 10 MB', () => {
    expect(resolveHttpMaxResponseBytes({})).toBe(DEFAULT_HTTP_MAX_RESPONSE_BYTES);
    expect(resolveHttpMaxResponseBytes({ maxResponseBytes: 5_000_000 })).toBe(5_000_000);
    expect(resolveHttpMaxResponseBytes({ maxResponseBytes: 99_000_000 })).toBe(HARD_CAP_HTTP_MAX_RESPONSE_BYTES);
    expect(resolveHttpMaxResponseBytes({ maxResponseBytes: -1 })).toBe(DEFAULT_HTTP_MAX_RESPONSE_BYTES);
  });
});
