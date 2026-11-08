import type { Request, Response } from 'express';
import { hasAdminRole } from '../middleware/auth.middleware';
import type { ProfileService } from '../services/profile.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendJsonBody } from '../utils/controllerHttp';
import { toActorContext, toRequestDbContext } from '../utils/requestContext';

export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.getProfile(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
    );
    sendJsonBody(res, result.body);
  }, 'Failed to fetch profile.');

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.updateProfile(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
      (req.body || {}) as Record<string, unknown>,
    );
    sendJsonBody(res, result.body);
  }, 'Failed to save profile.');

  getMyAttributeSummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.getMyAttributeSummary(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
    );
    sendJsonBody(res, result.body);
  }, 'Failed to fetch attribute summary.');

  getMyEditableAttributes = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.getMyEditableAttributes(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
    );
    sendJsonBody(res, result.body);
  }, 'Failed to fetch editable attributes.');

  updateMyEditableAttributes = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.updateMyEditableAttributes(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
      req.body,
    );
    sendJsonBody(res, result.body);
  }, 'Failed to save editable attributes.');

  updateMyGridColumnLayout = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.updateMyGridColumnLayout(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
      req.body,
    );
    sendJsonBody(res, result.body);
  }, 'Failed to save grid column layout.');

  getMyDashboardLayout = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.getMyDashboardLayout(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
    );
    sendJsonBody(res, result.body);
  }, 'Failed to load dashboard layout.');

  updateMyDashboardLayout = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.updateMyDashboardLayout(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
      req.body,
    );
    sendJsonBody(res, result.body);
  }, 'Failed to save dashboard layout.');

  getMyEditableProfileFields = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.getMyEditableProfileFields(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
    );
    sendJsonBody(res, result.body);
  }, 'Failed to fetch editable profile fields.');

  updateMyEditableProfileFields = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.updateMyEditableProfileFields(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
      req.body,
    );
    sendJsonBody(res, result.body);
  }, 'Failed to save editable profile fields.');

  getLinkedIdentities = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.getLinkedIdentities(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
    );
    sendJsonBody(res, result.body);
  }, 'Failed to fetch linked identities.');

  updateMyAccount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.profileService.updateMyAccount(
      toRequestDbContext(req),
      toActorContext(req, hasAdminRole(req)),
      (req.body || {}) as Record<string, unknown>,
    );
    sendJsonBody(res, result.body);
  }, 'Failed to save account.');
}
