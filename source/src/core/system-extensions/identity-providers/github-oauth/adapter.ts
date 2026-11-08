import type {
  NormalizedIdentityClaims,
  OAuthAuthorizationContext,
  OAuthIdentityProviderAdapter,
  OAuthTokenExchangeContext,
  OAuthTokenExchangeResult,
} from '../../../../shared/api/contracts/systemExtensions/types';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export const githubOAuthAdapter: OAuthIdentityProviderAdapter = {
  extension: {
    type: 'identity-provider',
    providerKind: 'oauth',
    id: 'github-oauth',
    label: 'GitHub',
    enabled: true,
    trusted: true,
    signed: true,
    capabilities: ['auth.read', 'auth.callback', 'profile.map', 'claims.map'],
  },
  defaultScopes: ['read:user', 'user:email'],
  buildAuthorizationUrl: (ctx: OAuthAuthorizationContext) => {
    const params = new URLSearchParams({
      client_id: ctx.clientId,
      redirect_uri: ctx.redirectUri,
      response_type: 'code',
      scope: ctx.scopes.join(' '),
      state: ctx.state,
      code_challenge: ctx.codeChallenge,
      code_challenge_method: ctx.codeChallengeMethod,
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  },
  exchangeToken: async (ctx: OAuthTokenExchangeContext): Promise<OAuthTokenExchangeResult> => {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: ctx.clientId,
        client_secret: ctx.clientSecret,
        code: ctx.code,
        redirect_uri: ctx.redirectUri,
        code_verifier: ctx.codeVerifier,
      }),
    });

    const payload = await response.json() as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    const accessToken = payload.access_token?.trim();
    if (!accessToken) {
      throw new Error(payload.error_description?.trim() || payload.error?.trim() || 'GitHub token exchange failed.');
    }

    return {
      accessToken,
      tokenType: payload.token_type,
    };
  },
  fetchProfile: async ({ accessToken }) => {
    const [userResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
    ]);

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub profile.');
    }

    const user = await userResponse.json() as Record<string, unknown>;
    const emails = emailsResponse.ok
      ? await emailsResponse.json() as Array<{ email?: string; primary?: boolean; verified?: boolean }>
      : [];

    const primaryEmail = emails.find((item) => item.primary && item.email)?.email
      ?? emails.find((item) => item.verified && item.email)?.email
      ?? emails[0]?.email;

    return githubOAuthAdapter.mapClaims({
      ...user,
      primary_email: primaryEmail,
      emails,
    });
  },
  mapClaims: (raw: Record<string, unknown>): NormalizedIdentityClaims => {
    const subject = String(raw.id ?? '').trim();
    if (!subject) {
      throw new Error('GitHub profile is missing id.');
    }

    const emails = Array.isArray(raw.emails)
      ? raw.emails as Array<{ email?: string; primary?: boolean; verified?: boolean }>
      : [];
    const primaryFromList = emails.find((item) => item.primary && item.email)?.email
      ?? emails.find((item) => item.verified && item.email)?.email;
    const email = (
      typeof raw.primary_email === 'string' ? raw.primary_email
        : primaryFromList
          ?? (typeof raw.email === 'string' ? raw.email : undefined)
    )?.trim().toLowerCase();

    const emailVerified = emails.some((item) => item.email?.toLowerCase() === email && item.verified === true);

    return {
      subject,
      email,
      emailVerified,
      givenName: typeof raw.name === 'string' ? raw.name : undefined,
      displayName: typeof raw.login === 'string' ? raw.login : undefined,
      rawClaims: raw,
    };
  },
};

export const testGithubOAuthReachability = async (clientId: string): Promise<{ ok: boolean; message: string }> => {
  if (!clientId.trim()) {
    return { ok: false, message: 'clientId is required.' };
  }
  try {
    const response = await fetch('https://api.github.com/', {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!response.ok) {
      return { ok: false, message: `GitHub API returned HTTP ${response.status}.` };
    }
    return { ok: true, message: 'Config shape OK — GitHub API reachable.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'GitHub API request failed.',
    };
  }
};
