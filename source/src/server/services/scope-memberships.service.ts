import {
  GEO_BASE_INFO_ROOT_ID,
  ORG_BASE_INFO_ROOT_ID,
  SCOPE_DIMENSION_GEO,
  SCOPE_DIMENSION_ORG,
  SCOPE_DIMENSION_ROOT,
} from '../../shared/api/contracts/org-geo/constants';
import { PRESET_SCOPE_DIMENSION_ROOTS } from '../../shared/api/contracts/record-policy';
import { isBaseInfoIdInSubtree } from '../../shared/lib/isBaseInfoIdInSubtree';
import { findBaseInfoIdExists } from '../domain/base-info/treeRepository';
import {
  createScopeMembership,
  createScopeMembershipEvent,
  deleteScopeMembership,
  findScopeMembershipById,
  findScopeMembershipUnique,
  listScopeMembershipEventsByNode,
  listScopeMembershipsByNode,
  listScopeMembershipsByDimension,
  listScopeMembershipsByUser,
  userExists,
} from '../domain/scope-memberships/repository';
import {
  createScopeRoleMembership,
  createScopeRoleMembershipEvent,
  deleteScopeRoleMembership,
  findScopeRoleMembershipById,
  findScopeRoleMembershipUnique,
  listScopeRoleMembershipEventsByNode,
  listScopeRoleMembershipsByNode,
  listUserIdsForRole,
  roleExists,
} from '../domain/scope-memberships/roleRepository';
import { HttpError } from '../errors/HttpError';
import type { ActorContext, RequestDbContext } from '../types/requestContext';
import { invalidateSessionContextForUsers } from './attributes/sessionContextCache';
import { getScopeDimension, listScopeDimensions } from './record-policy/scopeDimensionStore';

export class ScopeMembershipsService {
  private actorId(actor: ActorContext) {
    return Number(actor.userId || 0) || null;
  }

  private resolveDimension(raw: unknown): string {
    const key = String(raw || '').trim().toLowerCase();
    if (!key) {
      throw new HttpError(400, 'dimensionKey is required.');
    }
    if (getScopeDimension(key) || listScopeDimensions().some((item) => item.key === key)) {
      return key;
    }
    if (key === SCOPE_DIMENSION_ORG || key === SCOPE_DIMENSION_GEO || key in PRESET_SCOPE_DIMENSION_ROOTS) {
      return key;
    }
    throw new HttpError(400, `Unknown scope dimension: ${key}.`);
  }

  private rootForDimension(dimensionKey: string): string {
    const registered = getScopeDimension(dimensionKey);
    if (registered?.baseInfoRootId) {
      return registered.baseInfoRootId;
    }
    return SCOPE_DIMENSION_ROOT[dimensionKey]
      || PRESET_SCOPE_DIMENSION_ROOTS[dimensionKey]
      || (dimensionKey === SCOPE_DIMENSION_GEO ? GEO_BASE_INFO_ROOT_ID : ORG_BASE_INFO_ROOT_ID);
  }

  private async assertNodeInDimension(dimensionKey: string, nodeId: string) {
    const trimmed = String(nodeId || '').trim();
    if (!trimmed) {
      throw new HttpError(400, 'nodeId is required.');
    }
    const rootId = this.rootForDimension(dimensionKey);
    if (!isBaseInfoIdInSubtree(rootId, trimmed)) {
      throw new HttpError(400, `nodeId must belong to the ${dimensionKey} tree (${rootId}).`);
    }
    const exists = await findBaseInfoIdExists(trimmed);
    if (!exists) {
      throw new HttpError(404, `Node not found (${trimmed}).`);
    }
  }

  async list(_ctx: RequestDbContext, query: Record<string, unknown>) {
    const dimensionKey = this.resolveDimension(query.dimensionKey);
    const nodeId = String(query.nodeId || '').trim();
    const userIdRaw = query.userId;
    const userId = userIdRaw === undefined || userIdRaw === null || userIdRaw === ''
      ? null
      : Number(userIdRaw);

    if (nodeId) {
      await this.assertNodeInDimension(dimensionKey, nodeId);
      const items = await listScopeMembershipsByNode(dimensionKey, nodeId);
      return { body: { success: true as const, items } };
    }

    if (userId != null && Number.isFinite(userId) && userId > 0) {
      const items = await listScopeMembershipsByUser(dimensionKey, userId);
      return { body: { success: true as const, items } };
    }

    const items = await listScopeMembershipsByDimension(dimensionKey);
    return { body: { success: true as const, items } };
  }

