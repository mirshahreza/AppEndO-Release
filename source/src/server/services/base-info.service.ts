import {
  calculateBaseInfoHierarchicalId,
  deleteBaseInfoNode,
  findBaseInfoChildId,
  findBaseInfoDescendantCycle,
  findBaseInfoIdExists,
  findBaseInfoNodeById,
  getBaseInfoNodeForForm,
  insertBaseInfoNode,
  listBaseInfoChildrenRows,
  listBaseInfoChildSiblingIds,
  listBaseInfoOptionsRows,
  listBaseInfoRootSiblingIds,
  listBaseInfoTreeRows,
  renameBaseInfoSubtree,
  setBaseInfoActive,
  updateBaseInfoNode,
  updateBaseInfoSiblingOrder,
} from '../domain/base-info/treeRepository';
import { deleteScopeMembershipsByNodeId } from '../domain/scope-memberships/repository';
import { deleteScopeRoleMembershipsByNodeId } from '../domain/scope-memberships/roleRepository';
import { HttpError } from '../errors/HttpError';
import type { ActorContext, RequestDbContext } from '../types/requestContext';
import { resolveBaseInfoCultureIdFromQuery, toOptionalTrimmed } from '../utils/baseInfoHelpers';
import type { BaseInfoLocaleTexts } from '../../shared/lib/baseInfoCultureTranslations';
import {
  buildBaseInfoOptionsCacheKey,
  buildBaseInfoTreeCacheKey,
  invalidateBaseInfoOptionsCache,
  readCachedBaseInfoOptions,
  writeCachedBaseInfoOptions,
} from './baseInfoOptionsCache';

type ListQuery = {
  root?: unknown;
  includeInactive?: unknown;
  lang?: unknown;
};

type ChildrenQuery = ListQuery & {
  parentId?: unknown;
};

