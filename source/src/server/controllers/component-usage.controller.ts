import type { Request, Response } from 'express';
import type { ComponentUsageHitBody } from '../../shared/api/contracts/component-usage/hit';
import { recordComponentUsageHit } from '../services/component-usage/componentUsagePersistence.service';
import { asyncHandler } from '../utils/asyncHandler';

const USAGE_KINDS = new Set<ComponentUsageHitBody['kind']>([
  'designer',
  'package',
  'shell',
  'server-function',
]);

export class ComponentUsageController {
  recordHit = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Partial<ComponentUsageHitBody>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const kind = body.kind;

    if (!name || !kind || !USAGE_KINDS.has(kind)) {
      res.status(400).json({ success: false, error: 'Invalid usage hit payload.' });
      return;
    }

    recordComponentUsageHit({ componentName: name, kind });
    res.status(204).end();
  }, 'Failed to record component usage hit.');
}