  async listEvents(_ctx: RequestDbContext, query: Record<string, unknown>) {
    const dimensionKey = this.resolveDimension(query.dimensionKey);
    const nodeId = String(query.nodeId || '').trim();
    if (!nodeId) {
      throw new HttpError(400, 'nodeId is required.');
    }
    await this.assertNodeInDimension(dimensionKey, nodeId);
    const limitRaw = Number(query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
    const items = await listScopeMembershipEventsByNode(dimensionKey, nodeId, limit);
    return { body: { success: true as const, items } };
  }

  async create(_ctx: RequestDbContext, actor: ActorContext, payload: Record<string, unknown>) {
    const dimensionKey = this.resolveDimension(payload.dimensionKey);
    const nodeId = String(payload.nodeId || '').trim();
    const userId = Number(payload.userId);
    const actorId = this.actorId(actor);

    if (!Number.isFinite(userId) || userId <= 0) {
      throw new HttpError(400, 'userId is required.');
    }

    await this.assertNodeInDimension(dimensionKey, nodeId);
    if (!(await userExists(userId))) {
      throw new HttpError(404, 'User not found.');
    }

    const existing = await findScopeMembershipUnique(userId, dimensionKey, nodeId);
    if (existing) {
      throw new HttpError(409, 'This user is already assigned to that node.');
    }

    const item = await createScopeMembership({
      userId,
      dimensionKey,
      nodeId,
      actorId,
    });

    await createScopeMembershipEvent({
      dimensionKey,
      nodeId,
      userId,
      eventType: 'assigned',
      actorUserId: actorId,
    });

    return { statusCode: 201, body: { success: true as const, item } };
  }

  async remove(_ctx: RequestDbContext, actor: ActorContext, idRaw: string) {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) {
      throw new HttpError(400, 'id is required.');
    }
    const existing = await findScopeMembershipById(id);
    if (!existing) {
      throw new HttpError(404, 'Membership not found.');
    }
    const actorId = this.actorId(actor);
    await deleteScopeMembership(id);
    await createScopeMembershipEvent({
      dimensionKey: existing.dimensionKey,
      nodeId: existing.nodeId,
      userId: existing.userId,
      eventType: 'removed',
      actorUserId: actorId,
    });
    return { body: { success: true as const } };
  }

  async listRoles(_ctx: RequestDbContext, query: Record<string, unknown>) {
    const dimensionKey = this.resolveDimension(query.dimensionKey);
    const nodeId = String(query.nodeId || '').trim();
    if (!nodeId) {
      throw new HttpError(400, 'nodeId is required.');
    }
    await this.assertNodeInDimension(dimensionKey, nodeId);
    const items = await listScopeRoleMembershipsByNode(dimensionKey, nodeId);
    return { body: { success: true as const, items } };
  }

  async listRoleEvents(_ctx: RequestDbContext, query: Record<string, unknown>) {
    const dimensionKey = this.resolveDimension(query.dimensionKey);
    const nodeId = String(query.nodeId || '').trim();
    if (!nodeId) {
      throw new HttpError(400, 'nodeId is required.');
    }
    await this.assertNodeInDimension(dimensionKey, nodeId);
    const limitRaw = Number(query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
    const items = await listScopeRoleMembershipEventsByNode(dimensionKey, nodeId, limit);
    return { body: { success: true as const, items } };
  }

  async createRole(_ctx: RequestDbContext, actor: ActorContext, payload: Record<string, unknown>) {
    const dimensionKey = this.resolveDimension(payload.dimensionKey);
    const nodeId = String(payload.nodeId || '').trim();
    const roleName = String(payload.roleName || '').trim();
    const actorId = this.actorId(actor);

    if (!roleName) {
      throw new HttpError(400, 'roleName is required.');
    }

    await this.assertNodeInDimension(dimensionKey, nodeId);
    if (!(await roleExists(roleName))) {
      throw new HttpError(404, 'Role not found.');
    }

    const existing = await findScopeRoleMembershipUnique(roleName, dimensionKey, nodeId);
    if (existing) {
      throw new HttpError(409, 'This role is already assigned to that node.');
    }

    const item = await createScopeRoleMembership({
      roleName,
      dimensionKey,
      nodeId,
      actorId,
    });

    await createScopeRoleMembershipEvent({
      dimensionKey,
      nodeId,
      roleName,
      eventType: 'assigned',
      actorUserId: actorId,
    });

    const userIds = await listUserIdsForRole(roleName);
    await invalidateSessionContextForUsers(userIds);

    return { statusCode: 201, body: { success: true as const, item } };
  }

  async removeRole(_ctx: RequestDbContext, actor: ActorContext, idRaw: string) {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) {
      throw new HttpError(400, 'id is required.');
    }
    const existing = await findScopeRoleMembershipById(id);
    if (!existing) {
      throw new HttpError(404, 'Role membership not found.');
    }
    const actorId = this.actorId(actor);
    await deleteScopeRoleMembership(id);
    await createScopeRoleMembershipEvent({
      dimensionKey: existing.dimensionKey,
      nodeId: existing.nodeId,
      roleName: existing.roleName,
      eventType: 'removed',
      actorUserId: actorId,
    });
    const userIds = await listUserIdsForRole(existing.roleName);
    await invalidateSessionContextForUsers(userIds);
    return { body: { success: true as const } };
  }
}