const parseLocalesPayload = (payload: Record<string, unknown>): BaseInfoLocaleTexts | undefined => {
  const raw = payload.locales;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const locales: BaseInfoLocaleTexts = {};
  for (const [cultureId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const entry = value as Record<string, unknown>;
    locales[cultureId] = {
      title: toOptionalTrimmed(entry.title),
      note: toOptionalTrimmed(entry.note),
    };
  }
  return Object.keys(locales).length > 0 ? locales : undefined;
};

export class BaseInfoService {
  private actorId(actor: ActorContext) {
    return Number(actor.userId || 0) || null;
  }

  async listOptions(_ctx: RequestDbContext, query: ListQuery) {
    const root = toOptionalTrimmed(query.root);
    const includeInactive = String(query.includeInactive || 'false') === 'true';
    const cultureId = resolveBaseInfoCultureIdFromQuery(query.lang ?? query.cultureId);
    const cacheKey = buildBaseInfoOptionsCacheKey({
      root,
      includeInactive,
      lang: cultureId,
    });
    const cachedItems = readCachedBaseInfoOptions(cacheKey);
    if (cachedItems) {
      return { body: { success: true as const, items: cachedItems } };
    }

    const activeClause = includeInactive ? '' : 'AND i.is_active = TRUE';
    const rootClause = root ? 'AND (i.id = ? OR i.parent_id = ?)' : '';
    const params = root ? [root, root] : [];
    const items = await listBaseInfoOptionsRows(cultureId, activeClause, rootClause, params);
    writeCachedBaseInfoOptions(cacheKey, items);

    return { body: { success: true as const, items } };
  }

  async listTree(_ctx: RequestDbContext, query: ListQuery) {
    const root = toOptionalTrimmed(query.root);
    const includeInactive = String(query.includeInactive || 'false') === 'true';
    const cultureId = resolveBaseInfoCultureIdFromQuery(query.lang ?? query.cultureId);
    const cacheKey = buildBaseInfoTreeCacheKey({
      root,
      includeInactive,
      lang: cultureId,
    });
    const cachedItems = readCachedBaseInfoOptions(cacheKey);
    if (cachedItems) {
      return { body: { success: true as const, items: cachedItems } };
    }

    const activeClause = includeInactive ? '' : 'AND n.is_active = TRUE';
    const rootClause = root ? 'AND (n.id = ? OR n.parent_id = ?)' : '';
    const params = root ? [root, root] : [];
    const items = await listBaseInfoTreeRows(cultureId, activeClause, rootClause, params);
    writeCachedBaseInfoOptions(cacheKey, items);

    return { body: { success: true as const, items } };
  }

  async listChildren(_ctx: RequestDbContext, query: ChildrenQuery) {
    const root = toOptionalTrimmed(query.root);
    const parentId = toOptionalTrimmed(query.parentId);
    const includeInactive = String(query.includeInactive || 'false') === 'true';
    const cultureId = resolveBaseInfoCultureIdFromQuery(query.lang ?? query.cultureId);
    const activeClause = includeInactive ? '' : 'AND n.is_active = TRUE';

    let whereClause = 'n.parent_id IS NULL';
    const params: unknown[] = [];

    if (parentId) {
      whereClause = 'n.parent_id = ?';
      params.push(parentId);
    } else if (root) {
      whereClause = 'n.id = ?';
      params.push(root);
    }

    const items = await listBaseInfoChildrenRows(cultureId, whereClause, activeClause, includeInactive, params);

    return { body: { success: true as const, items } };
  }

  /**
   * GET-one for edit forms. Body uses `items` as the record object so Designer
   * responseMapping `{ arrayPath/dataPath: 'items' }` hydrates a single object
   * (same key as list, but not an array).
   */
  async getNode(_ctx: RequestDbContext, id: string) {
    const trimmedId = String(id || '').trim();
    if (!trimmedId) {
      throw new HttpError(400, 'id is required.');
    }

    const item = await getBaseInfoNodeForForm(trimmedId);
    if (!item) {
      throw new HttpError(404, 'Node not found.');
    }

    return { body: { success: true as const, items: item } };
  }

  async createNode(_ctx: RequestDbContext, actor: ActorContext, payload: Record<string, unknown>) {
    const actorId = this.actorId(actor);
    const childDigits = Number(payload.childDigits || 3);
    const inserted = await insertBaseInfoNode([
      toOptionalTrimmed(payload.parentId),
      childDigits,
      toOptionalTrimmed(payload.title),
      toOptionalTrimmed(payload.shortName),
      payload.viewOrder === undefined || payload.viewOrder === null || payload.viewOrder === '' ? null : Number(payload.viewOrder),
      toOptionalTrimmed(payload.note),
      toOptionalTrimmed(payload.metadata),
      payload.value === undefined || payload.value === null || payload.value === '' ? null : Number(payload.value),
      payload.isActive === undefined ? true : Boolean(payload.isActive),
      toOptionalTrimmed(payload.uiColor),
      toOptionalTrimmed(payload.uiHtml),
      parseLocalesPayload(payload),
      actorId,
    ]);
    invalidateBaseInfoOptionsCache();

    return {
      statusCode: 201,
      body: { success: true as const, id: inserted?.id || null },
    };
  }

  async updateNode(_ctx: RequestDbContext, actor: ActorContext, id: string, payload: Record<string, unknown>) {
    const trimmedId = String(id || '').trim();
    if (!trimmedId) {
      throw new HttpError(400, 'id is required.');
    }

    const actorId = this.actorId(actor);
    await updateBaseInfoNode([
      toOptionalTrimmed(payload.title),
      toOptionalTrimmed(payload.shortName),
      payload.viewOrder === undefined || payload.viewOrder === null || payload.viewOrder === '' ? null : Number(payload.viewOrder),
      toOptionalTrimmed(payload.note),
      toOptionalTrimmed(payload.metadata),
      payload.value === undefined || payload.value === null || payload.value === '' ? null : Number(payload.value),
      payload.isActive === undefined ? true : Boolean(payload.isActive),
      toOptionalTrimmed(payload.uiColor),
      toOptionalTrimmed(payload.uiHtml),
      parseLocalesPayload(payload),
      actorId,
      trimmedId,
    ]);

    invalidateBaseInfoOptionsCache();
    return { body: { success: true as const } };
  }

  private async renameSubtree(_oldId: string, newId: string, nextParentId: string | null, actorId: number | null) {
    if (_oldId === newId) return;
    await renameBaseInfoSubtree([_oldId, newId, nextParentId, _oldId, actorId, _oldId, `${_oldId}.%`]);
  }

  private segmentLength(nodeId: string) {
    const segment = nodeId.includes('.') ? nodeId.slice(nodeId.lastIndexOf('.') + 1) : nodeId;
    return Math.max(1, segment.length);
  }

  async moveNode(_ctx: RequestDbContext, actor: ActorContext, id: string, payload: Record<string, unknown>) {
    const trimmedId = decodeURIComponent(String(id || '')).trim();
    if (!trimmedId) {
      throw new HttpError(400, 'id is required.');
    }

    const targetId = toOptionalTrimmed(payload.targetId);
    const positionRaw = String(payload.position || 'inside').toLowerCase();
    const position = (positionRaw === 'before' || positionRaw === 'after' || positionRaw === 'inside')
      ? positionRaw
      : null;
    const actorId = this.actorId(actor);

    if (!position) {
      throw new HttpError(400, 'position must be one of before, after, or inside.');
    }

    if (targetId && targetId === trimmedId) {
      throw new HttpError(400, 'A node cannot be moved relative to itself.');
    }

    const currentNode = await findBaseInfoNodeById(trimmedId);
    if (!currentNode) {
      throw new HttpError(404, `Node not found (${trimmedId}).`);
    }

    let targetNode: { id: string; parent_id: string | null } | null = null;
    if (targetId) {
      targetNode = await findBaseInfoNodeById(targetId);
      if (!targetNode) {
        throw new HttpError(400, `Target node does not exist (${targetId}).`);
      }
    }

    const effectivePosition: 'before' | 'after' | 'inside' = position;

    let nextParentId: string | null = null;

    if (!targetNode) {
      nextParentId = null;
    } else if (effectivePosition === 'inside') {
      nextParentId = targetNode.id;
    } else {
      nextParentId = targetNode.parent_id;
    }

    if (nextParentId && nextParentId === trimmedId) {
      throw new HttpError(400, 'A node cannot be moved under itself.');
    }

    if (nextParentId) {
      const hasCycle = await findBaseInfoDescendantCycle(trimmedId, nextParentId);

      if (hasCycle) {
        throw new HttpError(400, 'Cannot move a node under its own descendant.');
      }
    }

    let movedNodeId = trimmedId;
    const isReparent = currentNode.parent_id !== nextParentId;

    if (isReparent) {
      const sourceDigits = this.segmentLength(trimmedId);
      const nextIdRow = await calculateBaseInfoHierarchicalId(nextParentId, sourceDigits);
      const nextId = String(nextIdRow?.id || '').trim();
      if (!nextId) {
        throw new HttpError(500, 'Failed to generate a new hierarchical id for moved node.');
      }

      if (nextId !== movedNodeId) {
        await this.renameSubtree(movedNodeId, nextId, nextParentId, actorId);
        movedNodeId = nextId;
      }
    }

    const siblingRows = nextParentId === null
      ? await listBaseInfoRootSiblingIds()
      : await listBaseInfoChildSiblingIds(nextParentId);
    const siblings = siblingRows.map((row) => row.id).filter((rowId) => rowId !== movedNodeId);

    let insertIndex = 0;
    if (targetNode) {
      if (effectivePosition === 'inside') {
        insertIndex = siblings.length;
      } else {
        const targetIndex = siblings.findIndex((rowId) => rowId === targetNode!.id);
        if (targetIndex < 0) {
          throw new HttpError(400, 'Target node is not in destination sibling list.');
        }
        insertIndex = effectivePosition === 'before' ? targetIndex : targetIndex + 1;
      }
    } else {
      insertIndex = siblings.length;
    }

    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > siblings.length) insertIndex = siblings.length;

    siblings.splice(insertIndex, 0, movedNodeId);

    if (siblings.length > 0) {
      for (let i = 0; i < siblings.length; i += 1) {
        await updateBaseInfoSiblingOrder([nextParentId, (i + 1) * 10, actorId, siblings[i]]);
      }
    }

    invalidateBaseInfoOptionsCache();
    return { body: { success: true as const } };
  }

  async deleteNode(_ctx: RequestDbContext, id: string) {
    const trimmedId = String(id || '').trim();
    if (!trimmedId) {
      throw new HttpError(400, 'id is required.');
    }

    const exists = await findBaseInfoIdExists(trimmedId);
    if (!exists) {
      throw new HttpError(404, 'Node not found.');
    }

    const child = await findBaseInfoChildId(trimmedId);
    if (child) {
      throw new HttpError(400, 'Cannot delete a node that has children.');
    }

    await deleteBaseInfoNode(trimmedId);
    await deleteScopeMembershipsByNodeId(trimmedId);
    await deleteScopeRoleMembershipsByNodeId(trimmedId);
    invalidateBaseInfoOptionsCache();
    return { body: { success: true as const } };
  }

  async setActive(_ctx: RequestDbContext, actor: ActorContext, id: string, isActive: boolean) {
    const trimmedId = String(id || '').trim();
    const actorId = this.actorId(actor);
    await setBaseInfoActive(isActive, actorId, trimmedId);
    invalidateBaseInfoOptionsCache();
    return { body: { success: true as const } };
  }
}
