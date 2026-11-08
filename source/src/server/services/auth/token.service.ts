import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  getAccessTokenSecret,
  getRefreshTokenSecret,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../constants/auth';
import type { AuthUser } from './types';

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (user: AuthUser) => jwt.sign(
  { sub: user.id, email: user.email, role: user.role, roles: user.roles, type: 'access' },
  getAccessTokenSecret(),
  { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
);

export const signRefreshToken = (user: AuthUser, jti: string) => jwt.sign(
  { sub: user.id, email: user.email, role: user.role, roles: user.roles, type: 'refresh', jti },
  getRefreshTokenSecret(),
  { expiresIn: REFRESH_TOKEN_TTL_SECONDS },
);

export { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS };
