import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { __resetOAuthSessionsForTests, createOAuthSession, consumeOAuthSession } from '../../../../core/identity/stateStore';
import {
  assertMarketplaceCannotRegisterIdentityProvider,
  bootstrapProviderRegistry,
  getEnabledIdentityProvider,
  listBuiltinOAuthAdapters,
  resolveOAuthAdapter,
} from '../../../../core/identity/ProviderRegistry';
import { reloadIdentityProviderRegistry } from '../../../../core/identity/OAuthFlowEngine';
import type { IdentityProviderConfig } from '../../../../shared/api/contracts/auth/identityProviders';
import type { NormalizedIdentityClaims } from '../../../../shared/api/contracts/systemExtensions/types';
import {
  bootstrapAuthE2eEnvironment,
  buildUniqueTestEmail,
  isDatabaseReachable,
  shutdownAuthE2eEnvironment,
  testAuditContext,
} from '../../../test/authE2eTestHarness';
import { findAuthUserByEmail } from '../../../domain/users/userRepository';
import {
  createUserIdentity,
  deleteUserIdentitiesForProvider,
  deleteUserIdentitiesForUser,
  findUserIdentityByProviderSubject,
} from '../../../domain/auth/userIdentityRepository';
import { assignUserRoles } from '../../../domain/users/userRoleRepository';
import { deleteUser, deleteUserProfile, findUserIdByUsername, insertUser } from '../../../domain/users/userRepository';

const {
  mockExchangeOAuthToken,
  mockFetchOAuthProfile,
  mockCompleteLoginSession,
  mockLogAuthEvent,
} = vi.hoisted(() => ({
  mockExchangeOAuthToken: vi.fn(),
  mockFetchOAuthProfile: vi.fn(),
  mockCompleteLoginSession: vi.fn(),
  mockLogAuthEvent: vi.fn(async () => undefined),
}));

vi.mock('../../../../core/identity/TokenExchangeEngine', () => ({
  exchangeOAuthToken: mockExchangeOAuthToken,
  fetchOAuthProfile: mockFetchOAuthProfile,
}));

vi.mock('../../../../server/services/auth/loginSession.service', () => ({
  completeLoginSession: mockCompleteLoginSession,
}));

vi.mock('../../../../server/services/auth/sessionAudit.service', () => ({
  logAuthEvent: mockLogAuthEvent,
}));

const baseProvider = (overrides: Partial<IdentityProviderConfig> = {}): IdentityProviderConfig => ({
  id: 'google-dev',
  kind: 'google-oauth',
  label: 'Google',
  enabled: true,
  autoProvision: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3000/api/auth/oauth/google-dev/callback',
  ...overrides,
});

const buildCallbackState = (providerId: string, redirectUri: string): string => {
  const { sessionId, state } = createOAuthSession({ providerId, redirectUri });
  return `${sessionId}.${state}`;
};

const stubSessionResult = {
  cookies: [],
  body: {
    success: true as const,
    tokenType: 'Bearer' as const,
    expiresIn: 3600,
    user: { id: 1, email: 'test@append.test', role: 'USER', roles: ['USER'], profile: null },
    clientContext: {},
  },
};

