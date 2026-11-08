export const USER_PROFILE_HISTORY_FIELD_MAP: Record<string, string> = {
  firstName: 'profile.firstname',
  firstname: 'profile.firstname',
  lastName: 'profile.lastname',
  lastname: 'profile.lastname',
  fatherName: 'profile.fathername',
  fathername: 'profile.fathername',
  grandfatherName: 'profile.grandfathername',
  grandfathername: 'profile.grandfathername',
  nickname: 'profile.nickname',
  nationalCode: 'profile.national_code',
  national_code: 'profile.national_code',
  genderCode: 'profile.gender_code',
  gender_code: 'profile.gender_code',
  companyName: 'profile.company_name',
  company_name: 'profile.company_name',
  registrationNumber: 'profile.registration_number',
  registration_number: 'profile.registration_number',
  website: 'profile.website',
  birthYear: 'profile.birth_year',
  birth_year: 'profile.birth_year',
  birthMonth: 'profile.birth_month',
  birth_month: 'profile.birth_month',
  birthDay: 'profile.birth_day',
  birth_day: 'profile.birth_day',
  phone: 'profile.phone',
};

export const USER_PROFILE_TRACKED_FIELDS = [
  'firstName',
  'lastName',
  'fatherName',
  'grandfatherName',
  'nickname',
  'nationalCode',
  'genderCode',
  'companyName',
  'registrationNumber',
  'website',
  'birthYear',
  'birthMonth',
  'birthDay',
] as const;

export const isRecordAuditCreatedField = (field: string): boolean => {
  const normalized = field.trim().toLowerCase();
  return normalized === 'created'
    || normalized === 'createdat'
    || normalized === 'created_at'
    || normalized === 'createdby'
    || normalized === 'created_by';
};

export const mapRecordHistoryField = (
  formField: string,
  fieldMap?: Record<string, string>,
): string => fieldMap?.[formField] ?? formField;

export const resolveRecordEventFieldQuery = (input: {
  subjectKind?: string;
  field?: string | null;
  fieldMap?: Record<string, string>;
}): string | undefined => {
  const trimmed = input.field?.trim();
  if (!trimmed) return undefined;
  const mapped = mapRecordHistoryField(trimmed, input.fieldMap);
  if (input.subjectKind === 'base_users') {
    return USER_PROFILE_HISTORY_FIELD_MAP[mapped] ?? USER_PROFILE_HISTORY_FIELD_MAP[trimmed] ?? mapped;
  }
  return mapped;
};
