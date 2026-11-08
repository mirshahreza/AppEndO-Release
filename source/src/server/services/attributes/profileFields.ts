import type { AttributeDataType } from './settingsAttributesValidation';
import { listUserProfileTableColumns } from '../../domain/profile/profileColumnsRepository';
import {
  getProfileFieldLabel,
  inferProfileFieldDataKind,
  PROFILE_FIELD_DEFINITIONS,
  PROFILE_FIELD_OPTIONS,
  resolveConfigurableProfileFields,
  type ProfileFieldDefinition,
} from '../../../shared/profile/profileFieldRegistry';

export {
  PROFILE_FIELD_OPTIONS,
  getProfileFieldLabel,
  type ProfileFieldDefinition,
} from '../../../shared/profile/profileFieldRegistry';

export const ALLOWED_PROFILE_FIELDS = PROFILE_FIELD_DEFINITIONS.map((definition) => definition.profileField);

export type AllowedProfileField = string;

let cachedConfigurableFields: ProfileFieldDefinition[] | null = null;
let cachedConfigurableFieldSet: Set<string> | null = null;
let loadPromise: Promise<ProfileFieldDefinition[]> | null = null;

const setConfigurableProfileFieldCache = (fields: ProfileFieldDefinition[]) => {
  cachedConfigurableFields = fields;
  cachedConfigurableFieldSet = new Set(fields.map((field) => field.profileField));
};

export async function loadConfigurableProfileFields(): Promise<ProfileFieldDefinition[]> {
  if (cachedConfigurableFields) {
    return cachedConfigurableFields;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const dbColumns = await listUserProfileTableColumns();
    const fields = resolveConfigurableProfileFields(dbColumns);
    setConfigurableProfileFieldCache(fields);
    return fields;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export async function getConfigurableProfileFieldIds(): Promise<string[]> {
  const fields = cachedConfigurableFields ?? await loadConfigurableProfileFields();
  return fields.map((field) => field.profileField);
}

export const isAllowedProfileField = (value: string): boolean => {
  if (cachedConfigurableFieldSet) {
    return cachedConfigurableFieldSet.has(value);
  }
  return ALLOWED_PROFILE_FIELDS.includes(value);
};

export const inferDataTypeForProfileField = (field: string): AttributeDataType => {
  const dataKind = inferProfileFieldDataKind(field);
  if (dataKind === 'base_info_code') return 'base_info_code';
  return 'string';
};

const PAYLOAD_KEY_TO_PROFILE_COLUMN: Record<string, string> = {
  firstname: 'firstname',
  firstName: 'firstname',
  lastname: 'lastname',
  lastName: 'lastname',
  fathername: 'fathername',
  fatherName: 'fathername',
  grandfathername: 'grandfathername',
  grandfatherName: 'grandfathername',
  phone: 'phone',
  nickname: 'nickname',
  national_code: 'national_code',
  nationalCode: 'national_code',
  birth_year: 'birth_year',
  birthYear: 'birth_year',
  birth_month: 'birth_month',
  birthMonth: 'birth_month',
  birth_day: 'birth_day',
  birthDay: 'birth_day',
  gender_code: 'gender_code',
  genderCode: 'gender_code',
  person_type_code: 'person_type_code',
  personTypeCode: 'person_type_code',
  company_name: 'company_name',
  companyName: 'company_name',
  registration_number: 'registration_number',
  registrationNumber: 'registration_number',
  website: 'website',
  profileImageBody: 'profile_image',
  profileImageBodyXs: 'profile_image',
  profileImageMime: 'profile_image',
};

export const getConfigurableProfileColumnNames = (): Set<string> => {
  if (!cachedConfigurableFields) {
    return new Set(
      PROFILE_FIELD_DEFINITIONS
        .filter((definition) => definition.dbColumn)
        .map((definition) => definition.dbColumn as string),
    );
  }

  return new Set(
    cachedConfigurableFields
      .filter((definition) => definition.dbColumn)
      .map((definition) => definition.dbColumn as string),
  );
};

export const extractProfileColumnsFromPayload = (payload: Record<string, unknown>): string[] => {
  const columns = new Set<string>();
  for (const key of Object.keys(payload)) {
    const column = PAYLOAD_KEY_TO_PROFILE_COLUMN[key];
    if (column) {
      columns.add(column);
    }
  }
  return Array.from(columns);
};
