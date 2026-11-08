import type {
  NormalizedIdentityClaims,
  OAuthAuthorizationContext,
  OAuthIdentityProviderAdapter,
  OAuthTokenExchangeContext,
  OAuthTokenExchangeResult,
} from '../../../../shared/api/contracts/systemExtensions/types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export const googleOAuthAdapter: OAuthIdentityProviderAdapter = {
  extension: {
    type: 'identity-provider',
    providerKind: 'oauth',
    id: 'google-oauth',
    label: 'Google',
    enabled: true,
    trusted: true,
    signed: true,
    capabilities: ['auth.read', 'auth.callback', 'profile.map', 'claims.map'],
  },
  defaultScopes: ['openid', 'email', 'profile'],
  buildAuthorizationUrl: (ctx: OAuthAuthorizationContext) => {
    const params = new URLSearchParams({
      client_id: ctx.clientId,
      redirect_uri: ctx.redirectUri,
      response_type: 'code',
      scope: ctx.scopes.join(' '),
      state: ctx.state,
      code_challenge: ctx.codeChallenge,
      code_challenge_method: ctx.codeChallengeMethod,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  },
  exchangeToken: async (ctx: OAuthTokenExchangeContext): Promise<OAuthTokenExchangeResult> => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: ctx.code,
      redirect_uri: ctx.redirectUri,
      client_id: ctx.clientId,
      client_secret: ctx.clientSecret,
      code_verifier: ctx.codeVerifier,
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
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
      throw new Error(payload.error_description?.trim() || payload.error?.trim() || 'Google token exchange failed.');
    }

    return {
      accessToken,
      idToken: payload.id_token,
      tokenType: payload.token_type,
      expiresIn: payload.expires_in,
      refreshToken: payload.refresh_token,
    };
  },
  fetchProfile: async ({ accessToken }) => {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch Google profile.');
    }
    const raw = await response.json() as Record<string, unknown>;
    return googleOAuthAdapter.mapClaims(raw);
  },
  mapClaims: (raw: Record<string, unknown>): NormalizedIdentityClaims => {
    const subject = String(raw.sub ?? '').trim();
    if (!subject) {
      throw new Error('Google profile is missing subject.');
    }
    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : undefined;
    return {
      subject,
      email,
      emailVerified: raw.email_verified === true,
      givenName: typeof raw.given_name === 'string' ? raw.given_name : undefined,
      familyName: typeof raw.family_name === 'string' ? raw.family_name : undefined,
      displayName: typeof raw.name === 'string' ? raw.name : undefined,
      rawClaims: raw,
    };
  },
};

export const testGoogleOAuthReachability = async (): Promise<{ ok: boolean; message: string }> => {
  try {
    const response = await fetch('https://accounts.google.com/.well-known/openid-configuration');
    if (!response.ok) {
      return { ok: false, message: `Google discovery returned HTTP ${response.status}.` };
    }
    return { ok: true, message: 'Config shape OK — Google OIDC discovery reachable.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Google discovery request failed.',
    };
  }
};
