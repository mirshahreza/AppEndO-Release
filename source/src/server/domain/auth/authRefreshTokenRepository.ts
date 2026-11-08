import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export const persistRefreshToken = async (input: {
  userId: number;
  jti: string;
  tokenHash: string;
  expiresAt: number;
  userAgent: string | null;
  ipAddress: string | null;
}) => {
  await prisma().baseAuthRefreshToken.create({
    data: {
      tokenJti: input.jti,
      userId: toUserId(input.userId),
      tokenHash: input.tokenHash,
      expiresAt: BigInt(input.expiresAt),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    },
  });
};

export const revokeRefreshToken = async (jti: string, replacedByJti?: string) => {
  await prisma().baseAuthRefreshToken.update({
    where: { tokenJti: jti },
    data: {
      revokedAt: new Date(),
      ...(replacedByJti ? { replacedByJti } : {}),
    },
  });
};

export const findRefreshTokenByJti = async (jti: string) => {
  const row = await prisma().baseAuthRefreshToken.findUnique({
    where: { tokenJti: jti },
    select: {
      tokenJti: true,
      userId: true,
      tokenHash: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (!row) return undefined;
  return {
    token_jti: row.tokenJti,
    user_id: fromUserId(row.userId),
    token_hash: row.tokenHash,
    expires_at: Number(row.expiresAt),
    revoked_at: row.revokedAt,
  };
};

export const listRefreshTokensForUser = async (userId: number) => {
  const rows = await prisma().baseAuthRefreshToken.findMany({
    where: { userId: toUserId(userId) },
    orderBy: { createdAt: 'desc' },
    select: {
      tokenJti: true,
      userId: true,
      expiresAt: true,
      createdAt: true,
      revokedAt: true,
      replacedByJti: true,
      userAgent: true,
      ipAddress: true,
    },
  });
  return rows.map((row) => ({
    token_jti: row.tokenJti,
    user_id: fromUserId(row.userId),
    expires_at: Number(row.expiresAt),
    created_at: row.createdAt,
    revoked_at: row.revokedAt,
    replaced_by_jti: row.replacedByJti,
    user_agent: row.userAgent,
    ip_address: row.ipAddress,
  }));
};

export const findRefreshTokenSession = async (jti: string) => {
  const row = await prisma().baseAuthRefreshToken.findUnique({
    where: { tokenJti: jti },
    select: { userId: true, revokedAt: true },
  });
  if (!row) return undefined;
  return { user_id: fromUserId(row.userId), revoked_at: row.revokedAt };
};

export const revokeAllUserRefreshTokensExcept = async (userId: number, exceptJti: string | null) => {
  const result = await prisma().baseAuthRefreshToken.updateMany({
    where: {
      userId: toUserId(userId),
      revokedAt: null,
      ...(exceptJti ? { tokenJti: { not: exceptJti } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
};
