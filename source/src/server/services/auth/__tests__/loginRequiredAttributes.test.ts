import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../errors/HttpError';

vi.mock('../../../domain/users/userRepository', () => ({
  clearLoginFailCount: vi.fn(),
  deleteUser: vi.fn(),
  deleteUserProfile: vi.fn(),
  findUserIdBuiltin: vi.fn(),
  incrementLoginFailCount: vi.fn(),
  revokeUserRefreshTokens: vi.fn(),
  updateUserLastLoginAt: vi.fn(),
}));

vi.mock('../../../domain/users/userProfileRepository', () => ({
  getLoginProfileSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../attributes/requiredAttributes.service', () => ({
  resolveMissingRequiredAttributes: vi.fn(),
  formatMissingRequiredAttributesMessage: vi.fn(),
  REQUIRED_ATTRIBUTES_MISSING_CODE: 'REQUIRED_ATTRIBUTES_MISSING',
}));

vi.mock('../../attributes/sessionContext.service', () => ({
  resolveAndCacheSessionContext: vi.fn(),
}));

vi.mock('../loginAttempt.service', () => ({
  checkLoginRateLimit: vi.fn(() => ({ blocked: false, retryAfterSeconds: 0 })),
  clearLoginFailures: vi.fn(),
  getLoginRateLimitKey: vi.fn(() => 'rate-key'),
  registerLoginFailure: vi.fn(),
}));

vi.mock('../refreshToken.service', () => ({
  issueSessionTokens: vi.fn(),
}));

vi.mock('../sessionAudit.service', () => ({
  logAuthEvent: vi.fn(),
}));

vi.mock('../authSettings.service', () => ({
  readAuthOtpSettings: vi.fn(() => ({
    enabled: false,
    channelEmail: true,
    expirySeconds: 300,
    maxAttempts: 5,
  })),
}));

vi.mock('../loginIdentifier.service', () => ({
  assertLoginMethodAllowed: vi.fn(),
  resolveUserByIdentifier: vi.fn(),
}));

vi.mock('../verification.service', () => ({
  assertEmailVerifiedForLogin: vi.fn(),
}));

import { clearLoginFailCount } from '../../../domain/users/userRepository';
import {
  formatMissingRequiredAttributesMessage,
  resolveMissingRequiredAttributes,
} from '../../attributes/requiredAttributes.service';
import { resolveAndCacheSessionContext } from '../../attributes/sessionContext.service';
import { issueSessionTokens } from '../refreshToken.service';
import { resolveUserByIdentifier } from '../loginIdentifier.service';
import { login } from '../login.service';

const audit = {
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const baseUser = {
  id: 42,
  email: 'user@example.com',
  username: 'user',
  password_hash: bcrypt.hashSync('secret123', 4),
  role: 'USER',
  roles: ['USER'],
  locked: false,
  is_builtin: false,
  email_verified_at: '2026-01-01T00:00:00.000Z',
  mobile: null,
};

describe('login required attributes enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUserByIdentifier).mockResolvedValue({ kind: 'email', user: baseUser });
    vi.mocked(clearLoginFailCount).mockResolvedValue(undefined);
    vi.mocked(issueSessionTokens).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    vi.mocked(resolveAndCacheSessionContext).mockResolvedValue({
      serverContext: {},
      clientContext: { 'user.city': 'north' },
    });
  });

  it('blocks login when required attributes are missing', async () => {
    vi.mocked(resolveMissingRequiredAttributes).mockResolvedValue([{
      settingsAttributeId: 1,
      key: 'department',
      scope: 'USER',
      sourceType: 'CUSTOM',
      contextKey: 'user.department',
      label: 'Department',
    }]);
    vi.mocked(formatMissingRequiredAttributesMessage).mockReturnValue(
      'Required attribute "Department" is missing. Contact an administrator to complete your account.',
    );

    await expect(login({
      identifier: 'user@example.com',
      password: 'secret123',
      ip: '127.0.0.1',
      audit,
    })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Required attribute "Department" is missing. Contact an administrator to complete your account.',
      body: {
        code: 'REQUIRED_ATTRIBUTES_MISSING',
        missingRequiredAttributes: expect.arrayContaining([
          expect.objectContaining({ key: 'department' }),
        ]),
      },
    } satisfies Partial<HttpError>);

    expect(issueSessionTokens).not.toHaveBeenCalled();
    expect(resolveAndCacheSessionContext).not.toHaveBeenCalled();
  });

  it('allows login after required attributes are satisfied', async () => {
    vi.mocked(resolveMissingRequiredAttributes).mockResolvedValue([]);

    const result = await login({
      identifier: 'user@example.com',
      password: 'secret123',
      ip: '127.0.0.1',
      audit,
    });

    expect(result.body.success).toBe(true);
    if ('clientContext' in result.body) {
      expect(result.body.clientContext).toEqual({ 'user.city': 'north' });
    }
    expect(issueSessionTokens).toHaveBeenCalled();
    expect(resolveAndCacheSessionContext).toHaveBeenCalledWith(42, ['USER']);
  });
});
