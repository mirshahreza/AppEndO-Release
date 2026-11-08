import crypto from 'node:crypto';

export type OAuthPendingSession = {
  providerId: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  expiresAt: number;
};

const pendingSessions = new Map<string, OAuthPendingSession>();
const SESSION_TTL_MS = 10 * 60 * 1000;

export const toBase64Url = (buffer: Buffer): string => (
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
);

export const createCodeVerifier = (): string => toBase64Url(crypto.randomBytes(32));

export const createCodeChallenge = (codeVerifier: string): string => (
  toBase64Url(crypto.createHash('sha256').update(codeVerifier).digest())
);

export const purgeExpiredOAuthSessions = (): void => {
  const now = Date.now();
  for (const [sessionId, session] of pendingSessions.entries()) {
    if (session.expiresAt <= now) {
      pendingSessions.delete(sessionId);
    }
  }
};

export const createOAuthSession = (input: {
  providerId: string;
  redirectUri: string;
}): { sessionId: string; state: string; codeVerifier: string; codeChallenge: string } => {
  purgeExpiredOAuthSessions();

  const sessionId = toBase64Url(crypto.randomBytes(16));
  const state = toBase64Url(crypto.randomBytes(16));
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  pendingSessions.set(sessionId, {
    providerId: input.providerId,
    state,
    codeVerifier,
    redirectUri: input.redirectUri,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return { sessionId, state, codeVerifier, codeChallenge };
};

export const consumeOAuthSession = (
  sessionId: string,
  state: string,
  providerId: string,
): OAuthPendingSession => {
  purgeExpiredOAuthSessions();

  const session = pendingSessions.get(sessionId);
  pendingSessions.delete(sessionId);

  if (!session) {
    throw new Error('OAUTH_STATE');
  }
  if (session.state !== state || session.providerId !== providerId) {
    throw new Error('OAUTH_STATE');
  }
  if (session.expiresAt <= Date.now()) {
    throw new Error('OAUTH_STATE');
  }

  return session;
};

export const __resetOAuthSessionsForTests = (): void => {
  pendingSessions.clear();
};
