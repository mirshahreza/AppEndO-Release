import type { Prisma } from '../../../generated/prisma/client';

export function buildUserPersonTypeCodeFilter(personTypeCode: string): Prisma.BaseUserWhereInput | null {
  const code = personTypeCode.trim();
  if (!code) {
    return null;
  }

  return {
    profile: { personTypeCode: code },
  };
}
