import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SentEmailCapture } from '../../../test/authE2eTestHarness';
import {
  bootstrapAuthE2eEnvironment,
  buildUniqueTestEmail,
  isDatabaseReachable,
  parseLoginOtpFromText,
  parseResetPasswordFromText,
  parseVerifyEmailFromText,
  shutdownAuthE2eEnvironment,
  testAuditContext,
} from '../../../test/authE2eTestHarness';
import { AuthService } from '../../auth.service';
import type { Pool } from 'pg';

const sentEmails: SentEmailCapture[] = [];

vi.mock('../../email/email.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../email/email.service')>();
  return {
    ...actual,
    sendEmail: vi.fn(async (input: SentEmailCapture) => {
      sentEmails.push(input);
      return { delivered: false, mode: 'log' as const };
    }),
  };
});

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('auth membership E2E (email-only)', () => {
  let pool: Pool;
  const authService = new AuthService();

  beforeAll(async () => {
    ({ pool } = await bootstrapAuthE2eEnvironment());
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      await shutdownAuthE2eEnvironment(pool);
    }
  });

  beforeEach(() => {
    sentEmails.length = 0;
  });

  it('register → verify email → login with OTP → forgot/reset password', async () => {
    const email = buildUniqueTestEmail();
    const initialPassword = 'TestPass123!';
    const resetPassword = 'ResetPass456!';

    const registerResult = await authService.register({
      email,
      password: initialPassword,
      audit: testAuditContext,
    });

    expect(registerResult.body.success).toBe(true);
    expect(registerResult.body.requiresEmailVerification).toBe(true);
    expect(sentEmails.some((item) => item.subject.includes('Verify'))).toBe(true);

    const verifyEmail = sentEmails.find((item) => item.subject.includes('Verify'));
    expect(verifyEmail).toBeDefined();

    const verifyParams = parseVerifyEmailFromText(verifyEmail!.text);
    expect(verifyParams).not.toBeNull();

    const verifyResult = await authService.verifyEmail({
      token: verifyParams!.token,
      challengeId: verifyParams!.challengeId,
      audit: testAuditContext,
    });
    expect(verifyResult.body.success).toBe(true);

    sentEmails.length = 0;

    const loginStep1 = await authService.login({
      email,
      password: initialPassword,
      ip: '127.0.0.1',
      audit: testAuditContext,
    });

    expect(loginStep1.body.success).toBe(true);
    expect('requiresOtp' in loginStep1.body && loginStep1.body.requiresOtp).toBe(true);

    const otpEmail = sentEmails.find((item) => item.subject.includes('login verification'));
    expect(otpEmail).toBeDefined();

    const otpCode = parseLoginOtpFromText(otpEmail!.text);
    expect(otpCode).toMatch(/^\d{6}$/);

    const loginStep2 = await authService.login({
      email,
      password: initialPassword,
      otpCode: otpCode!,
      challengeId: ('challengeId' in loginStep1.body ? loginStep1.body.challengeId : undefined) as number,
      ip: '127.0.0.1',
      audit: testAuditContext,
    });

    expect(loginStep2.body.success).toBe(true);
    expect('cookies' in loginStep2).toBe(true);

    sentEmails.length = 0;

    const forgotResult = await authService.forgotPassword({
      email,
      audit: testAuditContext,
    });
    expect(forgotResult.body.success).toBe(true);

    const resetEmail = sentEmails.find((item) => item.subject.includes('Reset'));
    expect(resetEmail).toBeDefined();

    const resetParams = parseResetPasswordFromText(resetEmail!.text);
    expect(resetParams).not.toBeNull();

    const resetResult = await authService.resetPassword({
      token: resetParams!.token,
      challengeId: resetParams!.challengeId,
      newPassword: resetPassword,
      audit: testAuditContext,
    });
    expect(resetResult.body.success).toBe(true);

    sentEmails.length = 0;

    const loginAfterResetStep1 = await authService.login({
      email,
      password: resetPassword,
      ip: '127.0.0.1',
      audit: testAuditContext,
    });

    expect(loginAfterResetStep1.body.success).toBe(true);
    expect('requiresOtp' in loginAfterResetStep1.body && loginAfterResetStep1.body.requiresOtp).toBe(true);

    const otpEmailAfterReset = sentEmails.find((item) => item.subject.includes('login verification'));
    const otpAfterReset = parseLoginOtpFromText(otpEmailAfterReset!.text);

    const loginAfterResetStep2 = await authService.login({
      email,
      password: resetPassword,
      otpCode: otpAfterReset!,
      challengeId: ('challengeId' in loginAfterResetStep1.body
        ? loginAfterResetStep1.body.challengeId
        : undefined) as number,
      ip: '127.0.0.1',
      audit: testAuditContext,
    });

    expect(loginAfterResetStep2.body.success).toBe(true);
    expect('cookies' in loginAfterResetStep2).toBe(true);
  });
});
