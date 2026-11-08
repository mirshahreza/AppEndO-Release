import {
  listProfileFieldSettingRows,
  upsertProfileFieldSetting,
} from '../../domain/profile/profileFieldSettingsRepository';
import { HttpError } from '../../errors/HttpError';
import {
  DEFAULT_ATTRIBUTE_USER_EDIT_POLICY,
  normalizeUserEditPolicy,
} from '../../../shared/api/contracts/attributes/editPolicy';
import type { ProfileFieldSettingRecord, UpdateProfileFieldSettingsPayload } from '../../../shared/api/contracts/profile/profileFieldSettings';
import type { ProfileFieldDefinition } from '../../../shared/profile/profileFieldRegistry';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from '../users/shared';
import { invalidateAllSessionContexts } from '../attributes/sessionContextCache';
import {
  getProfileFieldLabel,
  loadConfigurableProfileFields,
} from '../attributes/profileFields';

const toSettingRecord = (
  definition: ProfileFieldDefinition,
  row: Awaited<ReturnType<typeof listProfileFieldSettingRows>>[number] | null,
  viewOrder: number,
): ProfileFieldSettingRecord => ({
  profileField: definition.profileField,
  profileFieldLabel: definition.label || getProfileFieldLabel(definition.profileField),
  labelEn: row?.label_en ?? definition.label ?? getProfileFieldLabel(definition.profileField),
  isActive: row?.is_active ?? false,
  userEditPolicy: row?.user_edit_policy ?? DEFAULT_ATTRIBUTE_USER_EDIT_POLICY,
  viewOrder: row ? Number(row.view_order ?? viewOrder) : viewOrder,
});

export async function listProfileFieldSettings() {
  const [configurableFields, rows] = await Promise.all([
    loadConfigurableProfileFields(),
    listProfileFieldSettingRows(),
  ]);
  const rowByField = new Map(rows.map((row) => [row.profile_field, row]));

  const items = configurableFields.map((definition, index) =>
    toSettingRecord(definition, rowByField.get(definition.profileField) ?? null, definition.viewOrder ?? index * 10),
  );

  return {
    body: {
      success: true as const,
      items,
    },
  };
}

const parseSettingsPayload = async (payload: unknown): Promise<UpdateProfileFieldSettingsPayload['items']> => {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) {
    throw new HttpError(400, 'items array is required.');
  }

  const items = (payload as { items: unknown[] }).items;
  if (items.length === 0) {
    throw new HttpError(400, 'At least one profile field item is required.');
  }

  const allowedFields = new Set(await loadConfigurableProfileFields().then((fields) => fields.map((field) => field.profileField)));
  const seen = new Set<string>();
  const parsed: UpdateProfileFieldSettingsPayload['items'] = [];

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object') {
      throw new HttpError(400, 'Each profile field item must be an object.');
    }

    const item = rawItem as Record<string, unknown>;
    const profileField = String(item.profileField ?? item.profile_field ?? '').trim();
    if (!allowedFields.has(profileField)) {
      throw new HttpError(400, `profileField "${profileField}" is not allowed.`);
    }
    if (seen.has(profileField)) {
      throw new HttpError(400, `Duplicate profileField "${profileField}".`);
    }
    seen.add(profileField);

    parsed.push({
      profileField,
      isActive: item.isActive === true || item.is_active === true || item.isActive === 'true' || item.is_active === 'true',
      userEditPolicy: normalizeUserEditPolicy(
        item.userEditPolicy ?? item.user_edit_policy,
        DEFAULT_ATTRIBUTE_USER_EDIT_POLICY,
      ),
      labelEn: typeof item.labelEn === 'string'
        ? item.labelEn.trim() || null
        : typeof item.label_en === 'string'
          ? item.label_en.trim() || null
          : null,
    });
  }

  return parsed;
};

export async function saveProfileFieldSettings(actor: ActorContext, payload: unknown) {
  const [items, configurableFields] = await Promise.all([
    parseSettingsPayload(payload),
    loadConfigurableProfileFields(),
  ]);
  const labelByField = new Map(configurableFields.map((field) => [field.profileField, field.label]));
  const existingRows = await listProfileFieldSettingRows();
  const existingByField = new Map(existingRows.map((row) => [row.profile_field, row]));
  const currentActorId = actorId(actor);
  let settingsChanged = false;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const profileField = item.profileField;
    const existing = existingByField.get(profileField) ?? null;
    const labelEn = item.labelEn ?? labelByField.get(profileField) ?? getProfileFieldLabel(profileField);
    const viewOrder = configurableFields.find((field) => field.profileField === profileField)?.viewOrder ?? index * 10;

    if (!item.isActive && !existing) {
      continue;
    }

    await upsertProfileFieldSetting({
      profileField,
      contextKey: existing?.context_key ?? profileField,
      labelEn,
      isActive: item.isActive,
      userEditPolicy: item.userEditPolicy,
      visibility: existing?.visibility ?? 'BOTH',
      viewOrder,
    }, currentActorId);

    settingsChanged = true;
  }

  if (settingsChanged) {
    await invalidateAllSessionContexts();
  }

  return listProfileFieldSettings();
}
