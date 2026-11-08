/**
 * Canvas collaboration comments (Phase 54 / gap #20).
 * Studio-only sidecar — not part of the published DesignerDocument.
 */

export type DesignerCanvasComment = {
  id: string;
  draftId: string;
  /** Node the pin anchors to; null = free-floating canvas comment. */
  nodeId: string | null;
  body: string;
  author: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type AddCanvasCommentInput = {
  nodeId?: string | null;
  body: string;
  author?: string;
  id?: string;
  createdAt?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const sanitizeDesignerCanvasComment = (
  value: unknown,
  fallbackDraftId?: string,
): DesignerCanvasComment | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : '';
  const draftId = typeof value.draftId === 'string' && value.draftId.trim()
    ? value.draftId.trim()
    : (fallbackDraftId?.trim() || '');
  const body = typeof value.body === 'string' ? value.body.trim() : '';
  const author = typeof value.author === 'string' && value.author.trim()
    ? value.author.trim()
    : 'unknown';
  const createdAt = typeof value.createdAt === 'string' && value.createdAt.trim()
    ? value.createdAt.trim()
    : '';

  if (!id || !draftId || !body || !createdAt) {
    return null;
  }

  const nodeId = typeof value.nodeId === 'string' && value.nodeId.trim()
    ? value.nodeId.trim()
    : null;

  const comment: DesignerCanvasComment = {
    id,
    draftId,
    nodeId,
    body,
    author,
    createdAt,
  };

  if (typeof value.resolvedAt === 'string' && value.resolvedAt.trim()) {
    comment.resolvedAt = value.resolvedAt.trim();
  }
  if (typeof value.resolvedBy === 'string' && value.resolvedBy.trim()) {
    comment.resolvedBy = value.resolvedBy.trim();
  }

  return comment;
};

export const sanitizeDesignerCanvasComments = (
  value: unknown,
  fallbackDraftId?: string,
): DesignerCanvasComment[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const comments: DesignerCanvasComment[] = [];
  for (const entry of value) {
    const comment = sanitizeDesignerCanvasComment(entry, fallbackDraftId);
    if (comment) {
      comments.push(comment);
    }
  }
  return comments;
};

export const createCanvasCommentId = (): string =>
  `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
