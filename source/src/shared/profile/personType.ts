/** Base Info · Person Type category (`100.2`). */
export const PERSON_TYPE_INDIVIDUAL = '100.2.1';
export const PERSON_TYPE_COMPANY = '100.2.2';

export const isIndividualPersonType = (code: string | null | undefined): boolean => (
  code === PERSON_TYPE_INDIVIDUAL
);

export const isCompanyPersonType = (code: string | null | undefined): boolean => (
  code === PERSON_TYPE_COMPANY
);

export const INDIVIDUAL_ONLY_PROFILE_FIELDS = new Set([
  'firstname',
  'lastName',
  'firstName',
  'lastname',
  'fathername',
  'fatherName',
  'grandfathername',
  'grandfatherName',
  'gender_code',
  'genderCode',
  'birth_year',
  'birthYear',
  'birth_month',
  'birthMonth',
  'birth_day',
  'birthDay',
]);

export const COMPANY_ONLY_PROFILE_FIELDS = new Set([
  'company_name',
  'companyName',
  'registration_number',
  'registrationNumber',
  'website',
]);

export const isProfileFieldVisibleForPersonType = (
  profileField: string,
  personTypeCode: string | null | undefined,
): boolean => {
  if (INDIVIDUAL_ONLY_PROFILE_FIELDS.has(profileField)) {
    return isIndividualPersonType(personTypeCode);
  }
  if (COMPANY_ONLY_PROFILE_FIELDS.has(profileField)) {
    return isCompanyPersonType(personTypeCode);
  }
  return true;
};
