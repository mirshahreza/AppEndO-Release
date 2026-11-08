import { describe, expect, it } from 'vitest';
import {
  applyDashboardFramePolicy,
  applySecurityHeadersToResponse,
  BASE_SECURITY_HEADERS,
  PRODUCTION_HSTS_VALUE,
} from '../securityHeaders.middleware';

const collectHeaders = (isProduction: boolean): Record<string, string> => {
  const headers: Record<string, string> = {};
  applySecurityHeadersToResponse(
    { setHeader: (name, value) => { headers[name] = String(value); } },
    isProduction,
  );
  return headers;
};

describe('applySecurityHeadersToResponse (SEC-2-3)', () => {
  it('sets clickjacking, sniffing, and referrer headers in every environment', () => {
    const headers = collectHeaders(false);
    expect(headers).toMatchObject(BASE_SECURITY_HEADERS);
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('adds HSTS only in production', () => {
    const headers = collectHeaders(true);
    expect(headers['Strict-Transport-Security']).toBe(PRODUCTION_HSTS_VALUE);
  });
});

describe('applyDashboardFramePolicy', () => {
  it('keeps SAMEORIGIN when no allowlisted origins are present', () => {
    const headers: Record<string, string> = { 'X-Frame-Options': 'SAMEORIGIN' };
    applyDashboardFramePolicy(
      {
        setHeader: (name, value) => { headers[name] = String(value); },
        removeHeader: (name) => { delete headers[name]; },
      },
      [],
    );
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Content-Security-Policy']).toBeUndefined();
  });

  it('sends frame-ancestors and drops X-Frame-Options when origins are allowlisted', () => {
    const headers: Record<string, string> = { 'X-Frame-Options': 'SAMEORIGIN' };
    applyDashboardFramePolicy(
      {
        setHeader: (name, value) => { headers[name] = String(value); },
        removeHeader: (name) => { delete headers[name]; },
      },
      ['https://partner.example'],
    );
    expect(headers['X-Frame-Options']).toBeUndefined();
    expect(headers['Content-Security-Policy']).toBe("frame-ancestors 'self' https://partner.example");
  });
});
