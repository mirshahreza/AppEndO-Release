import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { dataValidateExecutor, dataCsvParseExecutor, dataCsvStringifyExecutor, dataMapRecordsExecutor } from '../dataActions';
import { cryptoHashExecutor, cryptoHmacExecutor, cryptoHmacVerifyExecutor } from '../cryptoActions';
import { fileReadExecutor, fileWriteExecutor } from '../fileActions';
import { communicationWebhookNotifyExecutor } from '../communicationActions';
import { ensureFileManagerWorkspaceDirectory, getFileManagerRepoRoot } from '../../../../../domain/file-manager/pathScope';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** New corePack Actions from the p-62 second implementation pass (WFV2-8/9 + CSV). */

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

describe('data.validate (WFV2-8)', () => {
  it('SUCCEEDS with valid:true for a value matching the schema', async () => {
    const result = await dataValidateExecutor.execute(fakeContext, { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } } }, { value: { amount: 42 } });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { valid: true, errors: [] } });
  });

  it('SUCCEEDS with valid:false and a real Ajv error message for a value that violates the schema', async () => {
    const result = await dataValidateExecutor.execute(fakeContext, { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } } }, { value: { amount: 'not-a-number' } });
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toMatchObject({ valid: false });
    expect((result.output as { errors: string[] }).errors.length).toBeGreaterThan(0);
  });

  it('FAILS the Action (not just invalid data) when the schema itself does not compile', async () => {
    const result = await dataValidateExecutor.execute(fakeContext, { schema: { type: 'not-a-real-type' } }, { value: {} });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'DATA_VALIDATE_SCHEMA_INVALID' });
  });

  it('FAILS when no schema is supplied at all', async () => {
    const result = await dataValidateExecutor.execute(fakeContext, {}, { value: {} });
    expect(result.status).toBe('FAILED');
  });
});

describe('crypto.hash / crypto.hmac (WFV2-9)', () => {
  it('hashes deterministically with sha256 by default (hex)', async () => {
    const result = await cryptoHashExecutor.execute(fakeContext, {}, { data: 'hello' });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { algorithm: 'sha256', digest: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' } });
  });

  it('rejects an unsupported algorithm', async () => {
    const result = await cryptoHashExecutor.execute(fakeContext, {}, { data: 'hello', algorithm: 'not-a-real-algo' });
    expect(result.status).toBe('FAILED');
  });

  it('hmac produces a different digest for a different key (real keyed hash, not a plain hash)', async () => {
    const a = await cryptoHmacExecutor.execute(fakeContext, {}, { data: 'payload', key: 'key-a' });
    const b = await cryptoHmacExecutor.execute(fakeContext, {}, { data: 'payload', key: 'key-b' });
    expect(a.status).toBe('SUCCEEDED');
    expect(b.status).toBe('SUCCEEDED');
    if (a.status !== 'SUCCEEDED' || b.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect((a.output as { digest: string }).digest).not.toBe((b.output as { digest: string }).digest);
  });

  it('hmac rejects a missing key', async () => {
    const result = await cryptoHmacExecutor.execute(fakeContext, {}, { data: 'payload' });
    expect(result.status).toBe('FAILED');
  });

  it('hmac-verify returns valid:true for a matching digest and valid:false otherwise', async () => {
    const signed = await cryptoHmacExecutor.execute(fakeContext, {}, { data: 'payload', key: 'secret', algorithm: 'sha256', encoding: 'hex' });
    expect(signed.status).toBe('SUCCEEDED');
    if (signed.status !== 'SUCCEEDED') throw new Error('unreachable');
    const digest = (signed.output as { digest: string }).digest;
    const ok = await cryptoHmacVerifyExecutor.execute(fakeContext, {}, { data: 'payload', key: 'secret', digest, algorithm: 'sha256', encoding: 'hex' });
    expect(ok).toMatchObject({ status: 'SUCCEEDED', output: { valid: true } });
    const bad = await cryptoHmacVerifyExecutor.execute(fakeContext, {}, { data: 'payload', key: 'wrong', digest, algorithm: 'sha256', encoding: 'hex' });
    expect(bad).toMatchObject({ status: 'SUCCEEDED', output: { valid: false } });
  });
});

describe('data.csv-parse / data.csv-stringify (WFV2-5 partial — no filesystem access)', () => {
  it('parses a quoted CSV with embedded commas and doubled quotes into records', async () => {
    const csv = 'name,note\r\n"Doe, John","He said ""hi"""\r\nJane,plain\r\n';
    const result = await dataCsvParseExecutor.execute(fakeContext, {}, { text: csv });
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toMatchObject({
      records: [
        { name: 'Doe, John', note: 'He said "hi"' },
        { name: 'Jane', note: 'plain' },
      ],
    });
  });

  it('hasHeader:false returns raw rows only', async () => {
    const result = await dataCsvParseExecutor.execute(fakeContext, { hasHeader: false }, { text: 'a,b\nc,d' });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { rows: [['a', 'b'], ['c', 'd']], records: null } });
  });

  it('stringify from records quotes fields that contain the delimiter, then csv-parse round-trips it back', async () => {
    const stringified = await dataCsvStringifyExecutor.execute(fakeContext, {}, { records: [{ city: 'New York, NY', zip: '10001' }] });
    expect(stringified.status).toBe('SUCCEEDED');
    if (stringified.status !== 'SUCCEEDED') throw new Error('unreachable');
    const text = (stringified.output as { text: string }).text;
    expect(text).toContain('"New York, NY"');

    const reparsed = await dataCsvParseExecutor.execute(fakeContext, {}, { text });
    expect(reparsed).toMatchObject({ status: 'SUCCEEDED', output: { records: [{ city: 'New York, NY', zip: '10001' }] } });
  });

  it('csv-stringify rejects malformed input.rows', async () => {
    const result = await dataCsvStringifyExecutor.execute(fakeContext, {}, { rows: [[1, 2]] });
    expect(result.status).toBe('FAILED');
  });
});

