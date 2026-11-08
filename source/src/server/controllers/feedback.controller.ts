import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { FeedbackService, FeedbackServiceError } from '../services/feedback/feedback.service';
import { readAttachmentFile } from '../services/feedback/feedbackAttachment.service';
import { getPrismaControlPlane } from '../db/prismaControlPlane';
import type {
  AssignFeedbackRequest,
  FeedbackInboxBucket,
  FeedbackStatus,
  PlatformFeedbackConfig,
  PostFeedbackMessageRequest,
  SubmitFeedbackRequest,
  UpdateFeedbackStatusRequest,
} from '../../shared/api/contracts/feedback/types';
import { FEEDBACK_STATUSES } from '../../shared/api/contracts/feedback/constants';

const getStagedSessionKey = (req: Request): string => {
  const header = req.header('x-feedback-session');
  if (header && header.trim()) return header.trim().slice(0, 120);
  return `ip:${req.ip ?? 'unknown'}`;
};

const handleServiceError = (error: unknown, res: Response): boolean => {
  if (error instanceof FeedbackServiceError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code });
    return true;
  }
  return false;
};

export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  getBootPolicy = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, feedbackPolicy: await this.service.getBootPolicy() });
  });

  getSubjects = asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      subjects: await this.service.listSubjects(),
    });
  });

  getAdminConfig = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, config: this.service.getConfig() });
  });

  putAdminConfig = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as PlatformFeedbackConfig;
    const saved = this.service.saveConfig(body, req.auth?.userId ?? null);
    res.json({ success: true, config: saved });
  });

  submit = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.service.submitFeedback(
        req.body as SubmitFeedbackRequest,
        req.auth,
        getStagedSessionKey(req),
        req.ip,
      );
      res.status(201).json({ success: true, ticket: result.ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  uploadAttachments = asyncHandler(async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const attachments = await this.service.stageAttachments(
        files.map((file) => ({
          fileName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
        })),
        req.auth,
        getStagedSessionKey(req),
      );
      res.status(201).json({ success: true, attachments });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  listMine = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? req.query.limit ?? 20), 1), 100);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
    const status = statusRaw && FEEDBACK_STATUSES.includes(statusRaw as FeedbackStatus)
      ? statusRaw as FeedbackStatus
      : undefined;
    const result = await this.service.listMine(req.auth!, {
      page,
      pageSize,
      search,
      status,
      subjectId,
    });
    res.json({ success: true, ...result });
  });

  getMine = asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await this.service.getTicketDetail(Number(req.params.id), req.auth);
      res.json({ success: true, ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  postMineMessage = asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await this.service.postMessage(
        Number(req.params.id),
        { ...(req.body as PostFeedbackMessageRequest), kind: 'SUBMITTER' },
        req.auth!,
        getStagedSessionKey(req),
      );
      res.json({ success: true, ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  markMineRead = asyncHandler(async (req: Request, res: Response) => {
    try {
      await this.service.markRead(Number(req.params.id), req.auth!);
      res.json({ success: true });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const bucket = (req.query.bucket as FeedbackInboxBucket | undefined) ?? 'ALL';
    const limit = Number(req.query.limit ?? 50);
    const result = await this.service.listAdmin(req.auth!, bucket, limit);
    res.json({ success: true, ...result });
  });

  getAdmin = asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await this.service.getTicketDetail(Number(req.params.id), req.auth);
      res.json({ success: true, ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  postAdminMessage = asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await this.service.postMessage(
        Number(req.params.id),
        req.body as PostFeedbackMessageRequest,
        req.auth!,
        getStagedSessionKey(req),
      );
      res.json({ success: true, ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  claim = asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await this.service.claimTicket(Number(req.params.id), req.auth!);
      res.json({ success: true, ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  assign = asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await this.service.assignTicket(
        Number(req.params.id),
        req.body as AssignFeedbackRequest,
        req.auth!,
      );
      res.json({ success: true, ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await this.service.updateStatus(
        Number(req.params.id),
        req.body as UpdateFeedbackStatusRequest,
        req.auth!,
      );
      res.json({ success: true, ticket });
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
    }
  });

  downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaControlPlane();
    const attachment = await prisma.baseAppFeedbackAttachment.findUnique({
      where: { id: BigInt(req.params.id) },
      include: { feedback: true },
    });
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found.' });
      return;
    }
    try {
      await this.service.getTicketDetail(Number(attachment.feedbackId), req.auth);
    } catch (error) {
      if (!handleServiceError(error, res)) throw error;
      return;
    }
    const buffer = await readAttachmentFile(attachment.storageKey);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    res.send(buffer);
  });
}
