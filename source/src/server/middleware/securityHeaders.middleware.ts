import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { buildDashboardFrameAncestorsCsp } from '../../shared/lib/dashboardCanvas';

/** SEC-2-3 — baseline HTTP hardening. CSP stays off globally so the SPA / Monaco / Vite HMR keep working. */
export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'off',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

export const PRODUCTION_HSTS_VALUE = 'max-age=15552000; includeSubDomains';

export const applySecurityHeadersToResponse = (
  res: Pick<Response, 'setHeader'>,
  isProduction: boolean,
): void => {
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', PRODUCTION_HSTS_VALUE);
  }
};

/** When origins are allowlisted, drop X-Frame-Options so CSP frame-ancestors can permit those parents. */
export const applyDashboardFramePolicy = (
  res: Pick<Response, 'setHeader' | 'removeHeader'>,
  origins: unknown,
): void => {
  const csp = buildDashboardFrameAncestorsCsp(origins);
  if (!csp) {
    return;
  }
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', csp);
};

export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  applySecurityHeadersToResponse(res, env.isProduction);
  next();
};
