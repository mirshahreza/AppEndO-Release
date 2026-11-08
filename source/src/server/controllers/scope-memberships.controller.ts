import type { Request, Response } from 'express';
import type { ScopeMembershipsService } from '../services/scope-memberships.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext, toRequestDbContext } from '../utils/requestContext';

export class ScopeMembershipsController {
  constructor(private readonly service: ScopeMembershipsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.list(
      toRequestDbContext(req),
      (req.query || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to load scope memberships.');

  listEvents = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listEvents(
      toRequestDbContext(req),
      (req.query || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to load membership history.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.create(
      toRequestDbContext(req),
      toActorContext(req, true),
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create scope membership.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.remove(
      toRequestDbContext(req),
      toActorContext(req, true),
      String(req.params.id || ''),
    );
    res.json(result.body);
  }, 'Failed to delete scope membership.');

  listRoles = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listRoles(
      toRequestDbContext(req),
      (req.query || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to load role scope memberships.');

  listRoleEvents = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listRoleEvents(
      toRequestDbContext(req),
      (req.query || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to load role membership history.');

  createRole = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.createRole(
      toRequestDbContext(req),
      toActorContext(req, true),
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create role scope membership.');

  removeRole = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.removeRole(
      toRequestDbContext(req),
      toActorContext(req, true),
      String(req.params.id || ''),
    );
    res.json(result.body);
  }, 'Failed to delete role scope membership.');
}
