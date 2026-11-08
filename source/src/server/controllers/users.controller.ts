import type { Request, Response } from 'express';
import type { UsersService } from '../services/users.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext, toAuthAuditContext, toRequestDbContext } from '../utils/requestContext';

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  getUserAvatarXs = asyncHandler(async (req: Request, res: Response) => {
    const ifNoneMatch = req.headers['if-none-match'];
    const result = await this.usersService.getUserAvatarXs(Number(req.params.id));
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === result.etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
    res.setHeader('ETag', result.etag);
    res.type(result.mime);
    res.send(result.body);
  }, 'Failed to load user avatar.');

  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.listUsers(
      toRequestDbContext(req),
      (req.query || {}) as Record<string, unknown>,
    );
    if (res.headersSent) {
      return;
    }
    res.json(result.body);
  }, 'Failed to list users.');

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.createUser(
      toRequestDbContext(req),
      toActorContext(req, true),
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create user.');

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { newPassword } = req.body || {};
    const result = await this.usersService.adminChangePassword(
      toRequestDbContext(req),
      toActorContext(req, true),
      toAuthAuditContext(req),
      Number(req.params.id),
      String(newPassword || ''),
    );
    res.json(result.body);
  }, 'Failed to change user password.');

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.adminResetPassword(
      toRequestDbContext(req),
      toActorContext(req, true),
      toAuthAuditContext(req),
      Number(req.params.id),
    );
    res.json(result.body);
  }, 'Failed to reset user password.');

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.updateUser(
      toRequestDbContext(req),
      toActorContext(req, true),
      Number(req.params.id),
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to update user.');

  updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.updateUserProfile(
      toRequestDbContext(req),
      toActorContext(req, true),
      Number(req.params.id),
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to update user profile.');

  updateUserRoles = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.updateUserRoles(
      toRequestDbContext(req),
      toActorContext(req, true),
      Number(req.params.id),
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to update user roles.');

  getUserAttributes = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.getUserAttributes(Number(req.params.id));
    res.json(result.body);
  }, 'Failed to load user attributes.');

  updateUserAttributes = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.updateUserAttributes(
      toActorContext(req, true),
      Number(req.params.id),
      req.body || {},
    );
    res.json(result.body);
  }, 'Failed to update user attributes.');

  getUserSessionPreview = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.getUserSessionPreview(Number(req.params.id));
    res.json(result.body);
  }, 'Failed to load session preview.');

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.deleteUser(toRequestDbContext(req), Number(req.params.id));
    res.json(result.body);
  }, 'Failed to delete user.');

  lockUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.lockUser(
      toRequestDbContext(req),
      toActorContext(req, true),
      Number(req.params.id),
    );
    res.json(result.body);
  }, 'Failed to lock user.');

  unlockUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.unlockUser(
      toRequestDbContext(req),
      toActorContext(req, true),
      Number(req.params.id),
    );
    res.json(result.body);
  }, 'Failed to unlock user.');

  setUserLocked = asyncHandler(async (req: Request, res: Response) => {
    const locked = Boolean(req.body?.locked);
    const result = await this.usersService.setUserLocked(
      toRequestDbContext(req),
      toActorContext(req, true),
      Number(req.params.id),
      locked,
    );
    res.json(result.body);
  }, 'Failed to update locked state.');

  listDevices = asyncHandler(async (req: Request, res: Response) => {
    const { getDevices } = await import('../services/record-events/recordEvents.service');
    const items = await getDevices(toActorContext(req, req.auth?.role === 'ADMIN'), Number(req.params.id));
    res.json({ success: true, items });
  }, 'Failed to list user devices.');

  listRoles = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.listRoles(toRequestDbContext(req));
    res.json(result.body);
  }, 'Failed to list roles.');

  createRole = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.createRole(
      toRequestDbContext(req),
      toActorContext(req, true),
      req.body || {},
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create role.');

  updateRole = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.updateRole(
      toRequestDbContext(req),
      toActorContext(req, true),
      Number(req.params.id),
      req.body || {},
    );
    res.json(result.body);
  }, 'Failed to update role.');

  getRoleAttributes = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.getRoleAttributes(Number(req.params.id));
    res.json(result.body);
  }, 'Failed to load role attributes.');

  updateRoleAttributes = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.updateRoleAttributes(
      toActorContext(req, true),
      Number(req.params.id),
      req.body || {},
    );
    res.json(result.body);
  }, 'Failed to update role attributes.');

  deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.usersService.deleteRole(toRequestDbContext(req), Number(req.params.id));
    res.json(result.body);
  }, 'Failed to delete role.');
}
