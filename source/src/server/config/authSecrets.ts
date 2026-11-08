import { buildDefaultRuntimeSettings } from '../config/settingsFile';

const DEV_ACCESS_TOKEN_SECRET = 'dev_access_token_secret_change_me';
const DEV_REFRESH_TOKEN_SECRET = 'dev_refresh_token_secret_change_me';

export type SecuritySettings = {
  accessTokenSecret: string;
  refreshTokenSecret: string;
};

let activeSecrets: SecuritySettings = {
  accessTokenSecret: buildDefaultRuntimeSettings().accessTokenSecret,
  refreshTokenSecret: buildDefaultRuntimeSettings().refreshTokenSecret,
};

export const getAuthSecrets = (): SecuritySettings => ({ ...activeSecrets });

export const loadAuthSecrets = (secrets: SecuritySettings): void => {
  activeSecrets = {
    accessTokenSecret: secrets.accessTokenSecret.trim(),
    refreshTokenSecret: secrets.refreshTokenSecret.trim(),
  };
};

export const resetAuthSecretsForTests = (): void => {
  const defaults = buildDefaultRuntimeSettings();
  activeSecrets = {
    accessTokenSecret: defaults.accessTokenSecret,
    refreshTokenSecret: defaults.refreshTokenSecret,
  };
};

export const usesDefaultJwtSecrets = (secrets: SecuritySettings = getAuthSecrets()): boolean => (
  secrets.accessTokenSecret === DEV_ACCESS_TOKEN_SECRET
  || secrets.refreshTokenSecret === DEV_REFRESH_TOKEN_SECRET
);

/** SEC-1-1 — production must not boot with placeholder JWT secrets. */
export const assertJwtSecretsForBoot = (isProduction: boolean): void => {
  if (!usesDefaultJwtSecrets()) {
    return;
  }
  if (isProduction && process.env.APPENDO_LOCAL_PROD_PUBLISH === '1') {
    return;
  }
  if (isProduction) {
    throw new Error(
      'Production boot blocked: configure platform JWT secrets in security settings.',
    );
  }
};
