import {
  findProfileUserId,
  insertUserProfile,
  patchUserProfileColumns,
  type ProfileColumnPatch,
  updateUserProfile as updateUserProfileRow,
} from '../../domain/users/userProfileRepository';
import { normalizeProfilePayload } from '../../utils/profilePayload';
import { loadConfigurableProfileFields } from '../attributes/profileFields';

const PROFILE_COLUMN_TO_PAYLOAD_KEY: Record<string, string> = {
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

const toNormalizePayload = (patch: ProfileColumnPatch): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const payloadKey = PROFILE_COLUMN_TO_PAYLOAD_KEY[column];
    if (!payloadKey) continue;
    payload[payloadKey] = value;
  }
  return payload;
};

export async function upsertUserProfile(
  userId: number,
  profile: ReturnType<typeof normalizeProfilePayload>,
  actorId: number | null,
  options?: { useNullFallbackForImages?: boolean },
) {
  const existingProfile = await findProfileUserId(userId);

  const imageBody = options?.useNullFallbackForImages
    ? (profile.profileImageBody || null)
    : profile.profileImageBody;
  const imageBodyXs = options?.useNullFallbackForImages
    ? (profile.profileImageBodyXs || null)
    : profile.profileImageBodyXs;

  if (existingProfile) {
    await updateUserProfileRow(userId, profile, imageBody, imageBodyXs, actorId);
    return;
  }

  await insertUserProfile(userId, profile, imageBody, imageBodyXs, actorId);
}

export async function patchOrInsertUserProfileColumns(
  userId: number,
  patch: ProfileColumnPatch,
  actorId: number | null,
) {
  await loadConfigurableProfileFields();
  const existingProfile = await findProfileUserId(userId);

  if (existingProfile) {
    await patchUserProfileColumns(userId, patch, actorId);
    return;
  }

  const profile = normalizeProfilePayload(toNormalizePayload(patch));
  await insertUserProfile(userId, profile, undefined, undefined, actorId);
}
