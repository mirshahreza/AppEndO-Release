import type { ActorContext, AuthAuditContext, RequestDbContext } from '../types/requestContext';
import * as attributeValueService from './attributes/value.service';
import * as roleCrudService from './users/roleCrud.service';
import * as userCrudService from './users/userCrud.service';
import * as userAvatarService from './users/userAvatar.service';
import * as userLifecycleService from './users/userLifecycle.service';
import * as userPasswordService from './users/userPassword.service';
import * as userRolesService from './users/userRoles.service';

export class UsersService {
  async listUsers(_ctx: RequestDbContext, rawQuery: Record<string, unknown> = {}) {
    return userCrudService.listUsers(rawQuery);
  }

  async getUserAvatarXs(userId: number) {
    return userAvatarService.getUserAvatarXs(userId);
  }

  async createUser(_ctx: RequestDbContext, actor: ActorContext, payload: Record<string, unknown>) {
    return userCrudService.createUser(actor, payload);
  }

  async adminChangePassword(
    _ctx: RequestDbContext,
    actor: ActorContext,
    audit: AuthAuditContext,
    userId: number,
    newPassword: string,
  ) {
    return userPasswordService.adminChangePassword(actor, audit, userId, newPassword);
  }

  async adminResetPassword(
    _ctx: RequestDbContext,
    actor: ActorContext,
    audit: AuthAuditContext,
    userId: number,
  ) {
    return userPasswordService.adminResetPassword(actor, audit, userId);
  }

  async updateUser(_ctx: RequestDbContext, actor: ActorContext, userId: number, payload: Record<string, unknown>) {
    return userCrudService.updateUser(actor, userId, payload);
  }

  async updateUserProfile(_ctx: RequestDbContext, actor: ActorContext, userId: number, payload: Record<string, unknown>) {
    return userCrudService.updateUserProfileOnly(actor, userId, payload);
  }

  async updateUserRoles(_ctx: RequestDbContext, actor: ActorContext, userId: number, payload: Record<string, unknown>) {
    return userRolesService.updateUserRoles(actor, userId, payload);
  }

  async getUserAttributes(userId: number) {
    return attributeValueService.getUserAttributes(userId);
  }

  async updateUserAttributes(actor: ActorContext, userId: number, payload: unknown) {
    return attributeValueService.updateUserAttributes(actor, userId, payload);
  }

  async getUserSessionPreview(userId: number) {
    return attributeValueService.getUserSessionPreview(userId);
  }

  async deleteUser(_ctx: RequestDbContext, userId: number) {
    return userCrudService.deleteUserRecord(userId);
  }

  async lockUser(_ctx: RequestDbContext, actor: ActorContext, userId: number) {
    return userLifecycleService.lockUserAccount(actor, userId);
  }

  async unlockUser(_ctx: RequestDbContext, actor: ActorContext, userId: number) {
    return userLifecycleService.unlockUserAccount(actor, userId);
  }

  async setUserLocked(_ctx: RequestDbContext, actor: ActorContext, userId: number, locked: boolean) {
    return userLifecycleService.setUserLockedState(actor, userId, locked);
  }

  async listRoles(_ctx: RequestDbContext) {
    return roleCrudService.listRoles();
  }

  async createRole(_ctx: RequestDbContext, actor: ActorContext, input: { name?: string; note?: unknown }) {
    return roleCrudService.createRole(actor, input);
  }

  async updateRole(
    _ctx: RequestDbContext,
    actor: ActorContext,
    roleId: number,
    input: { name?: string; note?: unknown },
  ) {
    return roleCrudService.updateRoleRecord(actor, roleId, input);
  }

  async getRoleAttributes(roleId: number) {
    return attributeValueService.getRoleAttributes(roleId);
  }

  async updateRoleAttributes(actor: ActorContext, roleId: number, payload: unknown) {
    return attributeValueService.updateRoleAttributes(actor, roleId, payload);
  }

  async deleteRole(_ctx: RequestDbContext, roleId: number) {
    return roleCrudService.deleteRoleRecord(roleId);
  }
}
