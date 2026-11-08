import type { AuthRequestContext } from '../../middleware/auth.middleware';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';
import {
  DIRECT_MESSAGE_BODY_MAX,
  createThreadWithOptionalMessage,
  findThreadById,
  insertMessage,
  isThreadParticipant,
  listMessages,
  listThreadsForUser,
  markThreadReadForUser,
  markThreadUnreadForUser,
  otherParticipantUserId,
  countUnreadMessagesForUser,
} from '../../domain/direct-messages/directMessage.repository';
import { findUserIdEmailUsername } from '../../domain/users/userRepository';
import {
  DirectMessageAttachmentError,
  linkDirectMessageAttachmentsToMessage,
  listDirectMessageAttachmentsByMessageIds,
} from './directMessageAttachment.service';
import { FeedbackService } from '../feedback/feedback.service';

export class DirectMessageServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DirectMessageServiceError';
  }
}

const normalizeMessageBody = (body: string | undefined, attachmentCount: number): string => {
  const trimmed = (body ?? '').trim();
  if (!trimmed && attachmentCount === 0) {
    throw new DirectMessageServiceError('DM_BODY_REQUIRED', 400, 'Message body or attachment is required.');
  }
  if (trimmed.length > DIRECT_MESSAGE_BODY_MAX) {
    throw new DirectMessageServiceError('DM_BODY_TOO_LONG', 400, 'Message is too long.');
  }
  return trimmed;
};

const rethrowAttachmentError = (error: unknown): never => {
  if (error instanceof DirectMessageAttachmentError) {
    throw new DirectMessageServiceError(error.code, 400, error.message);
  }
  throw error;
};

