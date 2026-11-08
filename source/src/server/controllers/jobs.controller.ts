import type { Request, Response } from 'express';
import type { JobsService } from '../services/jobs/jobs.service';
import { asyncHandler } from '../utils/asyncHandler';

const STREAM_POLL_INTERVAL_MS = 1500;

export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 100);
    const statusFilter = this.jobsService.parseStatusFilter(req.query.status);
    const result = await this.jobsService.list(
      Number.isFinite(limit) ? limit : 100,
      statusFilter,
    );
    res.json(result.body);
  }, 'Failed to list jobs.');

  stream = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendSnapshot = async () => {
      const snapshot = await this.jobsService.streamSnapshot();
      res.write(`data: ${JSON.stringify({ type: 'snapshot', ...snapshot })}\n\n`);
    };

    await sendSnapshot();

    const interval = setInterval(() => {
      void sendSnapshot().catch(() => {
        clearInterval(interval);
      });
    }, STREAM_POLL_INTERVAL_MS);

    req.on('close', () => {
      clearInterval(interval);
    });
  }, 'Failed to stream jobs.');

  enqueue = asyncHandler(async (req: Request, res: Response) => {
    const functionId = typeof req.body?.functionId === 'string' ? req.body.functionId.trim() : '';
    if (!functionId) {
      res.status(400).json({ success: false, error: 'functionId is required.' });
      return;
    }

    const payload = req.body?.payload && typeof req.body.payload === 'object' && !Array.isArray(req.body.payload)
      ? req.body.payload as Record<string, unknown>
      : {};

    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
      ? req.body.metadata
      : undefined;

    const title = typeof req.body?.title === 'string' && req.body.title.trim()
      ? req.body.title.trim()
      : undefined;

    const result = await this.jobsService.enqueue({
      functionId,
      title,
      payload,
      metadata,
      createdBy: req.auth?.userId ?? null,
    });

    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to enqueue job.');

  getById = asyncHandler(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);
    const result = await this.jobsService.getById(jobId);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to load job.');

  cancel = asyncHandler(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);
    const result = await this.jobsService.cancel(jobId);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to cancel job.');

  retry = asyncHandler(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);
    const result = await this.jobsService.retry(jobId, req.auth?.userId ?? null);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to retry job.');

  /** p-102 — non-admin enqueue of a background agent task, scoped to the caller. */
  enqueueOwnAgentTask = asyncHandler(async (req: Request, res: Response) => {
    const actorUserId = req.auth?.userId;
    if (!actorUserId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    const result = await this.jobsService.enqueueOwnAgentTask(req.body, actorUserId);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to start background agent task.');

  /** p-102 — non-admin cancel of the caller's own background agent task. */
  cancelOwnAgentTask = asyncHandler(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);
    const actorUserId = req.auth?.userId;
    if (!actorUserId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    const result = await this.jobsService.cancelOwnAgentTask(jobId, actorUserId);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to cancel agent task.');
}
