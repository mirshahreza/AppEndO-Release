import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import type { PlatformFeedbackPolicy } from '../../../shared/api/contracts/feedback/types';
import { getDirectMessageAttachmentModel } from '../../domain/direct-messages/directMessageSequelizeModels';

const ATTACHMENTS_DIR = runtimeDirs.directMessageAttachments;

export class DirectMessageAttachmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DirectMessageAttachmentError';
  }
}

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 200) || 'attachment';

export type StageDirectMessageAttachmentInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: number;
  stagedSessionKey: string;
  policy: PlatformFeedbackPolicy;
};

export const stageDirectMessageAttachments = async (
  files: StageDirectMessageAttachmentInput[],
): Promise<Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }>> => {
  if (!files.length) {
    return [];
  }
  const policy = files[0]?.policy;
  if (!policy?.allowAttachments) {
    throw new DirectMessageAttachmentError('DM_ATTACHMENTS_DISABLED', 'File attachments are disabled.');
  }
  if (files.length > policy.maxAttachmentsPerMessage) {
    throw new DirectMessageAttachmentError('DM_TOO_MANY_ATTACHMENTS', 'Too many attachments.');
  }

  const Attachment = getDirectMessageAttachmentModel();
  const created = [];

  for (const file of files) {
    if (!policy.allowedAttachmentMimeTypes.includes(file.mimeType)) {
      throw new DirectMessageAttachmentError('DM_ATTACHMENT_TYPE', 'Attachment type is not allowed.');
    }
    if (file.buffer.byteLength > policy.maxAttachmentSizeBytes) {
      throw new DirectMessageAttachmentError('DM_ATTACHMENT_SIZE', 'Attachment is too large.');
    }

    const attachmentId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.fileName);
    const storageKey = path.join('staged', file.stagedSessionKey, `${attachmentId}-${safeName}`);
    const absolutePath = path.join(ATTACHMENTS_DIR, storageKey);
    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, file.buffer);

    const row = await Attachment.create({
      messageId: null,
      fileName: safeName,
      mimeType: file.mimeType,
      sizeBytes: file.buffer.byteLength,
      storageKey,
      uploadedByUserId: file.uploadedByUserId,
      stagedSessionKey: file.stagedSessionKey,
      createdAt: new Date(),
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

export const linkDirectMessageAttachmentsToMessage = async (input: {
  attachmentIds: string[];
  messageId: number;
  stagedSessionKey?: string | null;
  uploaderUserId: number;
}) => {
  if (!input.attachmentIds.length) {
    return;
  }
  const Attachment = getDirectMessageAttachmentModel();
  const ids = input.attachmentIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const attachments = await Attachment.findAll({
    where: {
      id: ids,
      messageId: null,
      ...(input.stagedSessionKey ? { stagedSessionKey: input.stagedSessionKey } : {}),
    },
  });

  if (attachments.length !== ids.length) {
    throw new DirectMessageAttachmentError('DM_ATTACHMENT_INVALID', 'One or more attachments are invalid.');
  }

  for (const attachment of attachments) {
    if (Number(attachment.uploadedByUserId) !== input.uploaderUserId) {
      throw new DirectMessageAttachmentError('DM_ATTACHMENT_FORBIDDEN', 'Attachment access denied.');
    }
  }

  await Attachment.update(
    { messageId: input.messageId, stagedSessionKey: null },
    { where: { id: ids } },
  );
};

export const listDirectMessageAttachmentsByMessageIds = async (
  messageIds: number[],
): Promise<Map<number, Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>>> => {
  const map = new Map<number, Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>>();
  if (messageIds.length === 0) {
    return map;
  }
  const Attachment = getDirectMessageAttachmentModel();
  const rows = await Attachment.findAll({
    where: { messageId: messageIds },
    order: [['id', 'ASC']],
  });
  for (const row of rows) {
    const messageId = Number(row.messageId);
    const list = map.get(messageId) ?? [];
    list.push({
      id: String(row.id),
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    });
    map.set(messageId, list);
  }
  return map;
};

export const readDirectMessageAttachmentFile = async (storageKey: string): Promise<Buffer> => {
  const absolutePath = path.join(ATTACHMENTS_DIR, storageKey);
  return fs.readFile(absolutePath);
};

export const findDirectMessageAttachmentById = async (attachmentId: number) => {
  const Attachment = getDirectMessageAttachmentModel();
  return Attachment.findByPk(attachmentId);
};
