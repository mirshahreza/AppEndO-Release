/**
 * Canvas comments sidecar store (Phase 54 / gap #20).
 * Persists under workspace/designer/comments/{draftId}.json
 */

import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import {
  createCanvasCommentId,
  sanitizeDesignerCanvasComment,
  sanitizeDesignerCanvasComments,
  type AddCanvasCommentInput,
  type DesignerCanvasComment,
} from '../../../domain/component-designer/canvasComments';
import { HttpError } from '../../errors/HttpError';
import { designerStoragePaths, ensureDesignerStoragePaths } from './storage';

export const designerCommentsPaths = {
  root: path.join(designerStoragePaths.root, 'comments'),
} as const;

type CommentsFile = {
  schema: 'designer-canvas-comments';
  schemaVersion: '1.0.0';
  draftId: string;
  updatedAt: string;
  comments: DesignerCanvasComment[];
};

const ensureCommentsStorage = (): void => {
  ensureDesignerStoragePaths();
  fs.mkdirSync(designerCommentsPaths.root, { recursive: true });
};

const sanitizeDraftIdForFile = (draftId: string): string =>
  draftId.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'draft';

export const draftCommentsPath = (draftId: string): string =>
  path.join(designerCommentsPaths.root, `${sanitizeDraftIdForFile(draftId)}.json`);

const emptyFile = (draftId: string): CommentsFile => ({
  schema: 'designer-canvas-comments',
  schemaVersion: '1.0.0',
  draftId,
  updatedAt: new Date().toISOString(),
  comments: [],
});

const readCommentsFile = (draftId: string): CommentsFile => {
  ensureCommentsStorage();
  const filePath = draftCommentsPath(draftId);
  if (!fs.existsSync(filePath)) {
    return emptyFile(draftId);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyFile(draftId);
    }
    const record = parsed as Record<string, unknown>;
    const comments = sanitizeDesignerCanvasComments(record.comments, draftId);
    return {
      schema: 'designer-canvas-comments',
      schemaVersion: '1.0.0',
      draftId,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
      comments,
    };
  } catch {
    return emptyFile(draftId);
  }
};

const writeCommentsFile = (file: CommentsFile): void => {
  ensureCommentsStorage();
  atomicWriteText(
    draftCommentsPath(file.draftId),
    JSON.stringify(file, null, 2),
    runtimeDirs.workspaceTemp,
  );
};

export const listDesignerCanvasComments = (draftId: string): DesignerCanvasComment[] =>
  readCommentsFile(draftId).comments;

export const addDesignerCanvasComment = (
  draftId: string,
  input: AddCanvasCommentInput,
  actor: string,
): DesignerCanvasComment => {
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) {
    throw new HttpError(400, 'Comment body is required.');
  }

  const now = new Date().toISOString();
  const comment: DesignerCanvasComment = {
    id: (typeof input.id === 'string' && input.id.trim()) || createCanvasCommentId(),
    draftId,
    nodeId: typeof input.nodeId === 'string' && input.nodeId.trim() ? input.nodeId.trim() : null,
    body,
    author: (typeof input.author === 'string' && input.author.trim()) || actor.trim() || 'unknown',
    createdAt: (typeof input.createdAt === 'string' && input.createdAt.trim()) || now,
  };

  const sanitized = sanitizeDesignerCanvasComment(comment, draftId);
  if (!sanitized) {
    throw new HttpError(400, 'Invalid comment payload.');
  }

  const file = readCommentsFile(draftId);
  file.comments = [...file.comments, sanitized];
  file.updatedAt = now;
  writeCommentsFile(file);
  return sanitized;
};

export const resolveDesignerCanvasComment = (
  draftId: string,
  commentId: string,
  actor: string,
): DesignerCanvasComment => {
  const file = readCommentsFile(draftId);
  const index = file.comments.findIndex((item) => item.id === commentId);
  if (index < 0) {
    throw new HttpError(404, 'Comment not found.');
  }
  const existing = file.comments[index]!;
  const now = new Date().toISOString();
  const updated: DesignerCanvasComment = {
    ...existing,
    resolvedAt: now,
    resolvedBy: actor.trim() || 'unknown',
  };
  file.comments = file.comments.map((item, i) => (i === index ? updated : item));
  file.updatedAt = now;
  writeCommentsFile(file);
  return updated;
};

export const replaceDesignerCanvasCommentsForTests = (
  draftId: string,
  comments: DesignerCanvasComment[],
): void => {
  writeCommentsFile({
    ...emptyFile(draftId),
    comments: sanitizeDesignerCanvasComments(comments, draftId),
    updatedAt: new Date().toISOString(),
  });
};
