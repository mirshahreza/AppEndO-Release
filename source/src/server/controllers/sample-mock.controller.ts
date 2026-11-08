import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import type { SampleMockService } from '../services/sample-mock/sample-mock.service';

export class SampleMockController {
  constructor(private readonly service: SampleMockService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const items = await this.service.list(req.query.include);
    res.json({ success: true, items });
  }, 'Failed to list sample mock records.');

  lookups = asyncHandler(async (_req: Request, res: Response) => {
    const lookups = await this.service.lookups();
    res.json({ success: true, ...lookups });
  }, 'Failed to list sample mock lookups.');

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await this.service.getById(String(req.params.id), req.query.include);
    res.json({ success: true, item });
  }, 'Failed to load sample mock record.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const item = await this.service.create(req, body);
    res.status(201).json({ success: true, item });
  }, 'Failed to create sample mock record.');

  createBulk = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const items = await this.service.createBulk(req, body);
    res.status(201).json({ success: true, items });
  }, 'Failed to create sample mock records.');

  patch = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const item = await this.service.patch(req, String(req.params.id), body);
    res.json({ success: true, item });
  }, 'Failed to update sample mock record.');

  approve = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const item = await this.service.approve(req, String(req.params.id), body);
    res.json({ success: true, item });
  }, 'Failed to approve sample mock record.');

  lock = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const item = await this.service.lock(req, String(req.params.id), body);
    res.json({ success: true, item });
  }, 'Failed to lock sample mock record.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    await this.service.delete(req, String(req.params.id));
    res.json({ success: true });
  }, 'Failed to delete sample mock record.');
}
