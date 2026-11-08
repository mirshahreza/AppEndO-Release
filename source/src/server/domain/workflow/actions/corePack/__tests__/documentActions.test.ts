import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { documentPdfGenerateExecutor, documentDocxGenerateExecutor } from '../documentActions';
import { ensureFileManagerWorkspaceDirectory, getFileManagerRepoRoot } from '../../../../../domain/file-manager/pathScope';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

describe('WFV2-11 document.pdf-generate / document.docx-generate', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-wfv2-document-actions-'));
    process.chdir(tmpDir);
    ensureFileManagerWorkspaceDirectory();
    fs.mkdirSync(path.join(getFileManagerRepoRoot(), 'workspace', 'workflow-docs'), { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a real PDF into the workspace file manager', async () => {
    const rel = `workspace/workflow-docs/pdf-${Date.now()}.pdf`;
    const result = await documentPdfGenerateExecutor.execute(
      fakeContext,
      { title: 'Test PDF' },
      { path: rel, heading: 'Hello', body: 'Line one.\n\nLine two with more text.' },
    );
    expect(result).toMatchObject({ status: 'SUCCEEDED' });
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    const outPath = path.join(getFileManagerRepoRoot(), (result.output as { path: string }).path);
    expect(fs.existsSync(outPath)).toBe(true);
    const bytes = fs.readFileSync(outPath);
    expect(bytes.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect((result.output as { sizeBytes: number }).sizeBytes).toBeGreaterThan(50);
  });

  it('writes a real DOCX into the workspace file manager', async () => {
    const rel = `workspace/workflow-docs/docx-${Date.now()}.docx`;
    const result = await documentDocxGenerateExecutor.execute(
      fakeContext,
      {},
      { path: rel, heading: 'Report', body: 'Paragraph A.\n\nParagraph B.' },
    );
    expect(result).toMatchObject({ status: 'SUCCEEDED' });
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    const outPath = path.join(getFileManagerRepoRoot(), (result.output as { path: string }).path);
    expect(fs.existsSync(outPath)).toBe(true);
    const bytes = fs.readFileSync(outPath);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('rejects non-.pdf paths for pdf-generate', async () => {
    const result = await documentPdfGenerateExecutor.execute(fakeContext, {}, { path: 'workspace/x.txt', body: 'hi' });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'DOCUMENT_PATH_INVALID' });
  });
});
