import type { Response } from 'express';
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  buildCookieOptions,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../constants/auth';
import type { SessionCookies } from '../services/auth.service';

const setSessionCookies = (res: Response, cookies: SessionCookies) => {
  res.cookie(ACCESS_COOKIE_NAME, cookies.accessToken, buildCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
  res.cookie(REFRESH_COOKIE_NAME, cookies.refreshToken, buildCookieOptions(REFRESH_TOKEN_TTL_SECONDS));
};

const clearSessionCookies = (res: Response) => {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
};

export const applyAuthSideEffects = (
  res: Response,
  result: { cookies?: SessionCookies; clearCookies?: boolean },
) => {
  if (result.cookies) {
    setSessionCookies(res, result.cookies);
  }
  if (result.clearCookies) {
    clearSessionCookies(res);
  }
};
