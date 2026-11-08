import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../settings/appSettings.service', () => ({
  readAuthLockoutSettings: vi.fn(),
}));

import { readAuthLockoutSettings } from '../../settings/appSettings.service';
import {
  checkLoginRateLimit,
  getLoginRateLimitKey,
  registerLoginFailure,
  resetLoginAttemptsForTests,
} from '../loginAttempt.service';

const enabledLockout = {
  enabled: true,
  maxFailures: 3,
  windowMs: 60_000,
  lockMs: 60_000,
};

describe('loginAttempt.service', () => {
  beforeEach(() => {
    resetLoginAttemptsForTests();
    vi.mocked(readAuthLockoutSettings).mockReturnValue(enabledLockout);
  });

  it('does not block when lockout is disabled', () => {
    vi.mocked(readAuthLockoutSettings).mockReturnValue({
      enabled: false,
      maxFailures: 3,
      windowMs: 60_000,
      lockMs: 60_000,
    });

    const key = getLoginRateLimitKey('127.0.0.1', 'user@example.com');
    registerLoginFailure(key);
    registerLoginFailure(key);
    registerLoginFailure(key);

    expect(checkLoginRateLimit(key)).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it('blocks after max failures from settings', () => {
    const key = getLoginRateLimitKey('127.0.0.1', 'user@example.com');

    registerLoginFailure(key);
    registerLoginFailure(key);
    expect(checkLoginRateLimit(key)).toEqual({ blocked: false, retryAfterSeconds: 0 });

    registerLoginFailure(key);
    const blocked = checkLoginRateLimit(key);
    expect(blocked.blocked).toBe(true);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('respects updated maxFailures setting', () => {
    vi.mocked(readAuthLockoutSettings).mockReturnValue({
      enabled: true,
      maxFailures: 2,
      windowMs: 60_000,
      lockMs: 60_000,
    });

    const key = getLoginRateLimitKey('10.0.0.1', 'other@example.com');
    registerLoginFailure(key);
    registerLoginFailure(key);

    expect(checkLoginRateLimit(key).blocked).toBe(true);
  });
});
