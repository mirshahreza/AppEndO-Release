import { prisma } from '../domain/users/prismaHelpers';

export const ensureBaseInfoCode = async (
  code: string | null,
  rootId: string,
  fieldName: string,
) => {
  if (!code) return;
  const row = await prisma().baseInfo.findFirst({
    where: {
      id: code,
      isActive: true,
      OR: [{ id: rootId }, { parentId: rootId }],
    },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

export const ensureBaseInfoRoot = async (rootId: string | null, fieldName: string) => {
  if (!rootId) {
    throw new Error(`${fieldName} is required.`);
  }

  const row = await prisma().baseInfo.findFirst({
    where: { id: rootId, isActive: true },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`${fieldName} is invalid.`);
  }
};
