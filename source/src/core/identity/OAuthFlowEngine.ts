import { HttpError } from '../../server/errors/HttpError';
import type { IdentityProviderConfig } from '../../shared/api/contracts/auth/identityProviders';
import type { AuthAuditContext } from '../../server/types/requestContext';
import { completeLoginSession } from '../../server/services/auth/loginSession.service';
import { logAuthEvent } from '../../server/services/auth/sessionAudit.service';
import {
  bootstrapProviderRegistry,
  getEnabledIdentityProvider,
  resolveOAuthAdapter,
} from './ProviderRegistry';
import { createOAuthSession, consumeOAuthSession } from './stateStore';
import { exchangeOAuthToken, fetchOAuthProfile } from './TokenExchangeEngine';
import { resolveLoginUserById, resolveOAuthUserLink } from './IdentityLinkService';

export type OAuthCallbackErrorCode =
  | 'oauth_denied'
  | 'oauth_state'
  | 'oauth_provider'
  | 'oauth_no_account'
  | 'oauth_link_denied';

export const startOAuthFlow = async (providerId: string): Promise<{ authorizeUrl: string }> => {
  const provider = getEnabledIdentityProvider(providerId);
  if (!provider) {
    throw new HttpError(404, 'Identity provider is not enabled.');
  }

  const adapter = resolveOAuthAdapter(provider.kind);
  if (!adapter) {
    throw new HttpError(500, 'Identity provider adapter is not available.');
  }

  const clientId = provider.clientId?.trim() ?? '';
  const redirectUri = provider.redirectUri?.trim() ?? '';
  if (!clientId || !redirectUri) {
    throw new HttpError(503, 'Identity provider is not fully configured.');
  }

  const { sessionId, state, codeChallenge } = createOAuthSession({
    providerId: provider.id,
    redirectUri,
  });

  const authorizeUrl = await adapter.buildAuthorizationUrl({
    providerId: provider.id,
    redirectUri,
    state: `${sessionId}.${state}`,
    codeChallenge,
    codeChallengeMethod: 'S256',
    clientId,
    scopes: adapter.defaultScopes,
    issuerUrl: provider.issuerUrl,
  });

  return { authorizeUrl };
};

export const completeOAuthCallback = async (input: {
  providerId: string;
  code?: string;
  error?: string;
  stateParam?: string;
  audit: AuthAuditContext;
}) => {
  if (input.error?.trim()) {
    return { errorCode: 'oauth_denied' as const };
  }

  const provider = getEnabledIdentityProvider(input.providerId);
  if (!provider) {
    return { errorCode: 'oauth_provider' as const };
  }

  const adapter = resolveOAuthAdapter(provider.kind);
  if (!adapter) {
    return { errorCode: 'oauth_provider' as const };
  }

  const code = input.code?.trim();
  const stateParam = input.stateParam?.trim();
  if (!code || !stateParam) {
    return { errorCode: 'oauth_denied' as const };
  }

  const [sessionId, state] = stateParam.split('.');
  if (!sessionId || !state) {
    return { errorCode: 'oauth_state' as const };
  }

  let session;
  try {
    session = consumeOAuthSession(sessionId, state, provider.id);
  } catch {
    return { errorCode: 'oauth_state' as const };
  }

  if (session.redirectUri !== provider.redirectUri?.trim()) {
    return { errorCode: 'oauth_provider' as const };
  }

  try {
    const token = await exchangeOAuthToken({
      adapter,
      provider,
      code,
      codeVerifier: session.codeVerifier,
    });
    const claims = await fetchOAuthProfile({
      adapter,
      provider,
      accessToken: token.accessToken,
      idToken: token.idToken,
    });

    const linkResult = await resolveOAuthUserLink({ provider, claims });
    if (linkResult.kind === 'denied') {
      await logAuthEvent(input.audit, 'OAUTH_LINK_DENIED', {
        email: claims.email,
        success: false,
        reason: linkResult.code,
        metadata: {
          providerId: provider.id,
          providerKind: provider.kind,
          subject: claims.subject,
        },
      });
      return { errorCode: linkResult.code };
    }

    const loginUser = await resolveLoginUserById(linkResult.userId);
    if (loginUser.locked) {
      await logAuthEvent(input.audit, 'LOGIN_BLOCKED', {
        userId: loginUser.id,
        email: loginUser.email,
        success: false,
        reason: 'Account locked',
        metadata: { providerId: provider.id, oauth: true },
      });
      return { errorCode: 'oauth_denied' as const };
    }

    const sessionResult = await completeLoginSession({
      user: loginUser,
      audit: input.audit,
      auditMetadata: {
        oauth: true,
        providerId: provider.id,
        providerKind: provider.kind,
      },
    });

    await logAuthEvent(input.audit, 'OAUTH_LOGIN_SUCCESS', {
      userId: loginUser.id,
      email: loginUser.email,
      success: true,
      metadata: {
        providerId: provider.id,
        providerKind: provider.kind,
        subject: claims.subject,
        provisioned: provider.autoProvision,
      },
    });

    return { sessionResult };
  } catch (error) {
    await logAuthEvent(input.audit, 'OAUTH_LOGIN_FAILED', {
      success: false,
      reason: error instanceof Error ? error.message : 'OAuth callback failed',
      metadata: { providerId: provider.id },
    });
    return { errorCode: 'oauth_provider' as const };
  }
};

export const reloadIdentityProviderRegistry = (providers: IdentityProviderConfig[]): void => {
  bootstrapProviderRegistry(providers);
};
