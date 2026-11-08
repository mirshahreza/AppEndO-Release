import type { Request, Response } from 'express';
import { CORE_SLOT_CATALOG } from '../../shared/api/contracts/slots/catalog';
import { asyncHandler } from '../utils/asyncHandler';
import { listRegisteredSlotComponents } from '../services/slots/slotsCatalog.service';
import { listActiveSlotComponents } from '../services/package-runtime/packageUiRuntime.service';

export class SlotsController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const [registered, active] = await Promise.all([
      listRegisteredSlotComponents(),
      Promise.resolve(listActiveSlotComponents()),
    ]);
    res.json({
      success: true,
      slots: CORE_SLOT_CATALOG,
      registered,
      active,
    });
  }, 'Failed to load slot catalog.');
}
