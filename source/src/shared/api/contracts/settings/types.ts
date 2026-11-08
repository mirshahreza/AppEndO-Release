import type { PwaSettings } from './pwa';
import type { LogRetentionSettings } from './retention';

export interface AppSettings {
  serverFunctionVmMode: string;
  serverFunctionRamAllocation: number;
  serverFunctionTimeout: number;
  serverFunctionAutoLogging: boolean;
  /** When false, Data API list operations skip Sequelize COUNT unless overridden per operation or ?includeCount. */
  dataApiListIncludeCountEnabled: boolean;
  /** Enable query-keyed GET cache for Data APIs whose function cache is off. */
  dataApiListCacheDefaultEnabled: boolean;
  dataApiListCacheDefaultTtlMs: number;
  logRetentionDays: number;
  logRetention: LogRetentionSettings;
  logViewerLimit: number;
  logDbPersistMinLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  logDbBatchSize: number;
  logDbFlushIntervalMs: number;
  logDbMaxQueueSize: number;
  logLevelInfoEnabled: boolean;
  logLevelWarnEnabled: boolean;
  logLevelErrorEnabled: boolean;
  logLevelDebugEnabled: boolean;
  authAllowUsername: boolean;
  authAllowEmail: boolean;
  authAllowMobile: boolean;
  authOtpEnabled: boolean;
  authOtpChannelEmail: boolean;
  authOtpChannelSms: boolean;
  authOtpExpirySeconds: number;
  authOtpMaxAttempts: number;
  authEmailVerifyEnabled: boolean;
  authEmailVerifyRequired: boolean;
  authMobileVerifyEnabled: boolean;
  authMobileVerifyRequired: boolean;
  authLockoutEnabled: boolean;
  authLockoutMaxFailures: number;
  authLockoutWindowSeconds: number;
  authRegistrationEnabled: boolean;
  authRegistrationRequireTerms: boolean;
  authRegistrationDefaultRole: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpHasPassword: boolean;
  smtpFromEmail: string;
  smtpFromName: string;
  developerToolbar: boolean;
  pwa: PwaSettings;
}
