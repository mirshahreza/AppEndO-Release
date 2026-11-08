import { hashPassword } from '../../utils/bcryptAsync';
import { findAuthUserByEmail } from '../../domain/users/userRepository';
import { updateUserPasswordHash } from '../../domain/users/userRepository';
import { HttpError } from '../../errors/HttpError';
import type { AuthAuditContext } from '../../types/requestContext';
import { buildAppLink, sendEmail } from '../email/email.service';
import { readAuthOtpSettings } from './authSettings.service';
import { createOtpChallenge, verifyOtpChallenge, verifyOtpChallengeBySecret } from './otp.service';
import { logAuthEvent } from './sessionAudit.service';

export const requestPasswordReset = async (input: {
  email: string;
  audit: AuthAuditContext;
}) => {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new HttpError(400, 'Email is required.');
  }

  const user = await findAuthUserByEmail(email);
  if (user) {
    const otpSettings = readAuthOtpSettings();
    const { challengeId, secret } = await createOtpChallenge({
      userId: user.id,
      purpose: 'RESET_PASSWORD',
      channel: 'EMAIL',
      target: email,
      expirySeconds: otpSettings.expirySeconds,
      mode: 'link',
    });

    const resetUrl = buildAppLink(`/reset-password?token=${encodeURIComponent(secret)}&challenge=${challengeId}`);
    await sendEmail({
      to: email,
      subject: 'Reset your password',
      text: `Reset your AppEndO password by opening this link:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    });

    await logAuthEvent(input.audit, 'FORGOT_PASSWORD', {
      userId: user.id,
      email,
      success: true,
      metadata: { challengeId },
    });
  } else {
    await logAuthEvent(input.audit, 'FORGOT_PASSWORD', {
      email,
      success: true,
      reason: 'No matching account',
    });
  }

  return {
    body: {
      success: true as const,
      message: 'If an account exists for this email, password reset instructions have been sent.',
    },
  };
};

export const resetPasswordWithToken = async (input: {
  token: string;
  challengeId?: number;
  newPassword: string;
  audit: AuthAuditContext;
}) => {
  const newPassword = String(input.newPassword || '');
  if (newPassword.length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters.');
  }

  const verified = input.challengeId
    ? await verifyOtpChallenge({ challengeId: input.challengeId, secret: input.token })
    : await verifyOtpChallengeBySecret({ purpose: 'RESET_PASSWORD', secret: input.token });

  if ('purpose' in verified && verified.purpose !== 'RESET_PASSWORD') {
    throw new HttpError(400, 'Invalid reset token.');
  }

  const hash = await hashPassword(newPassword);
  await updateUserPasswordHash(hash, verified.userId);

  await logAuthEvent(input.audit, 'RESET_PASSWORD', {
    userId: verified.userId,
    email: verified.target,
    success: true,
  });

  return {
    body: {
      success: true as const,
      message: 'Password reset successfully. You can sign in with your new password.',
    },
  };
};
