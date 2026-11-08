import { updateUserEmailVerifiedAt } from '../../domain/users/userRepository';
import { HttpError } from '../../errors/HttpError';
import type { AuthAuditContext } from '../../types/requestContext';
import { buildAppLink, sendEmail } from '../email/email.service';
import { readAuthOtpSettings, readAuthVerificationSettings } from './authSettings.service';
import { createOtpChallenge, verifyOtpChallenge, verifyOtpChallengeBySecret } from './otp.service';
import { logAuthEvent } from './sessionAudit.service';

export const sendVerificationEmail = async (input: {
  userId: number;
  email: string;
  audit: AuthAuditContext;
}) => {
  const otpSettings = readAuthOtpSettings();
  const { challengeId, secret } = await createOtpChallenge({
    userId: input.userId,
    purpose: 'VERIFY_EMAIL',
    channel: 'EMAIL',
    target: input.email,
    expirySeconds: otpSettings.expirySeconds,
    mode: 'link',
  });

  const verifyUrl = buildAppLink(`/verify-email?token=${encodeURIComponent(secret)}&challenge=${challengeId}`);
  await sendEmail({
    to: input.email,
    subject: 'Verify your email address',
    text: `Verify your AppEndO account by opening this link:\n\n${verifyUrl}\n\nThis link expires soon.`,
  });

  await logAuthEvent(input.audit, 'OTP_SENT', {
    userId: input.userId,
    email: input.email,
    success: true,
    metadata: { purpose: 'VERIFY_EMAIL', challengeId },
  });
};

export const verifyEmailToken = async (input: {
  token: string;
  challengeId?: number;
  audit: AuthAuditContext;
}) => {
  const verification = readAuthVerificationSettings();
  if (!verification.emailVerifyEnabled) {
    throw new HttpError(400, 'Email verification is disabled.');
  }

  const verified = input.challengeId
    ? await verifyOtpChallenge({ challengeId: input.challengeId, secret: input.token })
    : await verifyOtpChallengeBySecret({ purpose: 'VERIFY_EMAIL', secret: input.token });

  if ('purpose' in verified && verified.purpose !== 'VERIFY_EMAIL') {
    throw new HttpError(400, 'Invalid verification token.');
  }

  await updateUserEmailVerifiedAt(verified.userId);

  await logAuthEvent(input.audit, 'EMAIL_VERIFIED', {
    userId: verified.userId,
    email: verified.target,
    success: true,
  });

  return {
    body: {
      success: true as const,
      message: 'Email verified successfully. You can sign in now.',
    },
  };
};

export const assertEmailVerifiedForLogin = async (input: {
  userId: number;
  email: string;
  emailVerifiedAt: string | null;
  audit: AuthAuditContext;
}) => {
  const verification = readAuthVerificationSettings();
  if (!verification.emailVerifyRequired) {
    return;
  }

  if (input.emailVerifiedAt) {
    return;
  }

  await logAuthEvent(input.audit, 'LOGIN_BLOCKED', {
    userId: input.userId,
    email: input.email,
    success: false,
    reason: 'Email not verified',
  });

  throw new HttpError(403, 'Verify your email address before signing in.', {
    code: 'EMAIL_NOT_VERIFIED',
  });
};