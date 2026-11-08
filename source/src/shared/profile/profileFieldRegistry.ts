export type ProfileFieldDataKind = 'string' | 'base_info_code' | 'image';

export type ProfileFieldDefinition = {
  profileField: string;
  label: string;
  dataKind: ProfileFieldDataKind;
  viewOrder: number;
  /** Null means the field is virtual and not backed by a single DB column. */
  dbColumn: string | null;
};

/** Columns on base_user_profiles that are never exposed in Profile Fields settings. */
export const PROFILE_TABLE_SYSTEM_COLUMNS = new Set([
  'user_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
]);

/** Image storage columns are grouped under the virtual profile_image field. */
export const PROFILE_IMAGE_STORAGE_COLUMNS = new Set([
  'profile_image_body',
  'profile_image_body_xs',
  'profile_image_mime',
  'profile_image_size',
]);

export const PROFILE_FIELD_DEFINITIONS: ProfileFieldDefinition[] = [
  { profileField: 'profile_image', label: 'Profile Image', dataKind: 'image', viewOrder: 0, dbColumn: null },
  { profileField: 'firstname', label: 'First Name', dataKind: 'string', viewOrder: 10, dbColumn: 'firstname' },
  { profileField: 'lastname', label: 'Last Name', dataKind: 'string', viewOrder: 20, dbColumn: 'lastname' },
  { profileField: 'fathername', label: 'Father Name', dataKind: 'string', viewOrder: 30, dbColumn: 'fathername' },
  { profileField: 'grandfathername', label: 'Grandfather Name', dataKind: 'string', viewOrder: 40, dbColumn: 'grandfathername' },
  { profileField: 'phone', label: 'Phone', dataKind: 'string', viewOrder: 50, dbColumn: 'phone' },
  { profileField: 'nickname', label: 'Nickname', dataKind: 'string', viewOrder: 60, dbColumn: 'nickname' },
  { profileField: 'national_code', label: 'National Code', dataKind: 'string', viewOrder: 70, dbColumn: 'national_code' },
  { profileField: 'birth_year', label: 'Birth Year', dataKind: 'string', viewOrder: 80, dbColumn: 'birth_year' },
  { profileField: 'birth_month', label: 'Birth Month', dataKind: 'string', viewOrder: 90, dbColumn: 'birth_month' },
  { profileField: 'birth_day', label: 'Birth Day', dataKind: 'string', viewOrder: 100, dbColumn: 'birth_day' },
  { profileField: 'gender_code', label: 'Gender Code', dataKind: 'base_info_code', viewOrder: 110, dbColumn: 'gender_code' },
  { profileField: 'person_type_code', label: 'Person Type Code', dataKind: 'base_info_code', viewOrder: 120, dbColumn: 'person_type_code' },
  { profileField: 'company_name', label: 'Company Name', dataKind: 'string', viewOrder: 130, dbColumn: 'company_name' },
  { profileField: 'registration_number', label: 'Registration Number', dataKind: 'string', viewOrder: 140, dbColumn: 'registration_number' },
  { profileField: 'website', label: 'Website', dataKind: 'string', viewOrder: 150, dbColumn: 'website' },
];

const PROFILE_FIELD_DEFINITION_BY_FIELD = new Map(
  PROFILE_FIELD_DEFINITIONS.map((definition) => [definition.profileField, definition]),
);

const PROFILE_FIELD_DEFINITION_BY_DB_COLUMN = new Map(
  PROFILE_FIELD_DEFINITIONS
    .filter((definition): definition is ProfileFieldDefinition & { dbColumn: string } => Boolean(definition.dbColumn))
    .map((definition) => [definition.dbColumn, definition]),
);

export const toDefaultProfileFieldLabel = (profileField: string): string =>
  profileField
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const inferProfileFieldDataKind = (profileField: string): ProfileFieldDataKind => {
  if (profileField === 'profile_image') return 'image';
  if (profileField === 'gender_code' || profileField === 'person_type_code') return 'base_info_code';
  return 'string';
};

export const getProfileFieldDefinition = (profileField: string): ProfileFieldDefinition | null =>
  PROFILE_FIELD_DEFINITION_BY_FIELD.get(profileField) ?? null;

export const getProfileFieldLabel = (profileField: string): string =>
  getProfileFieldDefinition(profileField)?.label ?? toDefaultProfileFieldLabel(profileField);

export const resolveConfigurableProfileFields = (dbColumns: string[]): ProfileFieldDefinition[] => {
  const configurableDbColumns = dbColumns.filter((column) =>
    !PROFILE_TABLE_SYSTEM_COLUMNS.has(column)
    && !PROFILE_IMAGE_STORAGE_COLUMNS.has(column),
  );

  const resolved: ProfileFieldDefinition[] = [];
  const seenFields = new Set<string>();

  for (const definition of PROFILE_FIELD_DEFINITIONS) {
    if (definition.dbColumn === null) {
      resolved.push(definition);
      seenFields.add(definition.profileField);
      continue;
    }

    if (configurableDbColumns.includes(definition.dbColumn)) {
      resolved.push(definition);
      seenFields.add(definition.profileField);
    }
  }

  for (const column of configurableDbColumns) {
    const mappedDefinition = PROFILE_FIELD_DEFINITION_BY_DB_COLUMN.get(column);
    if (mappedDefinition) continue;

    if (seenFields.has(column)) continue;

    resolved.push({
      profileField: column,
      label: toDefaultProfileFieldLabel(column),
      dataKind: inferProfileFieldDataKind(column),
      viewOrder: 1000 + resolved.length,
      dbColumn: column,
    });
    seenFields.add(column);
  }

  return resolved.sort((left, right) => {
    const orderDiff = left.viewOrder - right.viewOrder;
    if (orderDiff !== 0) return orderDiff;
    return left.profileField.localeCompare(right.profileField);
  });
};

export const PROFILE_FIELD_OPTIONS = PROFILE_FIELD_DEFINITIONS.map((definition) => ({
  value: definition.profileField,
  label: definition.label,
}));
