import path from 'node:path';
import { FileManagerService } from '../../../../services/file-manager.service';
import type { FileManagerScope } from '../../../../../shared/api/contracts/file-manager/types';
import type { ActionDefinition, ActionExecutor } from '../types';

/**
 * File Action pack (p-60 WFV2-5) — governed read/write against the platform's existing
 * `FileManagerService` primitive (`src/server/services/file-manager.service.ts`), scoped to the
 * `workspace` FileManagerScope by default (PO decision 2026-07-20: workflow data files live in the
 * governed workspace directory, not the raw project root).
 */

const DEFAULT_SCOPE: FileManagerScope = 'workspace';
const fileManager = new FileManagerService();

const inlineObjectSchema = (properties: Record<string, unknown>, required?: string[]) => ({
  type: 'INLINE' as const,
  schema: { type: 'object', properties, ...(required ? { required } : {}) },
});

export const fileReadDefinition: ActionDefinition = {
  key: 'file.read',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineObjectSchema({
    scope: { type: 'string', enum: ['workspace', 'project'], default: 'workspace', title: 'File manager scope' },
  }),
  inputSchema: inlineObjectSchema({
    path: { type: 'string', title: 'Relative path', description: 'Path relative to the selected File Manager scope root.' },
  }, ['path']),
  outputSchema: inlineObjectSchema({
    path: { type: 'string' },
    kind: { type: 'string', description: 'text | image | binary | directory | empty' },
    content: { type: 'string', description: 'UTF-8 text or base64-encoded binary content.' },
    encoding: { type: 'string', enum: ['utf8', 'base64'] },
    mimeType: { type: 'string' },
    sizeBytes: { type: 'number' },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['file.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['file', 'data'],
};

export const fileWriteDefinition: ActionDefinition = {
  key: 'file.write',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineObjectSchema({
    scope: { type: 'string', enum: ['workspace', 'project'], default: 'workspace', title: 'File manager scope' },
    createIfMissing: { type: 'boolean', default: true, title: 'Create if missing', description: 'When true, creates the file under an existing parent directory if it does not exist yet.' },
  }),
  inputSchema: inlineObjectSchema({
    path: { type: 'string', title: 'Relative path' },
    content: { type: 'string', title: 'File content (UTF-8 text)' },
  }, ['path', 'content']),
  outputSchema: inlineObjectSchema({
    path: { type: 'string' },
    written: { type: 'boolean' },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['file.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['file', 'data'],
};

function resolveScope(config: unknown): FileManagerScope {
  const scope = (config as { scope?: unknown })?.scope;
  return scope === 'project' ? 'project' : DEFAULT_SCOPE;
}

export const fileReadExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const relativePath = (input as { path?: unknown })?.path;
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      return { status: 'FAILED', errorCode: 'FILE_PATH_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.path is required.' };
    }
    const scope = resolveScope(config);
    const result = await fileManager.readContent(relativePath, scope);
    if (!result.ok) {
      return { status: 'FAILED', errorCode: 'FILE_READ_FAILED', errorClass: 'VALIDATION', safeMessage: result.error };
    }
    const body = result.body;
    if (body.kind === 'directory') {
      return { status: 'FAILED', errorCode: 'FILE_IS_DIRECTORY', errorClass: 'VALIDATION', safeMessage: 'Cannot read a directory as file content.' };
    }
    return {
      status: 'SUCCEEDED',
      output: {
        path: body.path,
        kind: body.kind,
        content: body.content ?? '',
        encoding: body.encoding ?? 'utf8',
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      },
    };
  },
};

async function writeWorkflowFile(relativePath: string, content: string, scope: FileManagerScope, createIfMissing: boolean) {
  const existing = await fileManager.writeContent(relativePath, content, scope);
  if (existing.ok) return existing;
  if (!createIfMissing || existing.status !== 404) return existing;

  const normalized = relativePath.replace(/\\/g, '/');
  const fileName = path.posix.basename(normalized);
  const parentPath = path.posix.dirname(normalized);
  if (!fileName || fileName === '.' || fileName === '..') {
    return { ok: false as const, status: 400, error: 'Invalid file path.' };
  }
  const created = await fileManager.createFile(parentPath === '.' ? '' : parentPath, fileName, scope);
  if (!created.ok) return created;
  return fileManager.writeContent(normalized, content, scope);
}

export const fileWriteExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const relativePath = (input as { path?: unknown })?.path;
    const content = (input as { content?: unknown })?.content;
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      return { status: 'FAILED', errorCode: 'FILE_PATH_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.path is required.' };
    }
    if (typeof content !== 'string') {
      return { status: 'FAILED', errorCode: 'FILE_CONTENT_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.content must be a string.' };
    }
    const scope = resolveScope(config);
    const createIfMissing = (config as { createIfMissing?: unknown })?.createIfMissing !== false;
    const result = await writeWorkflowFile(relativePath, content, scope, createIfMissing);
    if (!result.ok) {
      return { status: 'FAILED', errorCode: 'FILE_WRITE_FAILED', errorClass: 'VALIDATION', safeMessage: result.error };
    }
    return { status: 'SUCCEEDED', output: { path: result.body.path, written: true } };
  },
};
