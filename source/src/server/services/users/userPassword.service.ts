import bcrypt from 'bcryptjs';
import { findUserIdEmail, revokeUserRefreshTokens, updateUserPasswordHash } from '../../domain/users/userRepository';
import { HttpError } from '../../errors/HttpError';
import { logAuthEvent } from '../auth.service';
import type { ActorContext, AuthAuditContext } from '../../types/requestContext';
import {
  dispatchResetPasswordNotification,
  generateRandomPassword,
} from '../../utils/usersHelpers';

export async function adminChangePassword(
  actor: ActorContext,
  audit: AuthAuditContext,
  userId: number,
  newPassword: string,
) {
  if (!newPassword || String(newPassword).length < 8) {
    throw new HttpError(400, 'newPassword must be at least 8 characters.');
  }

  const target = await findUserIdEmail(userId);
  if (!target) {
    throw new HttpError(404, 'User not found.');
  }

  const nextHash = bcrypt.hashSync(String(newPassword), 10);
  await updateUserPasswordHash(nextHash, userId);
  await revokeUserRefreshTokens(userId);

  await logAuthEvent(audit, 'CHANGE_PASSWORD', {
    userId,
    email: target.email,
    success: true,
    metadata: {
      mode: 'admin-change-password',
      actorUserId: actor.userId,
      actorEmail: actor.email,
    },
  });

  return { body: { success: true as const } };
}

export async function adminResetPassword(
  actor: ActorContext,
  audit: AuthAuditContext,
  userId: number,
) {
  const target = await findUserIdEmail(userId);
  if (!target) {
    throw new HttpError(404, 'User not found.');
  }

  const generatedPassword = generateRandomPassword();
  const nextHash = bcrypt.hashSync(generatedPassword, 10);
  await updateUserPasswordHash(nextHash, userId);
  await revokeUserRefreshTokens(userId);

  dispatchResetPasswordNotification(target.email);

  await logAuthEvent(audit, 'CHANGE_PASSWORD', {
    userId,
    email: target.email,
    success: true,
    metadata: {
      mode: 'admin-reset-random-password',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      notification: 'queued',
    },
  });

  return { body: { success: true as const, delivery: 'queued' as const } };
}
