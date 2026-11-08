import type { Request, Response } from 'express';
import {
  createSettingsAttribute,
  deleteSettingsAttributeRecord,
  listSettingsAttributes,
  reorderSettingsAttributeRecords,
  updateSettingsAttributeRecord,
} from '../services/attributes/settingsAttributes.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext } from '../utils/requestContext';

export class SettingsAttributesController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await listSettingsAttributes(req.query.scope);
    res.json(result.body);
  }, 'Failed to list settings attributes.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const result = await createSettingsAttribute(
      toActorContext(req, true),
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create settings attribute.');

  update = asyncHandler(async (req: Request, res: Response) => {
    const settingsAttributeId = Number(req.params.id);
    if (!Number.isInteger(settingsAttributeId) || settingsAttributeId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid settings attribute id.' });
      return;
    }

    const result = await updateSettingsAttributeRecord(
      toActorContext(req, true),
      settingsAttributeId,
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to update settings attribute.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const settingsAttributeId = Number(req.params.id);
    if (!Number.isInteger(settingsAttributeId) || settingsAttributeId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid settings attribute id.' });
      return;
    }

    const result = await deleteSettingsAttributeRecord(settingsAttributeId);
    res.json(result.body);
  }, 'Failed to delete settings attribute.');

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const result = await reorderSettingsAttributeRecords(
      toActorContext(req, true),
      body.scope,
      body.orderedIds,
    );
    res.json(result.body);
  }, 'Failed to reorder settings attributes.');
}