async function createTestUser(email: string): Promise<number> {
  const username = `oauth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = bcrypt.hashSync('unused-oauth-test', 10);
  await insertUser(username, email, passwordHash, null);
  const row = await findUserIdByUsername(username);
  const userId = Number(row?.id || 0);
  if (!userId) {
    throw new Error('Failed to create test user.');
  }
  await assignUserRoles(userId, ['USER']);
  return userId;
}

async function cleanupTestUser(email: string): Promise<void> {
  const user = await findAuthUserByEmail(email);
  if (!user) {
    return;
  }
  await deleteUserIdentitiesForUser(user.id);
  await deleteUserProfile(user.id);
  await deleteUser(user.id);
}

async function cleanupProviderIdentities(providerId: string): Promise<void> {
  await deleteUserIdentitiesForProvider(providerId);
}

describe('auth oauth state store', () => {
  beforeEach(() => {
    __resetOAuthSessionsForTests();
  });

  it('creates and consumes a valid oauth session', () => {
    const created = createOAuthSession({
      providerId: 'google-dev',
      redirectUri: 'http://localhost:3000/api/auth/oauth/google-dev/callback',
    });

    const consumed = consumeOAuthSession(created.sessionId, created.state, 'google-dev');
    expect(consumed.codeVerifier).toBeTruthy();
    expect(consumed.redirectUri).toContain('/callback');
  });

  it('rejects invalid oauth state', () => {
    const created = createOAuthSession({
      providerId: 'google-dev',
      redirectUri: 'http://localhost:3000/api/auth/oauth/google-dev/callback',
    });

    expect(() => consumeOAuthSession(created.sessionId, 'wrong-state', 'google-dev')).toThrow('OAUTH_STATE');
  });
});

describe('provider registry', () => {
  it('loads enabled providers for runtime', () => {
    reloadIdentityProviderRegistry([
      baseProvider(),
      baseProvider({ id: 'github-dev', kind: 'github-oauth', enabled: false }),
    ]);

    expect(getEnabledIdentityProvider('google-dev')?.kind).toBe('google-oauth');
    expect(getEnabledIdentityProvider('github-dev')).toBeUndefined();
  });

  it('blocks marketplace identity-provider registration', () => {
    expect(() => assertMarketplaceCannotRegisterIdentityProvider('identity-provider')).toThrow();
    expect(() => assertMarketplaceCannotRegisterIdentityProvider('feature')).not.toThrow();
  });
});

describe('oauth flow start', () => {
  beforeEach(() => {
    __resetOAuthSessionsForTests();
    bootstrapProviderRegistry([baseProvider()]);
  });

  it('builds an authorization redirect url', async () => {
    const { startOAuthFlow } = await import('../../../../core/identity/OAuthFlowEngine');
    const result = await startOAuthFlow('google-dev');
    expect(result.authorizeUrl).toContain('accounts.google.com');
    expect(result.authorizeUrl).toContain('code_challenge=');
  });

  it('resolves microsoft and oidc builtin adapters', () => {
    expect(resolveOAuthAdapter('microsoft-oauth')?.extension.id).toBe('microsoft-oauth');
    expect(resolveOAuthAdapter('oidc-generic')?.extension.id).toBe('oidc-generic');
    expect(listBuiltinOAuthAdapters().map((item) => item.extension.id)).toEqual(
      expect.arrayContaining(['google-oauth', 'github-oauth', 'microsoft-oauth', 'oidc-generic']),
    );
  });
});

describe('oauth callback denied cases', () => {
  beforeEach(() => {
    __resetOAuthSessionsForTests();
    mockExchangeOAuthToken.mockReset();
    mockFetchOAuthProfile.mockReset();
    mockCompleteLoginSession.mockReset();
    bootstrapProviderRegistry([
      baseProvider({ autoProvision: false }),
    ]);
  });

  it('returns oauth_denied when provider reports an error', async () => {
    const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
    const result = await completeOAuthCallback({
      providerId: 'google-dev',
      error: 'access_denied',
      audit: testAuditContext,
    });
    expect(result).toEqual({ errorCode: 'oauth_denied' });
  });

  it('returns oauth_state for malformed state', async () => {
    const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
    const result = await completeOAuthCallback({
      providerId: 'google-dev',
      code: 'abc',
      stateParam: 'broken',
      audit: testAuditContext,
    });
    expect(result).toEqual({ errorCode: 'oauth_state' });
  });
});

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('oauth callback integration (mock IdP)', () => {
  let pool: Pool;

  beforeAll(async () => {
    ({ pool } = await bootstrapAuthE2eEnvironment());
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      await shutdownAuthE2eEnvironment(pool);
    }
  });

  beforeEach(() => {
    __resetOAuthSessionsForTests();
    mockExchangeOAuthToken.mockReset();
    mockFetchOAuthProfile.mockReset();
    mockCompleteLoginSession.mockReset();
    mockLogAuthEvent.mockClear();
    mockExchangeOAuthToken.mockResolvedValue({ accessToken: 'mock-access-token' });
    mockCompleteLoginSession.mockImplementation(async ({ user }) => ({
      ...stubSessionResult,
      body: {
        ...stubSessionResult.body,
        user: {
          ...stubSessionResult.body.user,
          id: user.id,
          email: user.email,
          role: user.role,
          roles: user.roles,
        },
      },
    }));
  });

  it('logs in via existing linked identity', async () => {
    const email = buildUniqueTestEmail('oauth-existing');
    const providerId = `oauth-existing-${Date.now()}`;
    const redirectUri = `http://localhost:3000/api/auth/oauth/${providerId}/callback`;
    const subject = `sub-${Date.now()}`;
    const userId = await createTestUser(email);

    try {
      await createUserIdentity({
        userId,
        providerId,
        providerKind: 'google-oauth',
        subject,
        email,
        emailVerified: true,
      });

      bootstrapProviderRegistry([baseProvider({ id: providerId, redirectUri })]);
      mockFetchOAuthProfile.mockResolvedValue({
        subject,
        email,
        emailVerified: true,
      } satisfies NormalizedIdentityClaims);

      const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
      const result = await completeOAuthCallback({
        providerId,
        code: 'mock-code',
        stateParam: buildCallbackState(providerId, redirectUri),
        audit: testAuditContext,
      });

      expect(result).toHaveProperty('sessionResult');
      expect(mockCompleteLoginSession).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ email }),
          auditMetadata: expect.objectContaining({ oauth: true, providerId }),
        }),
      );
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        testAuditContext,
        'OAUTH_LOGIN_SUCCESS',
        expect.objectContaining({ success: true, email }),
      );
    } finally {
      await cleanupProviderIdentities(providerId);
      await cleanupTestUser(email);
    }
  });

  it('merges a verified email match into an existing user', async () => {
    const email = buildUniqueTestEmail('oauth-merge');
    const providerId = `oauth-merge-${Date.now()}`;
    const redirectUri = `http://localhost:3000/api/auth/oauth/${providerId}/callback`;
    const subject = `merge-sub-${Date.now()}`;
    const userId = await createTestUser(email);

    try {
      bootstrapProviderRegistry([baseProvider({ id: providerId, redirectUri, autoProvision: false })]);
      mockFetchOAuthProfile.mockResolvedValue({
        subject,
        email,
        emailVerified: true,
      } satisfies NormalizedIdentityClaims);

      const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
      const result = await completeOAuthCallback({
        providerId,
        code: 'mock-code',
        stateParam: buildCallbackState(providerId, redirectUri),
        audit: testAuditContext,
      });

      expect(result).toHaveProperty('sessionResult');
      const identity = await findUserIdentityByProviderSubject(providerId, subject);
      expect(Number(identity?.user_id)).toBe(userId);
      expect(identity?.subject).toBe(subject);
    } finally {
      await cleanupProviderIdentities(providerId);
      await cleanupTestUser(email);
    }
  });

  it('denies merge when IdP email is not verified', async () => {
    const email = buildUniqueTestEmail('oauth-link-denied');
    const providerId = `oauth-link-denied-${Date.now()}`;
    const redirectUri = `http://localhost:3000/api/auth/oauth/${providerId}/callback`;
    const subject = `denied-sub-${Date.now()}`;
    await createTestUser(email);

    try {
      bootstrapProviderRegistry([baseProvider({ id: providerId, redirectUri, autoProvision: true })]);
      mockFetchOAuthProfile.mockResolvedValue({
        subject,
        email,
        emailVerified: false,
      } satisfies NormalizedIdentityClaims);

      const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
      const result = await completeOAuthCallback({
        providerId,
        code: 'mock-code',
        stateParam: buildCallbackState(providerId, redirectUri),
        audit: testAuditContext,
      });

      expect(result).toEqual({ errorCode: 'oauth_link_denied' });
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        testAuditContext,
        'OAUTH_LINK_DENIED',
        expect.objectContaining({ success: false, reason: 'oauth_link_denied' }),
      );
    } finally {
      await cleanupProviderIdentities(providerId);
      await cleanupTestUser(email);
    }
  });

  it('returns oauth_no_account when autoProvision is disabled', async () => {
    const email = buildUniqueTestEmail('oauth-no-account');
    const providerId = `oauth-no-account-${Date.now()}`;
    const redirectUri = `http://localhost:3000/api/auth/oauth/${providerId}/callback`;
    const subject = `no-account-sub-${Date.now()}`;

    try {
      bootstrapProviderRegistry([baseProvider({
        id: providerId,
        redirectUri,
        autoProvision: false,
      })]);
      mockFetchOAuthProfile.mockResolvedValue({
        subject,
        email,
        emailVerified: true,
      } satisfies NormalizedIdentityClaims);

      const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
      const result = await completeOAuthCallback({
        providerId,
        code: 'mock-code',
        stateParam: buildCallbackState(providerId, redirectUri),
        audit: testAuditContext,
      });

      expect(result).toEqual({ errorCode: 'oauth_no_account' });
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        testAuditContext,
        'OAUTH_LINK_DENIED',
        expect.objectContaining({ success: false, reason: 'oauth_no_account' }),
      );
    } finally {
      await cleanupProviderIdentities(providerId);
      await cleanupTestUser(email);
    }
  });

  it('auto-provisions a new user when enabled', async () => {
    const email = buildUniqueTestEmail('oauth-provision');
    const providerId = `oauth-provision-${Date.now()}`;
    const redirectUri = `http://localhost:3000/api/auth/oauth/${providerId}/callback`;
    const subject = `provision-sub-${Date.now()}`;

    try {
      bootstrapProviderRegistry([baseProvider({ id: providerId, redirectUri, autoProvision: true })]);
      mockFetchOAuthProfile.mockResolvedValue({
        subject,
        email,
        emailVerified: true,
        givenName: 'OAuth',
        familyName: 'Tester',
      } satisfies NormalizedIdentityClaims);

      const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
      const result = await completeOAuthCallback({
        providerId,
        code: 'mock-code',
        stateParam: buildCallbackState(providerId, redirectUri),
        audit: testAuditContext,
      });

      expect(result).toHaveProperty('sessionResult');
      const user = await findAuthUserByEmail(email);
      expect(user?.id).toBeTruthy();
      const identity = await findUserIdentityByProviderSubject(providerId, subject);
      expect(Number(identity?.user_id)).toBe(Number(user?.id));
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        testAuditContext,
        'OAUTH_LOGIN_SUCCESS',
        expect.objectContaining({
          success: true,
          metadata: expect.objectContaining({ provisioned: true }),
        }),
      );
    } finally {
      await cleanupProviderIdentities(providerId);
      await cleanupTestUser(email);
    }
  });

  it('auto-provisions a new user via GitHub callback when enabled', async () => {
    const email = buildUniqueTestEmail('github-provision');
    const providerId = `github-provision-${Date.now()}`;
    const redirectUri = `http://localhost:3000/api/auth/oauth/${providerId}/callback`;
    const subject = `gh-sub-${Date.now()}`;

    try {
      bootstrapProviderRegistry([baseProvider({
        id: providerId,
        kind: 'github-oauth',
        label: 'GitHub',
        redirectUri,
        autoProvision: true,
      })]);
      mockFetchOAuthProfile.mockResolvedValue({
        subject,
        email,
        emailVerified: true,
        displayName: 'gh-user',
      } satisfies NormalizedIdentityClaims);

      const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
      const result = await completeOAuthCallback({
        providerId,
        code: 'mock-code',
        stateParam: buildCallbackState(providerId, redirectUri),
        audit: testAuditContext,
      });

      expect(result).toHaveProperty('sessionResult');
      const user = await findAuthUserByEmail(email);
      expect(user?.id).toBeTruthy();
      const identity = await findUserIdentityByProviderSubject(providerId, subject);
      expect(Number(identity?.user_id)).toBe(Number(user?.id));
    } finally {
      await cleanupProviderIdentities(providerId);
      await cleanupTestUser(email);
    }
  });

  it('returns oauth_denied for GitHub when provider reports an error', async () => {
    const providerId = `github-denied-${Date.now()}`;
    const redirectUri = `http://localhost:3000/api/auth/oauth/${providerId}/callback`;

    bootstrapProviderRegistry([baseProvider({
      id: providerId,
      kind: 'github-oauth',
      label: 'GitHub',
      redirectUri,
    })]);

    const { completeOAuthCallback } = await import('../../../../core/identity/OAuthFlowEngine');
    const result = await completeOAuthCallback({
      providerId,
      error: 'access_denied',
      audit: testAuditContext,
    });
    expect(result).toEqual({ errorCode: 'oauth_denied' });
  });
});
