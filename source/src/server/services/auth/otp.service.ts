import crypto from 'crypto';
import { HttpError } from '../../errors/HttpError';
import {
  deleteActiveOtpChallenges,
  findActiveOtpChallengeByHash,
  findOtpChallengeById,
  insertOtpChallenge,
  markOtpChallengeUsed,
  type OtpPurpose,
} from '../../domain/auth/otpChallengeRepository';

export type { OtpPurpose };
export type OtpChannel = 'EMAIL';

const hashSecret = (secret: string): string =>
  crypto.createHash('sha256').update(secret).digest('hex');

const generateNumericCode = (): string =>
  String(Math.floor(100000 + Math.random() * 900000));

const generateLinkToken = (): string =>
  crypto.randomBytes(32).toString('hex');

export const createOtpChallenge = async (input: {
  userId: number;
  purpose: OtpPurpose;
  channel: OtpChannel;
  target: string;
  expirySeconds: number;
  createdBy?: number | null;
  mode?: 'numeric' | 'link';
}): Promise<{ challengeId: number; secret: string }> => {
  const secret = input.mode === 'link' ? generateLinkToken() : generateNumericCode();
  const expiresAt = new Date(Date.now() + Math.max(60, input.expirySeconds) * 1000);

  await deleteActiveOtpChallenges(input.userId, input.purpose);

  const row = await insertOtpChallenge({
    userId: input.userId,
    purpose: input.purpose,
    channel: input.channel,
    target: input.target,
    otpHash: hashSecret(secret),
    expiresAt,
    createdBy: input.createdBy ?? null,
  });

  if (!row?.id) {
    throw new HttpError(500, 'Failed to create OTP challenge.');
  }

  return { challengeId: row.id, secret };
};

export const verifyOtpChallenge = async (input: {
  challengeId: number;
  secret: string;
  maxAttempts?: number;
}): Promise<{ userId: number; purpose: OtpPurpose; target: string }> => {
  const row = await findOtpChallengeById(input.challengeId);

  if (!row || row.used_at) {
    throw new HttpError(400, 'Invalid or expired verification code.');
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new HttpError(400, 'Verification code has expired.');
  }

  if (row.otp_hash !== hashSecret(String(input.secret))) {
    throw new HttpError(400, 'Invalid verification code.');
  }

  await markOtpChallengeUsed(row.id);

  return {
    userId: row.user_id,
    purpose: row.purpose,
    target: row.target,
  };
};

export const verifyOtpChallengeBySecret = async (input: {
  purpose: OtpPurpose;
  secret: string;
}): Promise<{ userId: number; challengeId: number; target: string }> => {
  const hash = hashSecret(String(input.secret));
  const row = await findActiveOtpChallengeByHash(input.purpose, hash);

  if (!row) {
    throw new HttpError(400, 'Invalid or expired token.');
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new HttpError(400, 'Token has expired.');
  }

  await markOtpChallengeUsed(row.id);

  return {
    userId: row.user_id,
    challengeId: row.id,
    target: row.target,
  };
};
