/** Physical columns on base_user_profiles — canonical from Prisma schema (p-45 PRM-3). */
const BASE_USER_PROFILE_COLUMNS = [
  'user_id',
  'firstname',
  'lastname',
  'fathername',
  'grandfathername',
  'phone',
  'nickname',
  'national_code',
  'birth_year',
  'birth_month',
  'birth_day',
  'gender_code',
  'person_type_code',
  'profile_image_body',
  'profile_image_body_xs',
  'profile_image_mime',
  'profile_image_size',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

export async function listUserProfileTableColumns(): Promise<string[]> {
  return [...BASE_USER_PROFILE_COLUMNS];
}
