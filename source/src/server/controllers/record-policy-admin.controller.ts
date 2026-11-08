import type { Request, Response } from 'express';
import type { RecordPolicyAdminService } from '../services/record-policy-admin.service';
import { asyncHandler } from '../utils/asyncHandler';

export class RecordPolicyAdminController {
  constructor(private readonly service: RecordPolicyAdminService) {}

  listDimensions = asyncHandler(async (_req: Request, res: Response) => {
    res.json(this.service.listDimensions().body);
  }, 'Failed to list scope dimensions.');

  getDimension = asyncHandler(async (req: Request, res: Response) => {
    res.json(this.service.getDimension(String(req.params.key || '')).body);
  }, 'Failed to load scope dimension.');

  listPolicies = asyncHandler(async (req: Request, res: Response) => {
    const edgeModelId = typeof req.query.edgeModelId === 'string' ? req.query.edgeModelId : undefined;
    res.json(this.service.listPolicies(edgeModelId).body);
  }, 'Failed to list record policies.');

  getPolicy = asyncHandler(async (req: Request, res: Response) => {
    res.json(this.service.getPolicy(String(req.params.id || '')).body);
  }, 'Failed to load record policy.');

  savePolicy = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.savePolicy((req.body || {}) as Record<string, unknown>);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to save record policy.');

  removePolicy = asyncHandler(async (req: Request, res: Response) => {
    res.json(this.service.removePolicy(String(req.params.id || '')).body);
  }, 'Failed to delete record policy.');

  getBinding = asyncHandler(async (req: Request, res: Response) => {
    res.json(this.service.getBinding(String(req.params.edgeModelId || '')).body);
  }, 'Failed to load record policy binding.');

  saveBinding = asyncHandler(async (req: Request, res: Response) => {
    res.json(this.service.saveBinding((req.body || {}) as Record<string, unknown>).body);
  }, 'Failed to save record policy binding.');

  removeBinding = asyncHandler(async (req: Request, res: Response) => {
    res.json(this.service.removeBinding(String(req.params.edgeModelId || '')).body);
  }, 'Failed to delete record policy binding.');

  explain = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.explain(
      req,
      String(req.query.edgeModelId || ''),
      String(req.query.action || 'list'),
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to explain record access.');
}
