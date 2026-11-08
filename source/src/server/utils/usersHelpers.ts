import crypto from 'crypto';
import { logger } from '../../core/logging/Logger';
import { normalizeRoleName } from '../domain/users/roleUtils';
import { DEFAULT_ASSIGNABLE_ROLE } from '../../shared/api/contracts/roles/constants';

export const toOptionalTrimmed = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

export const normalizeRolesInput = (payloadRoles: unknown, payloadRole: unknown) => {
  if (Array.isArray(payloadRoles)) {
    return Array.from(new Set(payloadRoles.map(normalizeRoleName).filter(Boolean)));
  }
  const fromSingleRole = normalizeRoleName(payloadRole);
  if (fromSingleRole) return [fromSingleRole];
  return [DEFAULT_ASSIGNABLE_ROLE];
};

export const generateRandomPassword = (length = 18) => {
  const raw = crypto.randomBytes(32).toString('base64');
  const safe = raw.replace(/[^A-Za-z0-9]/g, '');
  return safe.slice(0, Math.max(12, length));
};

export const dispatchResetPasswordNotification = (email: string) => {
  logger.info('AuthAPI', 'Reset password notification queued', { email });
};
