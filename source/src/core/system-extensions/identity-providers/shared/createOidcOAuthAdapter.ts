import type {
  OAuthAuthorizationContext,
  OAuthIdentityProviderAdapter,
  OAuthProfileFetchContext,
  OAuthTokenExchangeContext,
  OAuthTokenExchangeResult,
} from '../../../../shared/api/contracts/systemExtensions/types';
import {
  decodeIdTokenPayload,
  fetchOidcDiscovery,
} from './oidcDiscovery';
import type { mapMicrosoftClaims, mapOidcClaims } from './mapOidcClaims';

type OidcAdapterConfig = {
  extensionId: string;
  label: string;
  defaultScopes: string[];
  mapClaims: typeof mapOidcClaims | typeof mapMicrosoftClaims;
};

const requireIssuerUrl = (issuerUrl?: string): string => {
  const normalized = issuerUrl?.trim() ?? '';
  if (!normalized) {
    throw new Error('issuerUrl is required.');
  }
  return normalized;
};

const resolveIssuerUrl = (ctx: OAuthProfileFetchContext): string => {
  if (ctx.issuerUrl?.trim()) {
    return requireIssuerUrl(ctx.issuerUrl);
  }
  if (ctx.idToken) {
    const claims = decodeIdTokenPayload(ctx.idToken);
    if (typeof claims.iss === 'string' && claims.iss.trim()) {
      return claims.iss.trim();
    }
  }
  throw new Error('issuerUrl is required.');
};

export const createOidcOAuthAdapter = (config: OidcAdapterConfig): OAuthIdentityProviderAdapter => ({
  extension: {
    type: 'identity-provider',
    providerKind: 'oauth',
    id: config.extensionId,
    label: config.label,
    enabled: true,
    trusted: true,
    signed: true,
    capabilities: ['auth.read', 'auth.callback', 'profile.map', 'claims.map'],
  },
  defaultScopes: config.defaultScopes,
  buildAuthorizationUrl: async (ctx: OAuthAuthorizationContext) => {
    const discovery = await fetchOidcDiscovery(requireIssuerUrl(ctx.issuerUrl));
    const params = new URLSearchParams({
      client_id: ctx.clientId,
      redirect_uri: ctx.redirectUri,
      response_type: 'code',
      scope: ctx.scopes.join(' '),
      state: ctx.state,
      code_challenge: ctx.codeChallenge,
      code_challenge_method: ctx.codeChallengeMethod,
    });
    return `${discovery.authorization_endpoint}?${params.toString()}`;
  },
  exchangeToken: async (ctx: OAuthTokenExchangeContext): Promise<OAuthTokenExchangeResult> => {
    const discovery = await fetchOidcDiscovery(requireIssuerUrl(ctx.issuerUrl));
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: ctx.code,
      redirect_uri: ctx.redirectUri,
      client_id: ctx.clientId,
      client_secret: ctx.clientSecret,
      code_verifier: ctx.codeVerifier,
    });

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const payload = await response.json() as {
      access_token?: string;
      id_token?: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    const accessToken = payload.access_token?.trim();
    if (!accessToken) {
      throw new Error(payload.error_description?.trim() || payload.error?.trim() || 'OIDC token exchange failed.');
    }

    return {
      accessToken,
      idToken: payload.id_token,
      tokenType: payload.token_type,
      expiresIn: payload.expires_in,
      refreshToken: payload.refresh_token,
    };
  },
  fetchProfile: async (ctx: OAuthProfileFetchContext) => {
    const issuerUrl = resolveIssuerUrl(ctx);
    const discovery = await fetchOidcDiscovery(issuerUrl);

    if (discovery.userinfo_endpoint) {
      const response = await fetch(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      if (response.ok) {
        const raw = await response.json() as Record<string, unknown>;
        return config.mapClaims(raw);
      }
    }

    if (ctx.idToken) {
      return config.mapClaims(decodeIdTokenPayload(ctx.idToken));
    }

    throw new Error('OIDC profile could not be resolved from userinfo or id_token.');
  },
  mapClaims: config.mapClaims,
});