export type DirectMessageAttachmentDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export class DirectMessageService {
  private readonly feedbackService: FeedbackService;

  constructor(settingsPath: string) {
    this.feedbackService = new FeedbackService(settingsPath);
  }

  async searchRecipients(auth: AuthRequestContext, search: string) {
    const term = search.trim();
    if (term.length < 1) {
      return [];
    }
    const prisma = getPrismaControlPlane();
    const rows = await prisma.baseUser.findMany({
      where: {
        id: { not: BigInt(auth.userId) },
        username: { contains: term },
      },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
      take: 20,
    });
    return rows.map((row) => ({ id: Number(row.id), username: row.username }));
  }

  async createThread(
    auth: AuthRequestContext,
    input: {
      recipientUserId: number;
      body?: string;
      attachmentIds?: string[];
      stagedSessionKey?: string;
    },
  ) {
    if (input.recipientUserId === auth.userId) {
      throw new DirectMessageServiceError('DM_SELF', 400, 'Cannot message yourself.');
    }
    const recipient = await findUserIdEmailUsername(input.recipientUserId);
    if (!recipient) {
      throw new DirectMessageServiceError('DM_RECIPIENT_NOT_FOUND', 404, 'Recipient not found.');
    }
    const attachmentIds = (input.attachmentIds ?? []).filter((id) => id.trim().length > 0);
    const normalizedBody = normalizeMessageBody(input.body, attachmentIds.length);
    const { thread, message } = await createThreadWithOptionalMessage({
      senderUserId: auth.userId,
      recipientUserId: input.recipientUserId,
      body: normalizedBody,
      allowEmptyBody: attachmentIds.length > 0,
    });
    let messageRow = message;
    if (!messageRow && attachmentIds.length > 0) {
      messageRow = await insertMessage({
        threadId: thread.id,
        senderUserId: auth.userId,
        body: normalizedBody,
      });
    }
    if (messageRow && attachmentIds.length > 0) {
      try {
        await linkDirectMessageAttachmentsToMessage({
          attachmentIds,
          messageId: messageRow.id,
          stagedSessionKey: input.stagedSessionKey,
          uploaderUserId: auth.userId,
        });
      } catch (error) {
        rethrowAttachmentError(error);
      }
    }
    const mappedMessage = messageRow ? await this.mapMessageDtoWithAttachments(messageRow) : null;
    return {
      thread: await this.mapThreadDetail(auth.userId, thread.id),
      message: mappedMessage,
    };
  }

  async getThread(auth: AuthRequestContext, threadId: number) {
    await this.requireParticipant(auth.userId, threadId);
    return this.mapThreadDetail(auth.userId, threadId);
  }

  async listThreadMessages(auth: AuthRequestContext, threadId: number) {
    await this.requireParticipant(auth.userId, threadId);
    const messages = await listMessages(threadId, { take: 80 });
    const attachmentMap = await listDirectMessageAttachmentsByMessageIds(messages.map((row) => row.id));
    return {
      messages: messages.map((row) => mapMessageDto(row, attachmentMap.get(row.id) ?? [])),
    };
  }

  async sendMessage(
    auth: AuthRequestContext,
    threadId: number,
    body: string,
    options?: { attachmentIds?: string[]; stagedSessionKey?: string },
  ) {
    await this.requireParticipant(auth.userId, threadId);
    const attachmentIds = (options?.attachmentIds ?? []).filter((id) => id.trim().length > 0);
    const normalizedBody = normalizeMessageBody(body, attachmentIds.length);
    const message = await insertMessage({
      threadId,
      senderUserId: auth.userId,
      body: normalizedBody,
    });
    if (attachmentIds.length > 0) {
      try {
        await linkDirectMessageAttachmentsToMessage({
          attachmentIds,
          messageId: message.id,
          stagedSessionKey: options?.stagedSessionKey,
          uploaderUserId: auth.userId,
        });
      } catch (error) {
        rethrowAttachmentError(error);
      }
    }
    return { message: await this.mapMessageDtoWithAttachments(message) };
  }

  async stageAttachments(
    auth: AuthRequestContext,
    files: Array<{ fileName: string; mimeType: string; buffer: Buffer }>,
    stagedSessionKey: string,
  ) {
    const { policy } = this.feedbackService.getConfig();
    if (!policy.allowAttachments) {
      throw new DirectMessageServiceError('DM_ATTACHMENTS_DISABLED', 403, 'File attachments are disabled.');
    }
    const { stageDirectMessageAttachments } = await import('./directMessageAttachment.service');
    try {
      return await stageDirectMessageAttachments(files.map((file) => ({
        ...file,
        uploadedByUserId: auth.userId,
        stagedSessionKey,
        policy,
      })));
    } catch (error) {
      rethrowAttachmentError(error);
    }
  }

  async getAttachmentForDownload(auth: AuthRequestContext, attachmentId: number) {
    const { findDirectMessageAttachmentById, readDirectMessageAttachmentFile } = await import('./directMessageAttachment.service');
    const row = await findDirectMessageAttachmentById(attachmentId);
    if (!row?.messageId) {
      throw new DirectMessageServiceError('DM_ATTACHMENT_NOT_FOUND', 404, 'Attachment not found.');
    }
    const Message = (await import('../../domain/direct-messages/directMessageSequelizeModels')).getDirectMessageMessageModel();
    const message = await Message.findByPk(Number(row.messageId));
    if (!message) {
      throw new DirectMessageServiceError('DM_ATTACHMENT_NOT_FOUND', 404, 'Attachment not found.');
    }
    await this.requireParticipant(auth.userId, Number(message.threadId));
    const buffer = await readDirectMessageAttachmentFile(row.storageKey);
    return {
      fileName: row.fileName,
      mimeType: row.mimeType,
      buffer,
    };
  }

  private async mapMessageDtoWithAttachments(message: {
    id: number;
    threadId: number;
    senderUserId: number;
    body: string;
    createdAt: Date;
  }) {
    const attachmentMap = await listDirectMessageAttachmentsByMessageIds([message.id]);
    return mapMessageDto(message, attachmentMap.get(message.id) ?? []);
  }

  async markRead(auth: AuthRequestContext, threadId: number): Promise<void> {
    await this.requireParticipant(auth.userId, threadId);
    await markThreadReadForUser(threadId, auth.userId);
  }

  async markUnread(auth: AuthRequestContext, threadId: number): Promise<void> {
    await this.requireParticipant(auth.userId, threadId);
    await markThreadUnreadForUser(threadId, auth.userId);
  }

  private async requireParticipant(userId: number, threadId: number): Promise<void> {
    const ok = await isThreadParticipant(threadId, userId);
    if (!ok) {
      throw new DirectMessageServiceError('DM_FORBIDDEN', 404, 'Conversation not found.');
    }
  }

  private async mapThreadDetail(viewerUserId: number, threadId: number) {
    const thread = await findThreadById(threadId);
    if (!thread) {
      throw new DirectMessageServiceError('DM_NOT_FOUND', 404, 'Conversation not found.');
    }
    const counterpartId = otherParticipantUserId(thread, viewerUserId);
    const counterpart = await findUserIdEmailUsername(counterpartId);
    const unreadCount = await countUnreadMessagesForUser(threadId, viewerUserId);
    return {
      id: thread.id,
      counterpartUserId: counterpartId,
      counterpartUsername: counterpart?.username ?? `#${counterpartId}`,
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: thread.lastMessagePreview,
      unreadCount,
    };
  }
}

const mapMessageDto = (
  row: {
    id: number;
    threadId: number;
    senderUserId: number;
    body: string;
    createdAt: Date;
  },
  attachments: DirectMessageAttachmentDto[] = [],
) => ({
  id: row.id,
  threadId: row.threadId,
  senderUserId: row.senderUserId,
  body: row.body,
  createdAt: row.createdAt.toISOString(),
  attachments,
});

export async function listDirectMessageThreadsForInbox(userId: number) {
  return listThreadsForUser(userId, 120);
}
