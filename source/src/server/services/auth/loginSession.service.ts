import { getLoginProfileSummary } from '../../domain/users/userProfileRepository';
import { updateUserLastLoginAt } from '../../domain/users/userRepository';
import {
  formatMissingRequiredAttributesMessage,
  resolveMissingRequiredAttributes,
  REQUIRED_ATTRIBUTES_MISSING_CODE,
} from '../attributes/requiredAttributes.service';
import { resolveAndCacheSessionContext } from '../attributes/sessionContext.service';
import { setCachedUserRoles } from '../../domain/users/userRolesCache';
import { HttpError } from '../../errors/HttpError';
import type { AuthAuditContext } from '../../types/requestContext';
import { issueSessionTokens } from './refreshToken.service';
import { logAuthEvent } from './sessionAudit.service';
import { ACCESS_TOKEN_TTL_SECONDS } from './token.service';
import type { AuthUser } from './types';
import type { ResolvedLoginUser } from './loginIdentifier.service';

export const assertRequiredAttributesOrThrow = async (input: {
  userId: number;
  roles: string[];
  email?: string;
  audit?: AuthAuditContext;
  auditEvent?: 'LOGIN_BLOCKED';
}) => {
  const missingRequiredAttributes = await resolveMissingRequiredAttributes(input.userId, input.roles);
  if (missingRequiredAttributes.length === 0) {
    return;
  }

  if (input.audit && input.auditEvent) {
    await logAuthEvent(input.audit, input.auditEvent, {
      email: input.email,
      userId: input.userId,
      success: false,
      reason: 'Required attributes missing',
      metadata: {
        code: REQUIRED_ATTRIBUTES_MISSING_CODE,
        missingRequiredAttributes,
      },
    });
  }

  throw new HttpError(403, formatMissingRequiredAttributesMessage(missingRequiredAttributes), {
    code: REQUIRED_ATTRIBUTES_MISSING_CODE,
    missingRequiredAttributes,
  });
};

export const completeLoginSession = async (input: {
  user: ResolvedLoginUser;
  audit: AuthAuditContext;
  auditMetadata?: Record<string, unknown>;
}) => {
  const sessionUser: AuthUser = {
    id: input.user.id,
    email: input.user.email,
    role: input.user.role,
    roles: input.user.roles,
  };

  await assertRequiredAttributesOrThrow({
    userId: sessionUser.id,
    roles: sessionUser.roles,
    email: sessionUser.email,
    audit: input.audit,
    auditEvent: 'LOGIN_BLOCKED',
  });

  const profile = await getLoginProfileSummary(input.user.id);

  await updateUserLastLoginAt(input.user.id);

  const cookies = await issueSessionTokens(input.audit, sessionUser, input.auditMetadata);
  const [{ clientContext }] = await Promise.all([
    resolveAndCacheSessionContext(sessionUser.id, sessionUser.roles),
    setCachedUserRoles(sessionUser.id, sessionUser.roles),
  ]);

  return {
    cookies,
    body: {
      success: true as const,
      tokenType: 'Bearer' as const,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        role: sessionUser.role,
        roles: sessionUser.roles,
        profile: profile || null,
      },
      clientContext,
    },
  };
};
