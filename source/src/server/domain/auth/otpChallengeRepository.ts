import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type OtpPurpose = 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export const deleteActiveOtpChallenges = async (userId: number, purpose: OtpPurpose) => {
  await prisma().baseOtpChallenge.deleteMany({
    where: { userId: toUserId(userId), purpose, usedAt: null },
  });
};

export const insertOtpChallenge = async (input: {
  userId: number;
  purpose: OtpPurpose;
  channel: string;
  target: string;
  otpHash: string;
  expiresAt: Date;
  createdBy?: number | null;
}) => {
  const row = await prisma().baseOtpChallenge.create({
    data: {
      userId: toUserId(input.userId),
      purpose: input.purpose,
      channel: input.channel,
      target: input.target,
      otpHash: input.otpHash,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy != null ? toUserId(input.createdBy) : null,
    },
    select: { id: true },
  });
  return { id: fromUserId(row.id) };
};

export const findOtpChallengeById = async (challengeId: number) => {
  const row = await prisma().baseOtpChallenge.findUnique({
    where: { id: toUserId(challengeId) },
    select: {
      id: true,
      userId: true,
      purpose: true,
      target: true,
      otpHash: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!row || row.userId === null) return undefined;
  return {
    id: fromUserId(row.id),
    user_id: fromUserId(row.userId),
    purpose: row.purpose as OtpPurpose,
    target: row.target,
    otp_hash: row.otpHash,
    expires_at: row.expiresAt,
    used_at: row.usedAt,
  };
};

export const markOtpChallengeUsed = async (challengeId: number) => {
  await prisma().baseOtpChallenge.update({
    where: { id: toUserId(challengeId) },
    data: { usedAt: new Date() },
  });
};

export const findActiveOtpChallengeByHash = async (purpose: OtpPurpose, otpHash: string) => {
  const row = await prisma().baseOtpChallenge.findFirst({
    where: { purpose, otpHash, usedAt: null },
    orderBy: { id: 'desc' },
    select: {
      id: true,
      userId: true,
      target: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!row || row.userId === null) return undefined;
  return {
    id: fromUserId(row.id),
    user_id: fromUserId(row.userId),
    target: row.target,
    expires_at: row.expiresAt,
    used_at: row.usedAt,
  };
};
