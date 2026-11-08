import type { Request, Response } from 'express';
import type { FunctionsService, FunctionsServiceDeps } from '../services/functions.service';
import {
  getEntityFunctionAccess,
  replaceEntityFunctionAccess,
} from '../services/entityFunctionAccess.service';
import type {
  FunctionAccessEntityKind,
} from '../../shared/api/contracts/server-functions/entityAccess';
import { HttpError } from '../errors/HttpError';
import { asyncHandler } from '../utils/asyncHandler';
import { toRequestDbContext } from '../utils/requestContext';

const parseEntityKind = (value: string): FunctionAccessEntityKind => {
  if (value === 'users' || value === 'user') {
    return 'user';
  }
  if (value === 'roles' || value === 'role') {
    return 'role';
  }
  throw new HttpError(400, 'entityKind must be users or roles.');
};

export class FunctionsController {
  constructor(
    private readonly functionsService: FunctionsService,
    private readonly deps: FunctionsServiceDeps,
  ) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.functionsService.list(toRequestDbContext(req));
    res.json(result.body);
  }, 'Failed to list functions.');

  listUnused = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.functionsService.listUnused();
    res.json(result.body);
  }, 'Failed to load unused server functions.');

  listSystem = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.functionsService.listSystem();
    res.json(result.body);
  }, 'Failed to discover system functions.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.functionsService.create(
      toRequestDbContext(req),
      (req.body || {}) as Record<string, unknown>,
      req.auth?.email ?? null,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create function.');

  update = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.functionsService.update(
      toRequestDbContext(req),
      String(req.params.id || ''),
      (req.body || {}) as Record<string, unknown>,
      req.auth?.email ?? null,
    );
    res.json(result.body);
  }, 'Failed to update function.');

  updateBuiltIn = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.functionsService.updateBuiltIn(
      toRequestDbContext(req),
      String(req.params.id || ''),
      (req.body || {}) as import('../../shared/api/contracts/server-functions/payloads').UpdateBuiltinFunctionMetadataPayload,
      req.auth?.email ?? null,
    );
    res.json(result.body);
  }, 'Failed to update built-in function metadata.');

  updatePackage = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.functionsService.updatePackage(
      toRequestDbContext(req),
      String(req.params.id || ''),
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to update package API function.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.functionsService.remove(
      toRequestDbContext(req),
      String(req.params.id || ''),
    );
    res.json(result.body);
  }, 'Failed to delete function.');

  getEntityFunctionAccess = asyncHandler(async (req: Request, res: Response) => {
    const entityKind = parseEntityKind(String(req.params.entityKind || ''));
    const result = await getEntityFunctionAccess(
      this.deps,
      entityKind,
      decodeURIComponent(String(req.params.entityKey || '')),
    );
    res.json(result);
  }, 'Failed to load entity function access.');

  replaceEntityFunctionAccess = asyncHandler(async (req: Request, res: Response) => {
    const entityKind = parseEntityKind(String(req.params.entityKind || ''));
    const payload = (req.body || {}) as import('../../shared/api/contracts/server-functions/entityAccess').ReplaceEntityFunctionAccessPayload;
    const result = await replaceEntityFunctionAccess(
      this.deps,
      entityKind,
      decodeURIComponent(String(req.params.entityKey || '')),
      {
        decisions: payload.decisions && typeof payload.decisions === 'object' && !Array.isArray(payload.decisions)
          ? payload.decisions
          : {},
      },
      req.auth?.email ?? null,
    );
    res.json(result.body);
  }, 'Failed to update entity function access.');
}
