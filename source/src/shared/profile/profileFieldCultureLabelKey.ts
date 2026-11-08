import { useMemo } from 'react';
import { useCultureT } from '../../core/culture/CultureContext';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';

/** Maps `base_user_profiles` / profile-field ids to `profile.fields.*` culture suffixes. */
const PROFILE_FIELD_CULTURE_LABEL_SUFFIX: Readonly<Record<string, string>> = {
  profile_image: 'sections.profileImage',
  firstname: 'fields.firstName',
  lastname: 'fields.lastName',
  fathername: 'fields.fatherName',
  grandfathername: 'fields.grandfatherName',
  phone: 'fields.phone',
  nickname: 'fields.nickname',
  national_code: 'fields.nationalCode',
  birth_year: 'fields.year',
  birth_month: 'fields.month',
  birth_day: 'fields.day',
  gender_code: 'fields.gender',
  person_type_code: 'fields.personType',
  company_name: 'fields.companyName',
  registration_number: 'fields.registrationNumber',
  website: 'fields.website',
};

export function resolveProfileFieldCultureLabel(
  t: TranslationFn,
  profileField: string,
  fallbackLabel: string,
): string {
  const suffix = PROFILE_FIELD_CULTURE_LABEL_SUFFIX[profileField];
  if (!suffix) {
    return fallbackLabel;
  }
  const key = profileKey(suffix);
  const translated = t(key);
  return translated === key ? fallbackLabel : translated;
}

/** Culture-backed label for profile field controls (identity, birth date, company block, …). */
export function useProfileFieldCultureLabel(profileField: string, fallbackLabel: string): string {
  const t = useCultureT();
  return useMemo(
    () => resolveProfileFieldCultureLabel(t, profileField, fallbackLabel),
    [t, profileField, fallbackLabel],
  );
}
