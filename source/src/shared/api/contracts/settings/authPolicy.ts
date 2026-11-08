export type SettingsNodeEnv = 'development' | 'production' | 'test';

/** Matches server `ensureDevSimpleAuthSettings` — hardening is admin-configurable only outside development. */
export const isAuthHardeningLocked = (nodeEnv: SettingsNodeEnv | string | undefined): boolean =>
  nodeEnv !== 'production' && nodeEnv !== 'test';

export const AUTH_DEV_SIMPLE_LOGIN_NOTICE =
  'Development mode keeps login on simple username/password. OTP, verification gates, and public registration stay off and are restored on server restart. Enable these in production when your deployment requires them.';
