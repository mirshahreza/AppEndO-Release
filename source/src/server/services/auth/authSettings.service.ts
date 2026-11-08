import { DEFAULT_SETTINGS } from '../../../shared/api/contracts/settings/constants';
import { getCachedSection } from '../settings/appSettingsCache';
import { getAuthIdentitySettings } from '../../db/identityProvidersStore';
import { SETTINGS_PATH } from '../../config/settingsFile';
import type { AuthLockoutSettings } from '../settings/appSettings.service';

export type AuthLoginSettings = {
  allowUsername: boolean;
  allowEmail: boolean;
  allowMobile: boolean;
};

export type AuthOtpSettings = {
  enabled: boolean;
  channelEmail: boolean;
  expirySeconds: number;
  maxAttempts: number;
};

export type AuthVerificationSettings = {
  emailVerifyEnabled: boolean;
  emailVerifyRequired: boolean;
};

export type AuthRegistrationSettings = {
  enabled: boolean;
  requireTerms: boolean;
  defaultRole: string;
};

export const readAuthLoginSettings = (): AuthLoginSettings => {
  const auth = getCachedSection('auth');
  return {
    allowUsername: auth.authAllowUsername !== false,
    allowEmail: auth.authAllowEmail !== false,
    allowMobile: auth.authAllowMobile === true,
  };
};

export const readAuthOtpSettings = (): AuthOtpSettings => {
  const auth = getCachedSection('auth');
  const expiryRaw = auth.authOtpExpirySeconds;
  const maxAttemptsRaw = auth.authOtpMaxAttempts;

  return {
    enabled: auth.authOtpEnabled === true,
    channelEmail: auth.authOtpChannelEmail !== false,
    expirySeconds: typeof expiryRaw === 'number' && expiryRaw > 0
      ? expiryRaw
      : DEFAULT_SETTINGS.authOtpExpirySeconds,
    maxAttempts: typeof maxAttemptsRaw === 'number' && maxAttemptsRaw > 0
      ? maxAttemptsRaw
      : DEFAULT_SETTINGS.authOtpMaxAttempts,
  };
};

export const readAuthVerificationSettings = (): AuthVerificationSettings => {
  const auth = getCachedSection('auth');
  return {
    emailVerifyEnabled: auth.authEmailVerifyEnabled === true,
    emailVerifyRequired: auth.authEmailVerifyRequired === true,
  };
};

export const readAuthRegistrationSettings = (): AuthRegistrationSettings => {
  const auth = getCachedSection('auth');
  const defaultRole = typeof auth.authRegistrationDefaultRole === 'string'
    ? auth.authRegistrationDefaultRole.trim().toUpperCase()
    : DEFAULT_SETTINGS.authRegistrationDefaultRole;

  return {
    enabled: auth.authRegistrationEnabled === true,
    requireTerms: auth.authRegistrationRequireTerms === true,
    defaultRole: defaultRole || DEFAULT_SETTINGS.authRegistrationDefaultRole,
  };
};

export const readAuthPublicConfig = () => {
  const login = readAuthLoginSettings();
  const otp = readAuthOtpSettings();
  const verification = readAuthVerificationSettings();
  const registration = readAuthRegistrationSettings();
  const identitySettings = getAuthIdentitySettings(SETTINGS_PATH);

  return {
    login,
    otp: {
      enabled: otp.enabled && otp.channelEmail,
      channelEmail: otp.channelEmail,
    },
    verification: {
      emailVerifyEnabled: verification.emailVerifyEnabled,
      emailVerifyRequired: verification.emailVerifyRequired,
    },
    registration,
    identityProviders: identitySettings.identityProviders
      .filter((item) => item.enabled)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
      })),
  };
};

export type { AuthLockoutSettings };
