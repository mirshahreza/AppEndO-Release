import { getUserProfileContextRow } from '../../domain/attributes/valueRepository';
import { listEditableProfileFieldSettingRows } from '../../domain/profile/profileFieldSettingsRepository';
import { HttpError } from '../../errors/HttpError';
import { isFieldCurrentlyEditable } from '../../../shared/api/contracts/attributes/editPolicy';
import type {
  ProfileFieldDataType,
  ProfileFieldValueItem,
  UpdateProfileFieldValuesPayload,
} from '../../../shared/api/contracts/profile/profileFieldSettings';
import type { ActorContext } from '../../types/requestContext';
import {
  BASE_INFO_ROOT_GENDER,
  BASE_INFO_ROOT_PERSON_TYPE,
  encodeBufferBase64,
  normalizeBirthDay,
  normalizeBirthMonth,
  normalizeBirthYear,
  normalizeNationalCode,
  normalizeProfilePayload,
  toOptionalTrimmed,
} from '../../utils/profilePayload';
import { actorId } from '../users/shared';
import { patchOrInsertUserProfileColumns, upsertUserProfile } from '../users/userProfile.service';
import type { ProfileColumnPatch } from '../../domain/users/userProfileRepository';
import { invalidateSessionContextIfProfileFieldsChanged } from '../attributes/profileInvalidation';
import { invalidateSessionContext } from '../attributes/sessionContextCache';
import {
  isAllowedProfileField,
  loadConfigurableProfileFields,
  type AllowedProfileField,
} from '../attributes/profileFields';

type ProfileImageFieldValue = {
  hasImage: boolean;
  mime: string | null;
  previewBase64: string | null;
};

const PROFILE_FIELD_PAYLOAD_KEY: Record<AllowedProfileField, string> = {
  profile_image: 'profileImageBody',
  firstname: 'firstName',
  lastname: 'lastName',
  fathername: 'fatherName',
  grandfathername: 'grandfatherName',
  phone: 'phone',
  nickname: 'nickname',
  national_code: 'nationalCode',
  birth_year: 'birthYear',
  birth_month: 'birthMonth',
  birth_day: 'birthDay',
  gender_code: 'genderCode',
  person_type_code: 'personTypeCode',
  company_name: 'companyName',
  registration_number: 'registrationNumber',
  website: 'website',
};

const toDataType = (profileField: AllowedProfileField): ProfileFieldDataType => {
  if (profileField === 'profile_image') return 'image';
  if (profileField === 'gender_code' || profileField === 'person_type_code') return 'base_info_code';
  return 'string';
};

const getFieldLabel = (row: { label_en: string | null }, profileField: AllowedProfileField): string =>
  row.label_en?.trim() || profileField;

const readProfileImageFieldValue = (
  profileRow: Awaited<ReturnType<typeof getUserProfileContextRow>>,
): ProfileImageFieldValue => {
  const mimeValue = profileRow?.profile_image_mime;
  return {
    hasImage: Boolean(profileRow?.profile_image),
    mime: typeof mimeValue === 'string' ? mimeValue : null,
    previewBase64: encodeBufferBase64(profileRow?.profile_image_body_xs ?? null),
  };
};

const readProfileFieldValue = (
  profileRow: Awaited<ReturnType<typeof getUserProfileContextRow>>,
  profileField: AllowedProfileField,
): unknown => {
  if (!profileRow) return null;
  if (profileField === 'profile_image') {
    return readProfileImageFieldValue(profileRow);
  }
  return profileRow[profileField] ?? null;
};

const PROFILE_IMAGE_PAYLOAD_KEYS = [
  'profileImageBody',
  'profile_image_body',
  'profileImageBodyXs',
  'profile_image_body_xs',
  'profileImageMime',
  'profile_image_mime',
] as const;

const hasProfileImagePayloadKeys = (value: Record<string, unknown>): boolean =>
  PROFILE_IMAGE_PAYLOAD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));

const normalizeProfileImageFieldUpdate = (value: unknown) => {
  if (value === null) {
    return normalizeProfilePayload({
      profileImageBody: null,
      profileImageBodyXs: null,
      profileImageMime: null,
    });
  }

  if (!value || typeof value !== 'object') {
    throw new HttpError(400, 'profile_image value must be an object or null.');
  }

  const fieldValue = value as Record<string, unknown>;
  if (!hasProfileImagePayloadKeys(fieldValue)) {
    return null;
  }

  return normalizeProfilePayload({
    profileImageBody: fieldValue.profileImageBody ?? fieldValue.profile_image_body,
    profileImageBodyXs: fieldValue.profileImageBodyXs ?? fieldValue.profile_image_body_xs,
    profileImageMime: fieldValue.profileImageMime ?? fieldValue.profile_image_mime,
  });
};

const normalizeEditableProfileFieldValue = (
  profileField: AllowedProfileField,
  value: unknown,
): string | null => {
  switch (profileField) {
    case 'national_code':
      return normalizeNationalCode(value);
    case 'birth_year':
      return normalizeBirthYear(value);
    case 'birth_month':
      return normalizeBirthMonth(value);
    case 'birth_day':
      return normalizeBirthDay(value);
    default:
      return toOptionalTrimmed(value);
  }
};

export async function getMyEditableProfileFields(userId: number) {
  await loadConfigurableProfileFields();
  const [settingsRows, profileRow] = await Promise.all([
    listEditableProfileFieldSettingRows(),
    getUserProfileContextRow(userId),
  ]);

  const items: ProfileFieldValueItem[] = settingsRows.map((row) => {
    const profileField = row.profile_field as AllowedProfileField;
    const value = readProfileFieldValue(profileRow, profileField);
    const editabilityValue = profileField === 'profile_image'
      ? (value as ProfileImageFieldValue | null)?.hasImage ?? false
      : value;

    return {
      profileField,
      label: getFieldLabel(row, profileField),
      dataType: toDataType(profileField),
      value,
      isCurrentlyEditable: isFieldCurrentlyEditable(row.user_edit_policy, editabilityValue),
    };
  });

  return {
    body: {
      success: true as const,
      user_id: userId,
      items,
    },
  };
}

