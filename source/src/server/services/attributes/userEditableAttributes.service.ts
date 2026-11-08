import {
  deleteUserAttributeValue,
  listUserEditableAttributeRows,
  upsertUserAttributeValue,
  type SettingsAttributeWithValueRow,
} from '../../domain/attributes/valueRepository';
import { HttpError } from '../../errors/HttpError';
import { isFieldCurrentlyEditable } from '../../../shared/api/contracts/attributes/editPolicy';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from '../users/shared';
import { invalidateSessionContext } from './sessionContextCache';
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

const toResponseItem = (row: SettingsAttributeWithValueRow, value: unknown) => ({
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
  value,
  isCurrentlyEditable: isFieldCurrentlyEditable(row.user_edit_policy, value),
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

export async function getMyEditableAttributes(userId: number) {
  const storedRows = await listUserEditableAttributeRows(userId);
  const items = storedRows
    .map((row) => toResponseItem(row, parseStoredAttributeValue(row.value_text)))
    .sort((left, right) => {
      const orderDiff = left.settingsAttribute.view_order - right.settingsAttribute.view_order;
      if (orderDiff !== 0) return orderDiff;
      return left.settingsAttribute.key.localeCompare(right.settingsAttribute.key);
    });

  return {
    body: {
      success: true as const,
      user_id: userId,
      items,
    },
  };
}

export async function updateMyEditableAttributes(
  actor: ActorContext,
  userId: number,
  payload: unknown,
) {
  const inputs = (() => {
    try {
      return parseAttributeValuesPayload(payload);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid attributes payload.');
    }
  })();

  const storedRows = await listUserEditableAttributeRows(userId);
  const settingsAttributeMap = buildSettingsAttributeMap(storedRows);
  const currentActorId = actorId(actor);

  for (const input of inputs) {
    const settingsAttribute = settingsAttributeMap.get(input.settingsAttributeId);
    if (!settingsAttribute) {
      throw new HttpError(403, `Settings attribute ${input.settingsAttributeId} is not editable by the current user.`);
    }

    const currentValue = parseStoredAttributeValue(settingsAttribute.value_text);
    if (!isFieldCurrentlyEditable(settingsAttribute.user_edit_policy, currentValue)) {
      throw new HttpError(403, `Settings attribute ${input.settingsAttributeId} cannot be edited in its current state.`);
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
