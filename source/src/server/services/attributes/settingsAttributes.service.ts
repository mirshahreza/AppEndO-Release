import {
  deleteSettingsAttribute,
  findSettingsAttributeById,
  findSettingsAttributeKeyConflict,
  insertSettingsAttribute,
  listSettingsAttributeRows,
  reorderSettingsAttributes,
  updateSettingsAttribute,
  type SettingsAttributeRow,
  type SettingsAttributeWriteInput,
} from '../../domain/attributes/settingsAttributesRepository';
import {
  countRoleValuesForSettingsAttribute,
  countUserValuesForSettingsAttribute,
  listUserIdsAffectedBySettingsAttribute,
} from '../../domain/attributes/valueRepository';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { ensureBaseInfoRoot } from '../../utils/baseInfoValidation';
import { actorId } from '../users/shared';
import { invalidateAllRoleAttributes, preloadAllRoleAttributesCache } from './roleAttributesCache';
import { invalidateSessionContextForUsers } from './sessionContextCache';
import {
  normalizeAttributeScope,
  validateSettingsAttributePayload,
  type SettingsAttributePayload,
  type AttributeScope,
} from './settingsAttributesValidation';
import {
  removeAttributeLabelTranslation,
  renameAttributeLabelTranslation,
  upsertAttributeLabelTranslation,
} from '../platform/attributeLabelTranslations.service';

const toWriteInput = (
  normalized: ReturnType<typeof validateSettingsAttributePayload>,
): SettingsAttributeWriteInput => ({
  key: normalized.key,
  label: normalized.label,
  scope: normalized.scope,
  sourceType: normalized.sourceType,
  baseInfoRootId: normalized.baseInfoRootId,
  profileField: normalized.profileField,
  dataType: normalized.dataType,
  cardinality: normalized.cardinality,
  minSelections: normalized.minSelections,
  maxSelections: normalized.maxSelections,
  visibility: normalized.visibility,
  isRequired: normalized.isRequired,
  isActive: normalized.isActive,
  userEditable: normalized.userEditable,
  userEditPolicy: normalized.userEditPolicy,
  viewOrder: normalized.viewOrder,
});

const assertUniqueKey = async (scope: AttributeScope, key: string, excludeId = 0) => {
  const conflict = await findSettingsAttributeKeyConflict(scope, key, excludeId);
  if (conflict) {
    throw new HttpError(400, `key "${key}" already exists for scope ${scope}.`);
  }
};

const validateAsyncRules = async (
  normalized: ReturnType<typeof validateSettingsAttributePayload>,
) => {
  if (normalized.sourceType === 'BASE_INFO') {
    try {
      await ensureBaseInfoRoot(normalized.baseInfoRootId, 'baseInfoRootId');
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'baseInfoRootId is invalid.');
    }
  }
};

const applyBuiltinUpdateGuards = (
  current: SettingsAttributeRow,
  normalized: ReturnType<typeof validateSettingsAttributePayload>,
) => {
  if (!current.is_builtin) {
    return normalized;
  }

  return {
    ...normalized,
    key: current.key,
    scope: current.scope,
    sourceType: current.source_type,
    baseInfoRootId: current.base_info_root_id,
    profileField: current.profile_field,
    dataType: current.data_type,
    isActive: true,
  };
};

const invalidateSettingsAttributeSessionCache = async (settingsAttributeId: number) => {
  const settingsAttribute = await findSettingsAttributeById(settingsAttributeId);
  const userIds = await listUserIdsAffectedBySettingsAttribute(settingsAttributeId);
  await invalidateSessionContextForUsers(userIds);

  if (settingsAttribute?.scope === 'ROLE') {
    await invalidateAllRoleAttributes();
    await preloadAllRoleAttributesCache();
  }
};

export async function listSettingsAttributes(scopeValue: unknown) {
  const scope = normalizeAttributeScope(scopeValue);
  if (!scope) {
    throw new HttpError(400, 'scope must be USER or ROLE.');
  }

  const items = await listSettingsAttributeRows(scope);
  return { body: { success: true as const, items } };
}

