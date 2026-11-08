import type { Prisma } from '../../generated/prisma/client';

export const toPrismaBytes = (
  value: Buffer | Uint8Array | null | undefined,
): Uint8Array | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Uint8Array) return value;
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  throw new Error('Expected binary profile image payload.');
};

export const applyProfileImageBytesToCreateInput = (
  data: Prisma.BaseUserProfileCreateInput,
  profile: {
    profileImageSize: number | null | undefined;
  },
  imageBody: Buffer | null | undefined,
  imageBodyXs: Buffer | null | undefined,
): void => {
  const bodyBytes = imageBody ? toPrismaBytes(imageBody) : undefined;
  if (bodyBytes) {
    data.profileImageBody = bodyBytes;
    data.profileImageSize = profile.profileImageSize ?? bodyBytes.length;
  }

  const thumbBytes = imageBodyXs ? toPrismaBytes(imageBodyXs) : undefined;
  if (thumbBytes) {
    data.profileImageBodyXs = thumbBytes;
  }
};

export const applyProfileImageBytesToUpdateInput = (
  data: Prisma.BaseUserProfileUpdateInput,
  profile: {
    hasProfileImageBodyInput: boolean;
    hasProfileImageBodyXsInput: boolean;
    profileImageSize: number | null | undefined;
  },
  imageBody: Buffer | null | undefined,
  imageBodyXs: Buffer | null | undefined,
): void => {
  if (profile.hasProfileImageBodyInput) {
    data.profileImageBody = { set: toPrismaBytes(imageBody ?? null) ?? null };
    data.profileImageSize = profile.profileImageSize;
  }
  if (profile.hasProfileImageBodyXsInput) {
    data.profileImageBodyXs = { set: toPrismaBytes(imageBodyXs ?? null) ?? null };
  }
};
