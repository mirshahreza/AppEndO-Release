import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { resolveAuthRateLimitKey } from '../authRateLimitKey';

const asRequest = (partial: { ip?: string; remoteAddress?: string; forwarded?: string }): Request => ({
  ip: partial.ip,
  headers: partial.forwarded ? { 'x-forwarded-for': partial.forwarded } : {},
  socket: { remoteAddress: partial.remoteAddress },
} as Request);

describe('resolveAuthRateLimitKey', () => {
  it('uses req.ip and ignores x-forwarded-for', () => {
    expect(resolveAuthRateLimitKey(asRequest({
      ip: '10.0.0.8',
      remoteAddress: '127.0.0.1',
      forwarded: '1.2.3.4, 5.6.7.8',
    }))).toBe('10.0.0.8');
  });

  it('falls back to the socket address when ip is empty', () => {
    expect(resolveAuthRateLimitKey(asRequest({
      remoteAddress: '192.168.1.5',
      forwarded: '9.9.9.9',
    }))).toBe('192.168.1.5');
  });
});
