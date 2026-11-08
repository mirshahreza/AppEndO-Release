import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';
import type { PlatformFeedbackPolicy } from '../../../shared/api/contracts/feedback/types';

const FEEDBACK_ATTACHMENTS_DIR = runtimeDirs.feedbackAttachments;

export class FeedbackAttachmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FeedbackAttachmentError';
  }
}

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 200) || 'attachment';

export type StageAttachmentInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: number | null;
  stagedSessionKey: string;
  policy: PlatformFeedbackPolicy;
};

export const stageFeedbackAttachments = async (
  files: StageAttachmentInput[],
): Promise<Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }>> => {
  if (!files.length) return [];
  const policy = files[0]?.policy;
  if (!policy?.allowAttachments) {
    throw new FeedbackAttachmentError('FEEDBACK_ATTACHMENTS_DISABLED', 'File attachments are disabled.');
  }
  if (files.length > policy.maxAttachmentsPerMessage) {
    throw new FeedbackAttachmentError('FEEDBACK_TOO_MANY_ATTACHMENTS', 'Too many attachments.');
  }

  const prisma = getPrismaControlPlane();
  const created = [];

  for (const file of files) {
    if (!policy.allowedAttachmentMimeTypes.includes(file.mimeType)) {
      throw new FeedbackAttachmentError('FEEDBACK_ATTACHMENT_TYPE', 'Attachment type is not allowed.');
    }
    if (file.buffer.byteLength > policy.maxAttachmentSizeBytes) {
      throw new FeedbackAttachmentError('FEEDBACK_ATTACHMENT_SIZE', 'Attachment is too large.');
    }

    const attachmentId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.fileName);
    const storageKey = path.join('staged', file.stagedSessionKey, `${attachmentId}-${safeName}`);
    const absolutePath = path.join(FEEDBACK_ATTACHMENTS_DIR, storageKey);
    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, file.buffer);

    const row = await prisma.baseAppFeedbackAttachment.create({
      data: {
        fileName: safeName,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.byteLength,
        storageKey,
        uploadedByUserId: file.uploadedByUserId,
        stagedSessionKey: file.stagedSessionKey,
      },
    });

    created.push({
      id: String(row.id),
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    });
  }

  return created;
};

export const linkAttachmentsToMessage = async (input: {
  attachmentIds: string[];
  feedbackId: bigint;
  messageId: bigint;
  stagedSessionKey?: string | null;
  uploaderUserId: number | null;
}) => {
  if (!input.attachmentIds.length) return;
  const prisma = getPrismaControlPlane();
  const ids = input.attachmentIds
    .map((value) => BigInt(value))
    .filter((value) => value > 0n);

  const attachments = await prisma.baseAppFeedbackAttachment.findMany({
    where: {
      id: { in: ids },
      messageId: null,
      ...(input.stagedSessionKey ? { stagedSessionKey: input.stagedSessionKey } : {}),
    },
  });

  if (attachments.length !== ids.length) {
    throw new FeedbackAttachmentError('FEEDBACK_ATTACHMENT_INVALID', 'One or more attachments are invalid.');
  }

  for (const attachment of attachments) {
    if (
      attachment.uploadedByUserId != null
      && input.uploaderUserId != null
      && attachment.uploadedByUserId !== BigInt(input.uploaderUserId)
    ) {
      throw new FeedbackAttachmentError('FEEDBACK_ATTACHMENT_FORBIDDEN', 'Attachment access denied.');
    }
  }

  await prisma.baseAppFeedbackAttachment.updateMany({
    where: { id: { in: ids } },
    data: {
      feedbackId: input.feedbackId,
      messageId: input.messageId,
      stagedSessionKey: null,
    },
  });
};

export const readAttachmentFile = async (storageKey: string): Promise<Buffer> => {
  const absolutePath = path.join(FEEDBACK_ATTACHMENTS_DIR, storageKey);
  return fs.readFile(absolutePath);
};

export const mapAttachmentRows = (
  rows: Array<{
    id: bigint;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }>,
) => rows.map((row) => ({
  id: String(row.id),
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  createdAt: row.createdAt.toISOString(),
}));
