import { HttpError } from '../errors/HttpError';
import {
  validateRecordPolicyPredicate,
  removePolicyFromTree,
  type RecordPolicyAction,
} from '../../shared/api/contracts/record-policy';
import {
  getScopeDimension,
  listScopeDimensions,
} from './record-policy/scopeDimensionStore';
import {
  deleteRecordPolicy,
  enforceSingleEnabledPolicyForModel,
  getRecordPolicyById,
  listRecordPolicies,
  listRecordPoliciesForModel,
  saveRecordPolicy,
} from './record-policy/recordPolicyStore';
import {
  deleteRecordPolicyBinding,
  getRecordPolicyBindingOrDefault,
  saveRecordPolicyBinding,
} from './record-policy/recordPolicyBindingStore';
import { getEdgeModelById } from './data-api/edgeModelStore';
import type { Request } from 'express';
import { getSessionContextForUser } from './attributes/sessionContext.service';
import { resolveSessionScope } from './record-policy/sessionScope.service';
import { explainRecordAccess } from './record-policy/explainAccess.service';
import { hasAdminRole, normalizeAuthRoles } from '../middleware/auth.middleware';

const asString = (value: unknown): string => String(value ?? '').trim();

export class RecordPolicyAdminService {
  listDimensions() {
    return { body: { success: true as const, items: listScopeDimensions() } };
  }

  getDimension(key: string) {
    const dimension = getScopeDimension(asString(key));
    if (!dimension) {
      throw new HttpError(404, 'Scope dimension not found.');
    }
    return { body: { success: true as const, item: dimension } };
  }

  listPolicies(edgeModelId?: string) {
    const items = edgeModelId
      ? listRecordPoliciesForModel(asString(edgeModelId))
      : listRecordPolicies();
    return { body: { success: true as const, items } };
  }

  getPolicy(id: string) {
    const item = getRecordPolicyById(asString(id));
    if (!item) {
      throw new HttpError(404, 'Record policy not found.');
    }
    return { body: { success: true as const, item } };
  }

  savePolicy(body: Record<string, unknown>) {
    const edgeModelId = asString(body.edgeModelId);
    const model = getEdgeModelById(edgeModelId);
    if (!model) {
      throw new HttpError(404, 'Edge model not found.');
    }
    const allowedFields = model.columns.map((column) => column.field);
    const binding = getRecordPolicyBindingOrDefault(edgeModelId);
    const validated = validateRecordPolicyPredicate({
      predicate: body.predicate,
      allowedFields,
      ...(binding.allowedUserAttrKeys.length > 0
        ? { allowedUserAttrKeys: binding.allowedUserAttrKeys }
        : {}),
    });
    if (!validated.ok) {
      throw new HttpError(400, validated.issues[0]?.message ?? 'Invalid predicate.');
    }
    try {
      const item = saveRecordPolicy({ ...body, predicate: validated.predicate, effect: 'allow' });
      return { body: { success: true as const, item }, statusCode: 200 };
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid record policy.');
    }
  }

  removePolicy(id: string) {
    const existing = getRecordPolicyById(asString(id));
    const ok = deleteRecordPolicy(asString(id));
    if (!ok) {
      throw new HttpError(404, 'Record policy not found.');
    }
    if (existing) {
      const remaining = listRecordPoliciesForModel(existing.edgeModelId);
      const current = getRecordPolicyBindingOrDefault(existing.edgeModelId);
      const tree = removePolicyFromTree(
        current.policyTree,
        existing.id,
        remaining.map((policy) => policy.id),
      );
      saveRecordPolicyBinding({ ...current, policyTree: tree });
      if (remaining.length > 0) {
        enforceSingleEnabledPolicyForModel(existing.edgeModelId);
      }
    }
    return { body: { success: true as const } };
  }

  getBinding(edgeModelId: string) {
    const item = getRecordPolicyBindingOrDefault(asString(edgeModelId));
    return { body: { success: true as const, item } };
  }

  saveBinding(body: Record<string, unknown>) {
    const edgeModelId = asString(body.edgeModelId);
    if (!getEdgeModelById(edgeModelId)) {
      throw new HttpError(404, 'Edge model not found.');
    }
    try {
      const item = saveRecordPolicyBinding(body);
      return { body: { success: true as const, item } };
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid binding.');
    }
  }

  removeBinding(edgeModelId: string) {
    deleteRecordPolicyBinding(asString(edgeModelId));
    return { body: { success: true as const } };
  }

  async explain(req: Request, edgeModelIdRaw: string, actionRaw: string) {
    const edgeModelId = asString(edgeModelIdRaw);
    if (!edgeModelId) {
      throw new HttpError(400, 'edgeModelId is required.');
    }
    const userId = Number(req.auth?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new HttpError(401, 'Authentication required.');
    }
    const roles = normalizeAuthRoles(req);
    const sessionContext = await getSessionContextForUser(userId, roles[0]);
    const session = await resolveSessionScope({
      userId,
      roles: roles.length > 0 ? roles : ['USER'],
      isAdmin: hasAdminRole(req),
      email: req.auth?.email ?? null,
      serverContext: sessionContext.serverContext as Record<string, unknown>,
    });
    const action = (asString(actionRaw) || 'list') as RecordPolicyAction;
    const item = explainRecordAccess({ edgeModelId, action, session });
    return { body: { success: true as const, item } };
  }
}
