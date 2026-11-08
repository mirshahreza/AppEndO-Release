import crypto from 'node:crypto';
import { env } from '../../config/env';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getGitSettings } from '../../db/gitSettingsStore';
import { hydrateGitOAuthSecret } from '../../domain/security/credentialVault/platformSettingsSecrets';
import { HttpError } from '../../errors/HttpError';
import type { GitGithubOAuthSessionStatus, GitGithubOAuthStartResult } from '../../../shared/api/contracts/git/oauth';
import { persistGitAuthCredentials } from './gitAuthPersistence';

type PendingGithubOAuthSession = {
  state: string;
  codeVerifier: string;
  userId: number;
  expiresAt: number;
  result?: GitGithubOAuthSessionStatus;
};

const pendingSessions = new Map<string, PendingGithubOAuthSession>();

const SESSION_TTL_MS = 10 * 60 * 1000;

const toBase64Url = (buffer: Buffer): string => (
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
);

const createCodeVerifier = (): string => toBase64Url(crypto.randomBytes(32));

const createCodeChallenge = (codeVerifier: string): string => (
  toBase64Url(crypto.createHash('sha256').update(codeVerifier).digest())
);

const purgeExpiredSessions = (): void => {
  const now = Date.now();
  for (const [sessionId, session] of pendingSessions.entries()) {
    if (session.expiresAt <= now) {
      pendingSessions.delete(sessionId);
    }
  }
};

export const resolveGithubOAuthConfig = async (): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  available: boolean;
}> => {
  const envClientId = (process.env.GIT_GITHUB_OAUTH_CLIENT_ID || '').trim();
  const envClientSecret = (process.env.GIT_GITHUB_OAUTH_CLIENT_SECRET || '').trim();
  const appUrl = (process.env.APP_URL || env.appUrl || 'http://localhost:3000').replace(/\/$/, '');

  let clientId = envClientId;
  let clientSecret = envClientSecret;

  if (!clientId || !clientSecret) {
    try {
      const gitSettings = getGitSettings(SETTINGS_PATH);
      clientId = clientId || gitSettings.githubOAuth?.clientId?.trim() || '';
      if (!clientSecret && gitSettings.githubOAuth?.hasClientSecret) {
        clientSecret = await hydrateGitOAuthSecret(gitSettings);
      }
    } catch {
      // settings file may be unavailable during early boot tests
    }
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/git/oauth/github/callback`,
    available: Boolean(clientId && clientSecret),
  };
};

export const resolveGithubOAuthAvailability = async (): Promise<{
  available: boolean;
  redirectUri: string;
  setupHint: string;
}> => {
  const config = await resolveGithubOAuthConfig();
  return {
    available: config.available,
    redirectUri: config.redirectUri,
    setupHint: config.available
      ? ''
      : 'Create a GitHub OAuth App and set GIT_GITHUB_OAUTH_CLIENT_ID / GIT_GITHUB_OAUTH_CLIENT_SECRET environment variables, or add git.githubOAuth.clientId and git.githubOAuth.clientSecret in settings.json. Use the redirect URI shown below as the OAuth callback URL.',
  };
};

export const isGithubOAuthAvailable = async (): Promise<boolean> => (
  (await resolveGithubOAuthConfig()).available
);

export const revokeGithubAccessToken = async (accessToken: string): Promise<void> => {
  const token = accessToken.trim();
  if (!token) {
    return;
  }

  const config = await resolveGithubOAuthConfig();
  if (!config.available) {
    return;
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  try {
    await fetch(`https://api.github.com/portals/${encodeURIComponent(config.clientId)}/token`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ access_token: token }),
    });
  } catch {
    // Revocation is best-effort; local credential removal still proceeds.
  }
};

