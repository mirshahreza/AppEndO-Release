import type { AppSettings } from '../../shared/api/contracts/settings/types';

type M0DevAuthPresetKeys =
  | 'authRegistrationEnabled'
  | 'authEmailVerifyEnabled'
  | 'authEmailVerifyRequired'
  | 'authOtpEnabled'
  | 'authOtpChannelEmail';

/**
 * Canonical development auth posture — simple username/password login only.
 *
 * DO NOT enable OTP, email verification gates, or public registration in
 * non-production environments unless you are running auth E2E tests
 * (see M0_DEV_AUTH_PRESET). Production operators enable these features in
 * Settings when their deployment requires them.
 *
 * Enforced on every dev server boot and during `npm run setup`.
 * Source: src/server/setup/greenfieldInstall.ts · AGENTS.md · projectStandards.
 */
export const M0_DEV_SIMPLE_AUTH_PRESET: Pick<AppSettings, M0DevAuthPresetKeys> = {
  authRegistrationEnabled: false,
  authEmailVerifyEnabled: false,
  authEmailVerifyRequired: false,
  authOtpEnabled: false,
  authOtpChannelEmail: true,
};

/** Full M0 email membership flow — used by auth E2E tests only. Do not use in normal dev. */
export const M0_DEV_AUTH_PRESET: Pick<AppSettings, M0DevAuthPresetKeys> = {
  authRegistrationEnabled: true,
  authEmailVerifyEnabled: true,
  authEmailVerifyRequired: true,
  authOtpEnabled: true,
  authOtpChannelEmail: true,
};

export const devSimpleAuthPresetNeedsApply = (
  authSection: Record<string, unknown>,
): boolean => (
  (Object.entries(M0_DEV_SIMPLE_AUTH_PRESET) as Array<[keyof typeof M0_DEV_SIMPLE_AUTH_PRESET, boolean]>)
    .some(([key, value]) => authSection[key] !== value)
);