describe('data.map-records', () => {
  it('renames fields, applies defaults, and coerces number fields', async () => {
    const result = await dataMapRecordsExecutor.execute(
      fakeContext,
      {
        fieldMap: { sku: 'ProductCode', price: 'Amount' },
        defaults: { statusCode: 'active' },
        numberFields: ['price'],
      },
      { records: [{ ProductCode: 'A-1', Amount: '12.5', extra: 'drop-me' }] },
    );
    expect(result).toEqual({
      status: 'SUCCEEDED',
      output: {
        count: 1,
        records: [{ sku: 'A-1', price: 12.5, statusCode: 'active' }],
      },
    });
  });

  it('keepUnmapped copies leftover source fields', async () => {
    const result = await dataMapRecordsExecutor.execute(
      fakeContext,
      { fieldMap: { sku: 'code' }, keepUnmapped: true },
      { records: [{ code: 'X', note: 'keep' }] },
    );
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      output: { records: [{ code: 'X', note: 'keep', sku: 'X' }] },
    });
  });

  it('fails when neither fieldMap, defaults, nor keepUnmapped is set', async () => {
    const result = await dataMapRecordsExecutor.execute(fakeContext, {}, { records: [{ a: 1 }] });
    expect(result.status).toBe('FAILED');
  });
});

describe('file.read / file.write (WFV2-5)', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-wfv2-file-actions-'));
    process.chdir(tmpDir);
    ensureFileManagerWorkspaceDirectory();
    fs.mkdirSync(path.join(getFileManagerRepoRoot(), 'workspace', 'wf-data'), { recursive: true });
    fs.writeFileSync(path.join(getFileManagerRepoRoot(), 'workspace', 'wf-data', 'note.txt'), 'hello workflow', 'utf8');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads a text file from the workspace scope', async () => {
    const result = await fileReadExecutor.execute(fakeContext, {}, { path: 'workspace/wf-data/note.txt' });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { path: 'workspace/wf-data/note.txt', content: 'hello workflow', encoding: 'utf8' } });
  });

  it('writes text content, creating the file when missing', async () => {
    const targetPath = 'workspace/wf-data/new.txt';
    const result = await fileWriteExecutor.execute(fakeContext, { createIfMissing: true }, { path: targetPath, content: 'created by workflow' });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { path: targetPath, written: true } });
    const readBack = await fileReadExecutor.execute(fakeContext, {}, { path: targetPath });
    expect(readBack).toMatchObject({ status: 'SUCCEEDED', output: { content: 'created by workflow' } });
  });
});

describe('communication.webhook-notify (WFV2-7)', () => {
  it('fails validation before fetch when url is missing', async () => {
    const result = await communicationWebhookNotifyExecutor.execute(fakeContext, {}, { payload: { ok: true } });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'WEBHOOK_URL_REQUIRED' });
  });
});

describe('data.html-to-text / data.rss-parse / document.pdf-extract-text', () => {
  it('strips tags and scripts from HTML', async () => {
    const { dataHtmlToTextExecutor } = await import('../extractActions');
    const result = await dataHtmlToTextExecutor.execute(fakeContext, {}, { html: '<html><script>x()</script><p>Hello&nbsp;<b>world</b></p></html>' });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { text: 'Hello world' } });
  });

  it('parses RSS item titles and links', async () => {
    const { dataRssParseExecutor } = await import('../extractActions');
    const xml = `<?xml version="1.0"?><rss><channel><item><title>One</title><link>https://example.com/1</link><description>Hi</description></item></channel></rss>`;
    const result = await dataRssParseExecutor.execute(fakeContext, {}, { xml });
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toMatchObject({ count: 1, items: [{ title: 'One', link: 'https://example.com/1', description: 'Hi' }] });
  });

  it('extracts Latin text from a pdf-lib generated PDF', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const { documentPdfExtractTextExecutor } = await import('../documentActions');
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Hello workflow', { x: 20, y: 100, size: 12, font });
    const bytes = await doc.save();
    const result = await documentPdfExtractTextExecutor.execute(fakeContext, {}, { content: Buffer.from(bytes).toString('base64') });
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect((result.output as { text: string }).text).toContain('Hello workflow');
  });
});
