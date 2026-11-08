import { prisma, toUserId } from '../domain/users/prismaHelpers';
import { HttpError } from '../errors/HttpError';
import { toOptionalTrimmed } from './usersHelpers';

export async function assertPersonTypeCodeUnchanged(
  userId: number,
  nextPersonTypeCode: string | null | undefined,
): Promise<void> {
  if (nextPersonTypeCode === undefined) {
    return;
  }

  const existing = await prisma().baseUserProfile.findUnique({
    where: { userId: toUserId(userId) },
    select: { personTypeCode: true },
  });
  const existingCode = existing?.personTypeCode ?? null;
  const nextCode = toOptionalTrimmed(nextPersonTypeCode);

  if (existingCode && nextCode && existingCode !== nextCode) {
    throw new HttpError(400, 'person_type_code is locked after create.');
  }
}

export function assertPersonTypeCodeRequiredOnCreate(personTypeCode: string | null): void {
  if (!personTypeCode) {
    throw new HttpError(400, 'personTypeCode is required.');
  }
}
