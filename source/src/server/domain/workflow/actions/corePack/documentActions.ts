import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { FileManagerService } from '../../../../services/file-manager.service';
import type { FileManagerScope } from '../../../../../shared/api/contracts/file-manager/types';
import type { ActionDefinition, ActionExecutor } from '../types';

/**
 * Document generation Actions (p-60 WFV2-11) — PDF via `pdf-lib`, DOCX via `docx`.
 * Binary output is persisted through FileManager `uploadFiles` (workspace scope by default).
 */

const DEFAULT_SCOPE: FileManagerScope = 'workspace';
const fileManager = new FileManagerService();

const inlineObjectSchema = (properties: Record<string, unknown>, required?: string[]) => ({
  type: 'INLINE' as const,
  schema: { type: 'object', properties, ...(required ? { required } : {}) },
});

export const documentPdfGenerateDefinition: ActionDefinition = {
  key: 'document.pdf-generate',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineObjectSchema({
    scope: { type: 'string', enum: ['workspace', 'project'], default: 'workspace', title: 'File manager scope' },
    title: { type: 'string', title: 'Document title (PDF metadata)' },
  }),
  inputSchema: inlineObjectSchema({
    path: { type: 'string', title: 'Output relative path (must end with .pdf)' },
    body: { type: 'string', title: 'Plain-text body (paragraphs separated by blank lines)' },
    heading: { type: 'string', title: 'Optional heading line' },
  }, ['path', 'body']),
  outputSchema: inlineObjectSchema({
    path: { type: 'string' },
    mimeType: { type: 'string' },
    sizeBytes: { type: 'number' },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['document.pdf'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['document', 'pdf', 'file'],
};

export const documentDocxGenerateDefinition: ActionDefinition = {
  key: 'document.docx-generate',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineObjectSchema({
    scope: { type: 'string', enum: ['workspace', 'project'], default: 'workspace', title: 'File manager scope' },
  }),
  inputSchema: inlineObjectSchema({
    path: { type: 'string', title: 'Output relative path (must end with .docx)' },
    body: { type: 'string', title: 'Plain-text body (paragraphs separated by blank lines)' },
    heading: { type: 'string', title: 'Optional heading' },
  }, ['path', 'body']),
  outputSchema: inlineObjectSchema({
    path: { type: 'string' },
    mimeType: { type: 'string' },
    sizeBytes: { type: 'number' },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['document.docx'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['document', 'docx', 'file'],
};

function resolveScope(config: unknown): FileManagerScope {
  const scope = (config as { scope?: unknown })?.scope;
  return scope === 'project' ? 'project' : DEFAULT_SCOPE;
}

function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

async function ensureParentFolders(parentPath: string, scope: FileManagerScope): Promise<
  | { ok: true }
  | { ok: false; errorCode: string; safeMessage: string }
> {
  if (!parentPath || parentPath === '.' || parentPath === '/') return { ok: true };
  const segments = parentPath.replace(/\\/g, '/').split('/').filter(Boolean);
  let walk = '';
  for (const segment of segments) {
    const parent = walk;
    walk = walk ? `${walk}/${segment}` : segment;
    const children = await fileManager.listChildren(parent, scope);
    if (!children.ok) {
      // Parent itself missing — continue; createFolder will fail clearly
    } else if (children.body.some((entry) => entry.name === segment && entry.kind === 'directory')) {
      continue;
    }
    const created = await fileManager.createFolder(parent, segment, scope);
    if (!created.ok && !created.error.toLowerCase().includes('already')) {
      // Some implementations return conflict for existing — tolerate by re-listing
      const again = await fileManager.listChildren(parent, scope);
      const exists = again.ok && again.body.some((entry) => entry.name === segment);
      if (!exists) {
        return { ok: false, errorCode: 'DOCUMENT_PARENT_CREATE_FAILED', safeMessage: created.error };
      }
    }
  }
  return { ok: true };
}

async function writeBinaryFile(relativePath: string, buffer: Buffer, scope: FileManagerScope): Promise<
  | { ok: true; path: string; sizeBytes: number }
  | { ok: false; errorCode: string; safeMessage: string }
> {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    return { ok: false, errorCode: 'DOCUMENT_PATH_INVALID', safeMessage: 'output path must be a safe relative path.' };
  }
  const parentPath = path.posix.dirname(normalized);
  const fileName = path.posix.basename(normalized);
  if (!fileName || fileName === '.' || fileName === '..') {
    return { ok: false, errorCode: 'DOCUMENT_PATH_INVALID', safeMessage: 'output path must include a file name.' };
  }

  const parent = parentPath === '.' ? '' : parentPath;
  const ensured = await ensureParentFolders(parent, scope);
  if (!ensured.ok) return ensured;

  // Overwrite: delete existing target if present, then upload
  const existingList = await fileManager.listChildren(parent, scope);
  if (existingList.ok && existingList.body.some((e) => e.name === fileName)) {
    const deleted = await fileManager.deleteEntry(normalized, scope);
    if (!deleted.ok) {
      return { ok: false, errorCode: 'DOCUMENT_WRITE_FAILED', safeMessage: deleted.error };
    }
  }

  const upload = await fileManager.uploadFiles(parent, [{ originalName: fileName, buffer }], scope);
  if (!upload.ok) {
    return { ok: false, errorCode: 'DOCUMENT_WRITE_FAILED', safeMessage: upload.error };
  }
  if (upload.body.uploaded.length === 0) {
    const reason = upload.body.skipped[0]?.reason ?? 'Upload skipped.';
    return { ok: false, errorCode: 'DOCUMENT_WRITE_FAILED', safeMessage: reason };
  }
  const entry = upload.body.uploaded[0];
  return { ok: true, path: entry.path, sizeBytes: entry.sizeBytes ?? buffer.length };
}

export const documentPdfGenerateExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const relativePath = (input as { path?: unknown })?.path;
    const body = (input as { body?: unknown })?.body;
    const heading = (input as { heading?: unknown })?.heading;
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      return { status: 'FAILED', errorCode: 'DOCUMENT_PATH_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.path is required.' };
    }
    if (typeof body !== 'string') {
      return { status: 'FAILED', errorCode: 'DOCUMENT_BODY_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.body is required.' };
    }
    if (!relativePath.toLowerCase().endsWith('.pdf')) {
      return { status: 'FAILED', errorCode: 'DOCUMENT_PATH_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.path must end with .pdf.' };
    }

    try {
      const pdf = await PDFDocument.create();
      const title = typeof (config as { title?: unknown })?.title === 'string'
        ? (config as { title: string }).title
        : (typeof heading === 'string' ? heading : 'Workflow Document');
      pdf.setTitle(title);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      let page = pdf.addPage();
      const { width, height } = page.getSize();
      const margin = 50;
      let y = height - margin;
      const lineHeight = 14;
      const maxWidth = width - margin * 2;

      const drawWrapped = (text: string, size: number, useBold: boolean) => {
        const activeFont = useBold ? bold : font;
        const words = text.split(/\s+/);
        let line = '';
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (activeFont.widthOfTextAtSize(candidate, size) > maxWidth && line) {
            if (y < margin + lineHeight) {
              page = pdf.addPage();
              y = height - margin;
            }
            page.drawText(line, { x: margin, y, size, font: activeFont, color: rgb(0.1, 0.1, 0.1) });
            y -= lineHeight;
            line = word;
          } else {
            line = candidate;
          }
        }
        if (line) {
          if (y < margin + lineHeight) {
            page = pdf.addPage();
            y = height - margin;
          }
          page.drawText(line, { x: margin, y, size, font: activeFont, color: rgb(0.1, 0.1, 0.1) });
          y -= lineHeight;
        }
      };

      if (typeof heading === 'string' && heading.trim()) {
        drawWrapped(heading.trim(), 18, true);
        y -= 8;
      }
      for (const paragraph of splitParagraphs(body)) {
        for (const line of paragraph.split('\n')) {
          drawWrapped(line, 11, false);
        }
        y -= 8;
      }

      const bytes = await pdf.save();
      const written = await writeBinaryFile(relativePath, Buffer.from(bytes), resolveScope(config));
      if (!written.ok) {
        return { status: 'FAILED', errorCode: written.errorCode, errorClass: 'VALIDATION', safeMessage: written.safeMessage };
      }
      return {
        status: 'SUCCEEDED',
        output: { path: written.path, mimeType: 'application/pdf', sizeBytes: written.sizeBytes },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        errorCode: 'DOCUMENT_PDF_GENERATE_FAILED',
        errorClass: 'TRANSIENT',
        safeMessage: error instanceof Error ? error.message : 'PDF generation failed.',
      };
    }
  },
};

export const documentDocxGenerateExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const relativePath = (input as { path?: unknown })?.path;
    const body = (input as { body?: unknown })?.body;
    const heading = (input as { heading?: unknown })?.heading;
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      return { status: 'FAILED', errorCode: 'DOCUMENT_PATH_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.path is required.' };
    }
    if (typeof body !== 'string') {
      return { status: 'FAILED', errorCode: 'DOCUMENT_BODY_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.body is required.' };
    }
    if (!relativePath.toLowerCase().endsWith('.docx')) {
      return { status: 'FAILED', errorCode: 'DOCUMENT_PATH_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.path must end with .docx.' };
    }

    try {
      const children: Paragraph[] = [];
      if (typeof heading === 'string' && heading.trim()) {
        children.push(new Paragraph({
          text: heading.trim(),
          heading: HeadingLevel.HEADING_1,
        }));
      }
      for (const paragraph of splitParagraphs(body)) {
        children.push(new Paragraph({
          children: [new TextRun(paragraph.replace(/\n/g, ' '))],
          spacing: { after: 200 },
        }));
      }
      if (children.length === 0) {
        children.push(new Paragraph({ children: [new TextRun('')] }));
      }

      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      const written = await writeBinaryFile(relativePath, Buffer.from(buffer), resolveScope(config));
      if (!written.ok) {
        return { status: 'FAILED', errorCode: written.errorCode, errorClass: 'VALIDATION', safeMessage: written.safeMessage };
      }
      return {
        status: 'SUCCEEDED',
        output: {
          path: written.path,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: written.sizeBytes,
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        errorCode: 'DOCUMENT_DOCX_GENERATE_FAILED',
        errorClass: 'TRANSIENT',
        safeMessage: error instanceof Error ? error.message : 'DOCX generation failed.',
      };
    }
  },
};

