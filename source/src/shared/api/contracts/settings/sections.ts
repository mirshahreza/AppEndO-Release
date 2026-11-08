import { DEFAULT_SETTINGS } from './constants';
import type { AppSettings } from './types';

export const APP_SETTINGS_SECTION_KEYS = [
  'server-functions',
  'logs',
  'auth',
  'email',
  'pwa',
  'logging',
] as const;

export type AppSettingsSectionKey = typeof APP_SETTINGS_SECTION_KEYS[number];

const SERVER_FUNCTIONS_FIELDS = [
  'serverFunctionVmMode',
  'serverFunctionRamAllocation',
  'serverFunctionTimeout',
  'serverFunctionAutoLogging',
  'developerToolbar',
  'dataApiListIncludeCountEnabled',
  'dataApiListCacheDefaultEnabled',
  'dataApiListCacheDefaultTtlMs',
] as const satisfies readonly (keyof AppSettings)[];

const LOGS_FIELDS = [
  'logRetentionDays',
  'logRetention',
  'logViewerLimit',
  'logDbPersistMinLevel',
  'logDbBatchSize',
  'logDbFlushIntervalMs',
  'logDbMaxQueueSize',
  'logLevelInfoEnabled',
  'logLevelWarnEnabled',
  'logLevelErrorEnabled',
  'logLevelDebugEnabled',
] as const satisfies readonly (keyof AppSettings)[];

const AUTH_FIELDS = [
  'authAllowUsername',
  'authAllowEmail',
  'authAllowMobile',
  'authOtpEnabled',
  'authOtpChannelEmail',
  'authOtpChannelSms',
  'authOtpExpirySeconds',
  'authOtpMaxAttempts',
  'authEmailVerifyEnabled',
  'authEmailVerifyRequired',
  'authMobileVerifyEnabled',
  'authMobileVerifyRequired',
  'authLockoutEnabled',
  'authLockoutMaxFailures',
  'authLockoutWindowSeconds',
  'authRegistrationEnabled',
  'authRegistrationRequireTerms',
  'authRegistrationDefaultRole',
] as const satisfies readonly (keyof AppSettings)[];

const EMAIL_FIELDS = [
  'smtpEnabled',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUser',
  'smtpPass',
  'smtpHasPassword',
  'smtpFromEmail',
  'smtpFromName',
] as const satisfies readonly (keyof AppSettings)[];

const SECTION_FIELD_MAP: Record<AppSettingsSectionKey, readonly string[]> = {
  'server-functions': SERVER_FUNCTIONS_FIELDS,
  logs: LOGS_FIELDS,
  auth: AUTH_FIELDS,
  email: EMAIL_FIELDS,
  pwa: ['pwa'],
  logging: ['methodConfigs'],
};

export function pickSectionFields(
  sectionKey: AppSettingsSectionKey,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const fields = SECTION_FIELD_MAP[sectionKey];
  const output: Record<string, unknown> = {};

  if (sectionKey === 'pwa') {
    output.pwa = source.pwa ?? DEFAULT_SETTINGS.pwa;
    return output;
  }

  if (sectionKey === 'logging') {
    const logging = source.logging;
    if (logging && typeof logging === 'object') {
      const methodConfigs = (logging as Record<string, unknown>).methodConfigs;
      if (methodConfigs && typeof methodConfigs === 'object') {
        output.methodConfigs = methodConfigs;
      }
    }
    return output;
  }

  fields.forEach((field) => {
    if (field in source) {
      output[field] = source[field];
    }
  });

  return output;
}

export function defaultSectionValue(sectionKey: AppSettingsSectionKey): Record<string, unknown> {
  if (sectionKey === 'pwa') {
    return { pwa: { ...DEFAULT_SETTINGS.pwa } };
  }

  if (sectionKey === 'logging') {
    return { methodConfigs: {} };
  }

  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  SECTION_FIELD_MAP[sectionKey].forEach((field) => {
    output[field] = defaults[field];
  });
  return output;
}

export function mergeSectionsToFlatPayload(
  sections: Partial<Record<AppSettingsSectionKey, Record<string, unknown>>>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  APP_SETTINGS_SECTION_KEYS.forEach((sectionKey) => {
    const sectionValue = sections[sectionKey];
    if (!sectionValue) return;

    if (sectionKey === 'pwa') {
      output.pwa = sectionValue.pwa ?? DEFAULT_SETTINGS.pwa;
      return;
    }

    if (sectionKey === 'logging') {
      output.logging = {
        methodConfigs: sectionValue.methodConfigs ?? {},
      };
      return;
    }

    SECTION_FIELD_MAP[sectionKey].forEach((field) => {
      if (field in sectionValue) {
        output[field] = sectionValue[field];
      }
    });
  });

  return output;
}

export function splitFlatPayloadIntoSections(
  payload: Record<string, unknown>,
): Partial<Record<AppSettingsSectionKey, Record<string, unknown>>> {
  const sections: Partial<Record<AppSettingsSectionKey, Record<string, unknown>>> = {};

  APP_SETTINGS_SECTION_KEYS.forEach((sectionKey) => {
    const sectionValue = pickSectionFields(sectionKey, payload);
    const hasValue = sectionKey === 'logging'
      ? Object.keys(sectionValue.methodConfigs as object || {}).length > 0
      : Object.keys(sectionValue).length > 0;

    if (hasValue || sectionKey === 'pwa') {
      sections[sectionKey] = {
        ...defaultSectionValue(sectionKey),
        ...sectionValue,
      };
    }
  });

  return sections;
}
