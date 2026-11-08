import { readAuthLockoutSettings } from '../settings/appSettings.service';

type LoginAttemptState = {
  firstAttemptAt: number;
  failedCount: number;
  lockedUntil: number;
};

const loginAttempts = new Map<string, LoginAttemptState>();

export const getLoginRateLimitKey = (ip: string, email: string) => `${ip}:${email.trim().toLowerCase()}`;

export const checkLoginRateLimit = (key: string) => {
  const lockout = readAuthLockoutSettings();
  // When lockout is disabled, skip IP/email rate limiting entirely.
  if (!lockout.enabled) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (state.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000)),
    };
  }

  if ((now - state.firstAttemptAt) > lockout.windowMs) {
    loginAttempts.delete(key);
  }

  return { blocked: false, retryAfterSeconds: 0 };
};

export const registerLoginFailure = (key: string) => {
  const lockout = readAuthLockoutSettings();
  if (!lockout.enabled) {
    return;
  }

  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || (now - current.firstAttemptAt) > lockout.windowMs) {
    loginAttempts.set(key, {
      firstAttemptAt: now,
      failedCount: 1,
      lockedUntil: 0,
    });
    return;
  }

  const failedCount = current.failedCount + 1;
  const lockedUntil = failedCount >= lockout.maxFailures ? now + lockout.lockMs : 0;
  loginAttempts.set(key, {
    firstAttemptAt: current.firstAttemptAt,
    failedCount,
    lockedUntil,
  });
};

export const clearLoginFailures = (key: string) => {
  loginAttempts.delete(key);
};

/** Test-only helper to reset in-memory attempt state between cases. */
export const resetLoginAttemptsForTests = (): void => {
  loginAttempts.clear();
};