const inflatePdfContentStreams = (raw: string): string =>
  raw.replace(/stream\r?\n([\s\S]*?)\r?\nendstream/g, (_full, data: string) => {
    try {
      return inflateSync(Buffer.from(data, 'latin1')).toString('latin1');
    } catch {
      return data;
    }
  });

/** Best-effort text extraction from PDF content streams (literal and hex Tj/TJ, covering pdf-lib StandardFonts). */
export function extractPdfLatinText(buffer: Buffer): string {
  const raw = inflatePdfContentStreams(buffer.toString('latin1'));
  const chunks: string[] = [];
  const decodeLiteral = (inner: string): string => inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '\t')
    .replace(/\\(.)/g, '$1');
  const decodeHex = (hex: string): string => {
    const clean = hex.replace(/\s+/g, '');
    const bytes = Buffer.alloc(Math.floor(clean.length / 2));
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes.toString('latin1');
  };
  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match: RegExpExecArray | null = tj.exec(raw);
  while (match) {
    const inner = match[0].slice(1, match[0].lastIndexOf(')'));
    chunks.push(decodeLiteral(inner));
    match = tj.exec(raw);
  }
  const hexTj = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
  let hexMatch: RegExpExecArray | null = hexTj.exec(raw);
  while (hexMatch) {
    chunks.push(decodeHex(hexMatch[1]));
    hexMatch = hexTj.exec(raw);
  }
  const arrayTj = /\[(.*?)\]\s*TJ/gs;
  let arrayMatch = arrayTj.exec(raw);
  while (arrayMatch) {
    const literals = arrayMatch[1].match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    for (const lit of literals) {
      chunks.push(decodeLiteral(lit.slice(1, -1)));
    }
    const hexes = arrayMatch[1].match(/<([0-9A-Fa-f\s]+)>/g) ?? [];
    for (const hex of hexes) {
      chunks.push(decodeHex(hex.slice(1, -1)));
    }
    arrayMatch = arrayTj.exec(raw);
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

export const documentPdfExtractTextDefinition: ActionDefinition = {
  key: 'document.pdf-extract-text',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineObjectSchema({
    scope: { type: 'string', enum: ['workspace', 'project'], default: 'workspace', title: 'File manager scope' },
  }),
  inputSchema: inlineObjectSchema({
    path: { type: 'string', title: 'Relative PDF path (or omit and pass content)' },
    content: { type: 'string', title: 'Base64 PDF bytes (optional if path is set)' },
    encoding: { type: 'string', enum: ['base64', 'utf8'], default: 'base64' },
  }),
  outputSchema: inlineObjectSchema({
    text: { type: 'string' },
    length: { type: 'integer' },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['document.pdf'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['document', 'pdf', 'file'],
};

export const documentPdfExtractTextExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const rec = (input ?? {}) as { path?: unknown; content?: unknown; encoding?: unknown };
    let buffer: Buffer | null = null;
    if (typeof rec.content === 'string' && rec.content.length > 0) {
      try {
        buffer = Buffer.from(rec.content, rec.encoding === 'utf8' ? 'utf8' : 'base64');
      } catch {
        return { status: 'FAILED', errorCode: 'PDF_CONTENT_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.content could not be decoded.' };
      }
    } else if (typeof rec.path === 'string' && rec.path.length > 0) {
      const result = await fileManager.readContent(rec.path, resolveScope(config));
      if (!result.ok) {
        return { status: 'FAILED', errorCode: 'FILE_READ_FAILED', errorClass: 'VALIDATION', safeMessage: result.error };
      }
      const body = result.body;
      if (body.kind === 'directory') {
        return { status: 'FAILED', errorCode: 'FILE_IS_DIRECTORY', errorClass: 'VALIDATION', safeMessage: 'Cannot extract text from a directory.' };
      }
      buffer = Buffer.from(body.content ?? '', body.encoding === 'base64' ? 'base64' : 'utf8');
    }
    if (!buffer || buffer.length === 0) {
      return { status: 'FAILED', errorCode: 'PDF_SOURCE_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'Provide input.path or input.content.' };
    }
    const text = extractPdfLatinText(buffer);
    return { status: 'SUCCEEDED', output: { text, length: text.length } };
  },
};