const parseProfileFieldsPayload = async (payload: unknown): Promise<UpdateProfileFieldValuesPayload['fields']> => {
  await loadConfigurableProfileFields();
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { fields?: unknown }).fields)) {
    throw new HttpError(400, 'fields array is required.');
  }

  const fields = (payload as { fields: unknown[] }).fields;
  if (fields.length === 0) {
    throw new HttpError(400, 'At least one profile field is required.');
  }

  const parsed: UpdateProfileFieldValuesPayload['fields'] = [];

  for (const rawField of fields) {
    if (!rawField || typeof rawField !== 'object') {
      throw new HttpError(400, 'Each profile field entry must be an object.');
    }

    const field = rawField as Record<string, unknown>;
    const profileField = String(field.profileField ?? field.profile_field ?? '').trim();
    if (!isAllowedProfileField(profileField)) {
      throw new HttpError(400, `profileField "${profileField}" is not allowed.`);
    }

    parsed.push({
      profileField,
      value: field.value ?? null,
    });
  }

  return parsed;
};

export async function updateMyEditableProfileFields(
  actor: ActorContext,
  userId: number,
  payload: unknown,
) {
  const inputs = await parseProfileFieldsPayload(payload);
  const [settingsRows, profileRow] = await Promise.all([
    listEditableProfileFieldSettingRows(),
    getUserProfileContextRow(userId),
  ]);

  const settingsByField = new Map(settingsRows.map((row) => [row.profile_field, row]));
  const columnPatch: ProfileColumnPatch = {};
  const invalidationPayload: Record<string, unknown> = {};
  let profileImagePayload: ReturnType<typeof normalizeProfilePayload> | null = null;
  let profileFieldsTouched = false;
  const currentActorId = actorId(actor);

  for (const input of inputs) {
    const settings = settingsByField.get(input.profileField);
    if (!settings) {
      throw new HttpError(403, `Profile field "${input.profileField}" is not editable by the current user.`);
    }

    const profileField = input.profileField as AllowedProfileField;
    const currentValue = readProfileFieldValue(profileRow, profileField);
    const editabilityValue = profileField === 'profile_image'
      ? (currentValue as ProfileImageFieldValue | null)?.hasImage ?? false
      : currentValue;
    if (!isFieldCurrentlyEditable(settings.user_edit_policy, editabilityValue)) {
      throw new HttpError(403, `Profile field "${input.profileField}" cannot be edited in its current state.`);
    }

    if (profileField === 'profile_image') {
      const normalizedImage = normalizeProfileImageFieldUpdate(input.value);
      if (normalizedImage) {
        profileImagePayload = normalizedImage;
        invalidationPayload.profileImageBody = normalizedImage.profileImageBody;
        invalidationPayload.profileImageBodyXs = normalizedImage.profileImageBodyXs;
        invalidationPayload.profileImageMime = normalizedImage.profileImageMime;
        profileFieldsTouched = true;
      }
      continue;
    }

    const normalizedValue = normalizeEditableProfileFieldValue(profileField, input.value);
    if (profileField === 'gender_code' && normalizedValue) {
      await ensureBaseInfoCode(normalizedValue, BASE_INFO_ROOT_GENDER, 'genderCode');
    }
    if (profileField === 'person_type_code') {
      const existingCode = typeof profileRow?.person_type_code === 'string'
        ? profileRow.person_type_code.trim()
        : '';
      const nextCode = typeof normalizedValue === 'string' ? normalizedValue.trim() : '';
      if (existingCode && nextCode && existingCode !== nextCode) {
        throw new HttpError(400, 'person_type_code is locked after create.');
      }
      if (nextCode) {
        await ensureBaseInfoCode(nextCode, BASE_INFO_ROOT_PERSON_TYPE, 'personTypeCode');
      }
    }

    columnPatch[profileField] = normalizedValue;
    invalidationPayload[PROFILE_FIELD_PAYLOAD_KEY[profileField]] = normalizedValue;
    profileFieldsTouched = true;
  }

  if (!profileFieldsTouched) {
    return { body: { success: true as const } };
  }

  const { emitUserSnapshotDiff, loadUserHistorySnapshot } = await import('../../domain/record-events/userHistory');
  const { resolveFunctionChangeReason } = await import('../../domain/record-events/functionChangeReason');
  const { USERS_PROFILE_CHANGE_REASON } = await import('../../../shared/api/contracts/record-events');
  const before = await loadUserHistorySnapshot(userId);

  if (Object.keys(columnPatch).length > 0) {
    await patchOrInsertUserProfileColumns(userId, columnPatch, currentActorId);
  }
  if (profileImagePayload) {
    await upsertUserProfile(userId, profileImagePayload, currentActorId, { useNullFallbackForImages: true });
  }
  await invalidateSessionContextIfProfileFieldsChanged(userId, invalidationPayload);
  await invalidateSessionContext(userId);

  const after = await loadUserHistorySnapshot(userId);
  if (before && after) {
    const policy = await resolveFunctionChangeReason(
      'PUT',
      '/api/profile/me/editable-fields',
      USERS_PROFILE_CHANGE_REASON,
    );
    await emitUserSnapshotDiff(before, after, payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {}, policy);
  }

  return { body: { success: true as const } };
}
