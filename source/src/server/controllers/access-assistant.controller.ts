import type { Request, Response } from 'express';
import type { FunctionAccessEntityKind } from '../../shared/api/contracts/server-functions/entityAccess';
import type { AccessAssistantSavePayload } from '../../shared/api/contracts/access-assistant/types';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../errors/HttpError';
import {
  getAccessAssistantContext,
  resolveAccessAssistantEligibility,
  saveAccessAssistantContext,
} from '../services/access-assistant/accessAssistant.service';
import type { EntityFunctionAccessServiceDeps } from '../services/entityFunctionAccess.service';

const parseEntityKind = (value: string): FunctionAccessEntityKind => {
  if (value === 'user' || value === 'role') {
    return value;
  }
  throw new HttpError(400, 'Invalid entity kind.');
};

export class AccessAssistantController {
  constructor(private readonly deps: EntityFunctionAccessServiceDeps) {}

  getEligibility = asyncHandler(async (req: Request, res: Response) => {
    const pageKey = String(req.query.pageKey ?? '');
    res.json({
      success: true,
      pageKey: pageKey.trim(),
      eligibility: resolveAccessAssistantEligibility(pageKey),
    });
  });

  getContext = asyncHandler(async (req: Request, res: Response) => {
    const pageKey = String(req.query.pageKey ?? '');
    const entityKindRaw = typeof req.query.entityKind === 'string' ? req.query.entityKind : undefined;
    const entityKey = typeof req.query.entityKey === 'string' ? req.query.entityKey : undefined;

    const entityKind = entityKindRaw ? parseEntityKind(entityKindRaw) : undefined;

    const result = await getAccessAssistantContext(this.deps, {
      pageKey,
      entityKind,
      entityKey,
    });
    res.json(result);
  });

  saveContext = asyncHandler(async (req: Request, res: Response) => {
    const pageKey = String(req.query.pageKey ?? '');
    const payload = req.body as AccessAssistantSavePayload;
    if (!payload?.entityKind || !payload.entityKey) {
      res.status(400).json({ success: false, error: 'entityKind and entityKey are required.' });
      return;
    }

    const result = await saveAccessAssistantContext(
      this.deps,
      payload,
      pageKey,
      req.auth?.email ?? null,
    );
    res.json(result);
  });
}
