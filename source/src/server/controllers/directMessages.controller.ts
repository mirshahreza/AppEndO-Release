import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { DirectMessageService, DirectMessageServiceError } from '../services/direct-messages/directMessage.service';
import { invalidatePersonalInboxProjection } from '../services/personal-inbox/personalInboxProjectionInvalidate';

const getStagedSessionKey = (req: Request): string => {
  const header = req.header('x-direct-message-session');
  if (header && header.trim()) return header.trim().slice(0, 120);
  return `ip:${req.ip ?? 'unknown'}`;
};

const handleServiceError = (res: Response, err: unknown): boolean => {
  if (err instanceof DirectMessageServiceError) {
    res.status(err.status).json({ success: false, code: err.code, message: err.message });
    return true;
  }
  return false;
};

export class DirectMessagesController {
  constructor(private readonly service: DirectMessageService) {}

  searchRecipients = asyncHandler(async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const items = await this.service.searchRecipients(req.auth!, search);
    res.json({ success: true, items });
  });

  uploadAttachments = asyncHandler(async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const attachments = await this.service.stageAttachments(
        req.auth!,
        files.map((file) => ({
          fileName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
        })),
        getStagedSessionKey(req),
      );
      res.status(201).json({ success: true, attachments });
    } catch (err) {
      if (!handleServiceError(res, err)) {
        throw err;
      }
    }
  });

  downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
    try {
      const attachmentId = Number(req.params.attachmentId);
      if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
        res.status(400).json({ success: false, message: 'Invalid attachment id.' });
        return;
      }
      const file = await this.service.getAttachmentForDownload(req.auth!, attachmentId);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
      res.send(file.buffer);
    } catch (err) {
      if (!handleServiceError(res, err)) {
        throw err;
      }
    }
  });

  createThread = asyncHandler(async (req: Request, res: Response) => {
    try {
      const recipientUserId = Number(req.body?.recipientUserId);
      const body = typeof req.body?.body === 'string' ? req.body.body : undefined;
      const stagedSessionKey = typeof req.body?.stagedSessionKey === 'string' ? req.body.stagedSessionKey : undefined;
      const attachmentIds = Array.isArray(req.body?.attachmentIds)
        ? req.body.attachmentIds.filter((id: unknown) => typeof id === 'string')
        : undefined;
      if (!Number.isInteger(recipientUserId) || recipientUserId <= 0) {
        res.status(400).json({ success: false, message: 'recipientUserId is required.' });
        return;
      }
      const result = await this.service.createThread(req.auth!, {
        recipientUserId,
        body,
        attachmentIds,
        stagedSessionKey,
      });
      invalidatePersonalInboxProjection(req.auth!.userId);
      invalidatePersonalInboxProjection(recipientUserId);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (!handleServiceError(res, err)) {
        throw err;
      }
    }
  });

  getThread = asyncHandler(async (req: Request, res: Response) => {
    try {
      const threadId = Number(req.params.threadId);
      const thread = await this.service.getThread(req.auth!, threadId);
      res.json({ success: true, thread });
    } catch (err) {
      if (!handleServiceError(res, err)) {
        throw err;
      }
    }
  });

  listMessages = asyncHandler(async (req: Request, res: Response) => {
    try {
      const threadId = Number(req.params.threadId);
      const result = await this.service.listThreadMessages(req.auth!, threadId);
      res.json({ success: true, ...result });
    } catch (err) {
      if (!handleServiceError(res, err)) {
        throw err;
      }
    }
  });

  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    try {
      const threadId = Number(req.params.threadId);
      const body = typeof req.body?.body === 'string' ? req.body.body : '';
      const stagedSessionKey = typeof req.body?.stagedSessionKey === 'string' ? req.body.stagedSessionKey : undefined;
      const attachmentIds = Array.isArray(req.body?.attachmentIds)
        ? req.body.attachmentIds.filter((id: unknown) => typeof id === 'string')
        : undefined;
      const result = await this.service.sendMessage(req.auth!, threadId, body, {
        attachmentIds,
        stagedSessionKey,
      });
      const thread = await this.service.getThread(req.auth!, threadId);
      invalidatePersonalInboxProjection(req.auth!.userId);
      invalidatePersonalInboxProjection(thread.counterpartUserId);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (!handleServiceError(res, err)) {
        throw err;
      }
    }
  });

  markRead = asyncHandler(async (req: Request, res: Response) => {
    try {
      const threadId = Number(req.params.threadId);
      await this.service.markRead(req.auth!, threadId);
      invalidatePersonalInboxProjection(req.auth!.userId);
      res.json({ success: true });
    } catch (err) {
      if (!handleServiceError(res, err)) {
        throw err;
      }
    }
  });
}
