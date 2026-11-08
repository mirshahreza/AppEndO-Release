import { env } from '../config/env';
import { getAuthSecrets } from '../config/authSecrets';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 3;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export const getAccessTokenSecret = (): string => getAuthSecrets().accessTokenSecret;
export const getRefreshTokenSecret = (): string => getAuthSecrets().refreshTokenSecret;

export const buildCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProduction,
  maxAge: maxAgeSeconds * 1000,
  path: '/',
});
