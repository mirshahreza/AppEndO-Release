import { findRoleById } from '../../domain/users/roleRepository';
import { findUserId } from '../../domain/users/userRepository';
import {
  deleteRoleAttributeValue,
  deleteUserAttributeValue,
  listRoleAttributeRows,
  listUserAttributeRows,
  listUserIdsByRoleName,
  upsertRoleAttributeValue,
  upsertUserAttributeValue,
  type SettingsAttributeWithValueRow,
} from '../../domain/attributes/valueRepository';
import { isSystemManagedUserAttributeKey } from '../../../shared/api/contracts/attributes/builtInAttributes';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from '../users/shared';
import { invalidateRoleAttributes, refreshRoleAttributesCache } from './roleAttributesCache';
import { invalidateSessionContext, invalidateSessionContextForUsers } from './sessionContextCache';
import { getSessionContextForUser } from './sessionContext.service';
import { getUserRolesForRequest } from '../../domain/users/userRoleRepository';
import {
  parseAttributeValuesPayload,
  parseStoredAttributeValue,
  serializeAttributeValue,
  validateAttributeValueForSettingsAttribute,
} from './valueValidation';

const normalizeNumericId = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const toResponseItem = (row: SettingsAttributeWithValueRow) => ({
  settingsAttribute: {
    id: normalizeNumericId(row.id),
    key: row.key,
    label: row.label,
    scope: row.scope,
    source_type: row.source_type,
    base_info_root_id: row.base_info_root_id,
    profile_field: row.profile_field,
    data_type: row.data_type,
    cardinality: row.cardinality,
    min_selections: row.min_selections,
    max_selections: row.max_selections,
    visibility: row.visibility,
    is_required: row.is_required,
    is_active: row.is_active,
    user_editable: row.user_editable,
    user_edit_policy: row.user_edit_policy,
    view_order: row.view_order,
  },
  value_id: row.value_id === null || row.value_id === undefined ? null : normalizeNumericId(row.value_id),
  value: parseStoredAttributeValue(row.value_text),
});

const buildSettingsAttributeMap = (rows: SettingsAttributeWithValueRow[]) => {
  const map = new Map<number, SettingsAttributeWithValueRow>();
  for (const row of rows) {
    const settingsAttributeId = normalizeNumericId(row.id);
    if (settingsAttributeId > 0) {
      map.set(settingsAttributeId, row);
    }
  }
  return map;
};

const wrapValidationError = async <T>(action: () => Promise<T>): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid attribute value.');
  }
};

const parseValuesPayload = (payload: unknown) => {
  try {
    return parseAttributeValuesPayload(payload);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid attributes payload.');
  }
};

export async function getUserAttributes(userId: number) {
  const user = await findUserId(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const rows = await listUserAttributeRows(userId);
  return {
    body: {
      success: true as const,
      user_id: userId,
      items: rows.map(toResponseItem),
    },
  };
}

export async function updateUserAttributes(
  actor: ActorContext,
  userId: number,
  payload: unknown,
) {
  const user = await findUserId(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const inputs = parseValuesPayload(payload);
  const rows = await listUserAttributeRows(userId);
  const settingsAttributeMap = buildSettingsAttributeMap(rows);
  const currentActorId = actorId(actor);

  for (const input of inputs) {
    const settingsAttribute = settingsAttributeMap.get(input.settingsAttributeId);
    if (!settingsAttribute) {
      throw new HttpError(400, `Settings attribute ${input.settingsAttributeId} is not valid for USER scope.`);
    }
    if (isSystemManagedUserAttributeKey(settingsAttribute.key)) {
      throw new HttpError(403, `Settings attribute "${settingsAttribute.key}" is managed by the system.`);
    }

    const normalizedValue = await wrapValidationError(() =>
      validateAttributeValueForSettingsAttribute(settingsAttribute, input.value),
    );
    if (normalizedValue === null) {
      await deleteUserAttributeValue(input.settingsAttributeId, userId);
    } else {
      await upsertUserAttributeValue(
        input.settingsAttributeId,
        userId,
        serializeAttributeValue(normalizedValue),
        currentActorId,
      );
    }
  }

  await invalidateSessionContext(userId);

  return { body: { success: true as const } };
}

export async function getUserSessionPreview(userId: number) {
  const user = await findUserId(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const roles = await getUserRolesForRequest(userId);
  const context = await getSessionContextForUser(userId, undefined, roles);
  return {
    body: {
      success: true as const,
      user_id: userId,
      roles,
      serverContext: context.serverContext,
      clientContext: context.clientContext,
    },
  };
}

export async function getRoleAttributes(roleId: number) {
  const role = await findRoleById(roleId);
  if (!role) {
    throw new HttpError(404, 'Role not found.');
  }

  const rows = await listRoleAttributeRows(role.name);
  return {
    body: {
      success: true as const,
      role_id: roleId,
      role_name: role.name,
      items: rows.map(toResponseItem),
    },
  };
}

export async function updateRoleAttributes(
  actor: ActorContext,
  roleId: number,
  payload: unknown,
) {
  const role = await findRoleById(roleId);
  if (!role) {
    throw new HttpError(404, 'Role not found.');
  }

  const inputs = parseValuesPayload(payload);
  const rows = await listRoleAttributeRows(role.name);
  const settingsAttributeMap = buildSettingsAttributeMap(rows);
  const currentActorId = actorId(actor);

  for (const input of inputs) {
    const settingsAttribute = settingsAttributeMap.get(input.settingsAttributeId);
    if (!settingsAttribute) {
      throw new HttpError(400, `Settings attribute ${input.settingsAttributeId} is not valid for ROLE scope.`);
    }

    const normalizedValue = await wrapValidationError(() =>
      validateAttributeValueForSettingsAttribute(settingsAttribute, input.value),
    );
    if (normalizedValue === null) {
      await deleteRoleAttributeValue(input.settingsAttributeId, role.name);
    } else {
      await upsertRoleAttributeValue(
        input.settingsAttributeId,
        role.name,
        serializeAttributeValue(normalizedValue),
        currentActorId,
      );
    }
  }

  await invalidateRoleAttributes(role.name);
  await refreshRoleAttributesCache(role.name);

  const userIds = await listUserIdsByRoleName(role.name);
  await invalidateSessionContextForUsers(userIds);

  return { body: { success: true as const } };
}