export async function createSettingsAttribute(
  actor: ActorContext,
  payload: SettingsAttributePayload,
) {
  const normalized = validateSettingsAttributePayload(payload, { requireScope: true });
  await validateAsyncRules(normalized);
  await assertUniqueKey(normalized.scope, normalized.key);

  const currentActorId = actorId(actor);
  const id = await insertSettingsAttribute(toWriteInput(normalized), currentActorId);
  upsertAttributeLabelTranslation(normalized.key, normalized.label || normalized.key);

  if (normalized.scope === 'ROLE') {
    await invalidateAllRoleAttributes();
    await preloadAllRoleAttributesCache();
  }

  return { statusCode: 201, body: { success: true as const, id } };
}

export async function updateSettingsAttributeRecord(
  actor: ActorContext,
  settingsAttributeId: number,
  payload: SettingsAttributePayload,
) {
  const current = await findSettingsAttributeById(settingsAttributeId);
  if (!current) {
    throw new HttpError(404, 'Settings attribute not found.');
  }

  const normalized = applyBuiltinUpdateGuards(
    current,
    validateSettingsAttributePayload(
      { ...payload, scope: current.scope, key: payload.key ?? current.key },
      { scope: current.scope },
    ),
  );
  await validateAsyncRules(normalized);
  await assertUniqueKey(normalized.scope, normalized.key, settingsAttributeId);

  const currentActorId = actorId(actor);
  await updateSettingsAttribute(settingsAttributeId, toWriteInput(normalized), currentActorId);
  renameAttributeLabelTranslation(
    current.key,
    normalized.key,
    normalized.label || normalized.key,
  );
  await invalidateSettingsAttributeSessionCache(settingsAttributeId);

  return { body: { success: true as const } };
}

export async function reorderSettingsAttributeRecords(
  actor: ActorContext,
  scopeValue: unknown,
  orderedIdsValue: unknown,
) {
  const scope = normalizeAttributeScope(scopeValue);
  if (!scope) {
    throw new HttpError(400, 'scope must be USER or ROLE.');
  }

  if (!Array.isArray(orderedIdsValue) || orderedIdsValue.length === 0) {
    throw new HttpError(400, 'orderedIds must be a non-empty array.');
  }

  const orderedIds = orderedIdsValue.map((value) => Number(value));
  if (orderedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new HttpError(400, 'orderedIds must contain positive integers.');
  }

  const existing = await listSettingsAttributeRows(scope);
  const existingIds = new Set(existing.map((row) => Number(row.id)));
  if (orderedIds.length !== existing.length) {
    throw new HttpError(400, 'orderedIds must include every settings attribute for the scope.');
  }

  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    throw new HttpError(400, 'orderedIds must not contain duplicates.');
  }

  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw new HttpError(400, `Settings attribute #${id} was not found for scope ${scope}.`);
    }
  }

  const currentActorId = actorId(actor);
  await reorderSettingsAttributes(scope, orderedIds, currentActorId);

  if (scope === 'ROLE') {
    await invalidateAllRoleAttributes();
    await preloadAllRoleAttributesCache();
  }

  return { body: { success: true as const } };
}

export async function deleteSettingsAttributeRecord(settingsAttributeId: number) {
  const current = await findSettingsAttributeById(settingsAttributeId);
  if (!current) {
    throw new HttpError(404, 'Settings attribute not found.');
  }

  if (current.is_builtin) {
    throw new HttpError(400, 'Built-in settings attributes cannot be deleted.');
  }

  const userCount = await countUserValuesForSettingsAttribute(settingsAttributeId);
  const roleCount = await countRoleValuesForSettingsAttribute(settingsAttributeId);
  if (userCount > 0 || roleCount > 0) {
    throw new HttpError(400, 'Cannot delete settings attribute while values exist.');
  }

  await deleteSettingsAttribute(settingsAttributeId, current.scope);
  removeAttributeLabelTranslation(current.key);
  await invalidateSettingsAttributeSessionCache(settingsAttributeId);

  return { body: { success: true as const } };
}