export const startGithubOAuth = async (userId: number): Promise<GitGithubOAuthStartResult> => {
  purgeExpiredSessions();

  const config = await resolveGithubOAuthConfig();
  if (!config.available) {
    throw new HttpError(503, 'GitHub OAuth is not configured on the server.');
  }

  const sessionId = toBase64Url(crypto.randomBytes(16));
  const state = toBase64Url(crypto.randomBytes(16));
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  pendingSessions.set(sessionId, {
    state,
    codeVerifier,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'repo read:user',
    state: `${sessionId}.${state}`,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    authorizeUrl: `https://github.com/login/oauth/authorize?${params.toString()}`,
    sessionId,
  };
};

const exchangeGithubOAuthCode = async (code: string, codeVerifier: string): Promise<string> => {
  const config = await resolveGithubOAuthConfig();
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const payload = await response.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  const accessToken = payload.access_token?.trim();
  if (!accessToken) {
    throw new HttpError(
      400,
      payload.error_description?.trim() || payload.error?.trim() || 'GitHub OAuth token exchange failed.',
    );
  }

  return accessToken;
};

const fetchGithubUsername = async (accessToken: string): Promise<string | undefined> => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = await response.json() as { login?: string };
  return payload.login?.trim() || undefined;
};

export const completeGithubOAuthCallback = async (
  code: string,
  stateParam: string,
): Promise<{ sessionId: string; result: GitGithubOAuthSessionStatus }> => {
  purgeExpiredSessions();

  const [sessionId, state] = stateParam.split('.');
  if (!sessionId || !state) {
    throw new HttpError(400, 'Invalid OAuth state.');
  }

  const session = pendingSessions.get(sessionId);
  if (!session || session.state !== state) {
    throw new HttpError(400, 'OAuth session was not found or has expired.');
  }

  if (session.expiresAt <= Date.now()) {
    pendingSessions.delete(sessionId);
    throw new HttpError(400, 'OAuth session has expired.');
  }

  try {
    const accessToken = await exchangeGithubOAuthCode(code, session.codeVerifier);
    const username = await fetchGithubUsername(accessToken);
    try {
      await persistGitAuthCredentials({
        kind: 'https_pat',
        username: username || 'x-access-token',
        token: accessToken,
      });
    } catch {
      // OAuth succeeded; credential persistence failure should not block sign-in completion.
    }
    const result: GitGithubOAuthSessionStatus = {
      status: 'complete',
      accessToken,
      username,
    };
    session.result = result;
    return { sessionId, result };
  } catch (error: unknown) {
    const message = error instanceof HttpError
      ? error.message
      : 'GitHub OAuth callback failed.';
    const result: GitGithubOAuthSessionStatus = {
      status: 'error',
      error: message,
    };
    session.result = result;
    return { sessionId, result };
  }
};

export const getGithubOAuthSessionStatus = (sessionId: string): GitGithubOAuthSessionStatus => {
  purgeExpiredSessions();

  const session = pendingSessions.get(sessionId);
  if (!session) {
    return { status: 'error', error: 'OAuth session was not found or has expired.' };
  }

  if (session.result) {
    pendingSessions.delete(sessionId);
    return session.result;
  }

  if (session.expiresAt <= Date.now()) {
    pendingSessions.delete(sessionId);
    return { status: 'error', error: 'OAuth session has expired.' };
  }

  return { status: 'pending' };
};

export const buildGithubOAuthCallbackHtml = (
  sessionId: string,
  result: GitGithubOAuthSessionStatus,
): string => {
  const payload = JSON.stringify({
    type: 'appendo-git-github-oauth',
    sessionId,
    status: result.status === 'complete' ? 'complete' : 'error',
    username: result.username,
    accessToken: result.accessToken,
    error: result.error,
  });

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GitHub sign-in</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; color: #334155; }
    </style>
  </head>
  <body>
    <p>${result.status === 'complete' ? 'GitHub sign-in complete. You can close this window.' : 'GitHub sign-in failed. You can close this window and try again.'}</p>
    <script>
      (function () {
        var payload = ${payload};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, window.location.origin);
          }
        } catch (error) {}
        window.setTimeout(function () { window.close(); }, 400);
      })();
    </script>
  </body>
</html>`;
};

export const __resetGithubOAuthSessionsForTests = (): void => {
  pendingSessions.clear();
};
