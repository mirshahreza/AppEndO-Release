import type { Prisma } from '../../../generated/prisma/client';
import { getConfigurableProfileColumnNames } from '../../services/attributes/profileFields';
import type { normalizeProfilePayload } from '../../utils/profilePayload';
import {
  applyProfileImageBytesToCreateInput,
  applyProfileImageBytesToUpdateInput,
} from '../../utils/prismaBytes';
import { fromUserId, prisma, toUserId } from './prismaHelpers';

export type ProfileColumnPatch = Partial<Record<string, string | null | undefined>>;

export async function findProfileUserId(userId: number) {
  const row = await prisma().baseUserProfile.findUnique({
    where: { userId: toUserId(userId) },
    select: { userId: true },
  });
  return row ? { user_id: fromUserId(row.userId) } : undefined;
}

export async function getUserProfileForApi(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: {
      id: true,
      email: true,
      username: true,
      createdAt: true,
      profile: {
        select: {
          firstname: true,
          lastname: true,
          fathername: true,
          grandfathername: true,
          phone: true,
          nickname: true,
          nationalCode: true,
          birthYear: true,
          birthMonth: true,
          birthDay: true,
          genderCode: true,
          personTypeCode: true,
          companyName: true,
          registrationNumber: true,
          website: true,
          profileImageMime: true,
          profileImageSize: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!row) return undefined;

  const profile = row.profile;
  return {
    id: fromUserId(row.id),
    email: row.email,
    username: row.username,
    firstname: profile?.firstname ?? null,
    lastname: profile?.lastname ?? null,
    fathername: profile?.fathername ?? null,
    grandfathername: profile?.grandfathername ?? null,
    phone: profile?.phone ?? null,
    nickname: profile?.nickname ?? null,
    national_code: profile?.nationalCode ?? null,
    birth_year: profile?.birthYear ?? null,
    birth_month: profile?.birthMonth ?? null,
    birth_day: profile?.birthDay ?? null,
    gender_code: profile?.genderCode ?? null,
    person_type_code: profile?.personTypeCode ?? null,
    company_name: profile?.companyName ?? null,
    registration_number: profile?.registrationNumber ?? null,
    website: profile?.website ?? null,
    profile_image_mime: profile?.profileImageMime ?? null,
    profile_image_size: profile?.profileImageSize ?? null,
    has_profile_image: (profile?.profileImageSize ?? 0) > 0,
    has_profile_image_xs: Boolean(profile?.profileImageMime?.trim()),
    created_at: row.createdAt,
    updated_at: profile?.updatedAt ?? null,
  };
}

export async function getUserProfileAvatarListMeta(userId: number) {
  const row = await prisma().baseUserProfile.findUnique({
    where: { userId: toUserId(userId) },
    select: {
      profileImageMime: true,
      profileImageSize: true,
      updatedAt: true,
    },
  });

  if (!row) {
    return {
      has_profile_image_xs: false,
      profile_image_size: null as number | null,
      profile_image_mime: null as string | null,
      profile_updated_at: null as string | null,
    };
  }

  return {
    has_profile_image_xs: Boolean(row.profileImageMime?.trim()),
    profile_image_size: row.profileImageSize ?? null,
    profile_image_mime: row.profileImageMime ?? null,
    profile_updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getUserProfileAvatarXs(userId: number) {
  const row = await prisma().baseUserProfile.findUnique({
    where: { userId: toUserId(userId) },
    select: {
      profileImageBodyXs: true,
      profileImageBody: true,
      profileImageMime: true,
    },
  });
  const body = row?.profileImageBodyXs ?? row?.profileImageBody;
  if (!body) {
    return null;
  }
  return {
    body,
    mime: row?.profileImageMime ?? 'image/jpeg',
  };
}

export async function getLoginProfileSummary(userId: number) {
  const row = await prisma().baseUserProfile.findUnique({
    where: { userId: toUserId(userId) },
    select: {
      userId: true,
      firstname: true,
      lastname: true,
      fathername: true,
      grandfathername: true,
      phone: true,
      updatedAt: true,
    },
  });
  if (!row) return undefined;
  return {
    user_id: fromUserId(row.userId),
    firstname: row.firstname,
    lastname: row.lastname,
    fathername: row.fathername,
    grandfathername: row.grandfathername,
    phone: row.phone,
    updated_at: row.updatedAt,
  };
}

export async function getCurrentUserProfile(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: {
      id: true,
      email: true,
      username: true,
      profile: {
        select: {
          firstname: true,
          lastname: true,
          fathername: true,
          grandfathername: true,
          phone: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!row) return undefined;
  const profile = row.profile;
  return {
    id: fromUserId(row.id),
    email: row.email ?? '',
    username: row.username,
    firstname: profile?.firstname ?? null,
    lastname: profile?.lastname ?? null,
    fathername: profile?.fathername ?? null,
    grandfathername: profile?.grandfathername ?? null,
    phone: profile?.phone ?? null,
    updated_at: profile?.updatedAt ?? null,
  };
}

export async function patchUserProfileColumns(
  userId: number,
  patch: ProfileColumnPatch,
  actorId: number | null,
) {
  const allowedColumns = getConfigurableProfileColumnNames();
  const data: Record<string, string | null> = {};

  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined || !allowedColumns.has(field)) continue;
    const prismaField = field === 'national_code' ? 'nationalCode'
      : field === 'birth_year' ? 'birthYear'
        : field === 'birth_month' ? 'birthMonth'
          : field === 'birth_day' ? 'birthDay'
            : field === 'gender_code' ? 'genderCode'
              : field === 'person_type_code' ? 'personTypeCode'
                : field === 'company_name' ? 'companyName'
                  : field === 'registration_number' ? 'registrationNumber'
                    : field === 'website' ? 'website'
                      : field;
    data[prismaField] = value;
  }

  if (Object.keys(data).length === 0) return;

  await prisma().baseUserProfile.update({
    where: { userId: toUserId(userId) },
    data: {
      ...data,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
      updatedAt: new Date(),
    },
  });
}

export async function updateUserProfile(
  userId: number,
  profile: ReturnType<typeof normalizeProfilePayload>,
  imageBody: Buffer | null | undefined,
  imageBodyXs: Buffer | null | undefined,
  actorId: number | null,
) {
  const data: Prisma.BaseUserProfileUpdateInput = {
    firstname: profile.firstname,
    lastname: profile.lastname,
    fathername: profile.fathername,
    grandfathername: profile.grandfathername,
    phone: profile.phone,
    nickname: profile.nickname,
    nationalCode: profile.nationalCode,
    birthYear: profile.birthYear,
    birthMonth: profile.birthMonth,
    birthDay: profile.birthDay,
    genderCode: profile.genderCode,
    personTypeCode: profile.personTypeCode,
    companyName: profile.companyName,
    registrationNumber: profile.registrationNumber,
    website: profile.website,
    profileImageMime: profile.profileImageMime,
    updatedBy: actorId !== null ? toUserId(actorId) : null,
    updatedAt: new Date(),
  };

  applyProfileImageBytesToUpdateInput(data, profile, imageBody, imageBodyXs);

  await prisma().baseUserProfile.update({
    where: { userId: toUserId(userId) },
    data,
  });
}

export async function insertUserProfile(
  userId: number,
  profile: ReturnType<typeof normalizeProfilePayload>,
  imageBody: Buffer | null | undefined,
  imageBodyXs: Buffer | null | undefined,
  actorId: number | null,
) {
  const now = new Date();
  const data: Prisma.BaseUserProfileCreateInput = {
    userId: toUserId(userId),
    firstname: profile.firstname,
    lastname: profile.lastname,
    fathername: profile.fathername,
    grandfathername: profile.grandfathername,
    phone: profile.phone,
    nickname: profile.nickname,
    nationalCode: profile.nationalCode,
    birthYear: profile.birthYear,
    birthMonth: profile.birthMonth,
    birthDay: profile.birthDay,
    genderCode: profile.genderCode,
    personTypeCode: profile.personTypeCode,
    companyName: profile.companyName,
    registrationNumber: profile.registrationNumber,
    website: profile.website,
    profileImageMime: profile.profileImageMime,
    createdBy: actorId !== null ? toUserId(actorId) : null,
    updatedBy: actorId !== null ? toUserId(actorId) : null,
    createdAt: now,
    updatedAt: now,
  };
  applyProfileImageBytesToCreateInput(data, profile, imageBody, imageBodyXs);

  await prisma().baseUserProfile.create({ data });
}
