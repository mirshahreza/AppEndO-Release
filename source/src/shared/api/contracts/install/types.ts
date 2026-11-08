import type { NodeCapability } from '../../../nodeCapabilities';
import type { ControlPlaneProviderId } from './controlPlaneProviders';

export type { NodeCapability };

export type InstallHealthStatus = 'pass' | 'fail' | 'skip';

export type InstallHealthCheck = {
  id: 'db' | 'redis' | 'scheduler' | 'api';
  label: string;
  status: InstallHealthStatus;
  message: string;
};

export type InstallEnvVarGuide = {
  key: string;
  value: string;
  note: string;
};

import type { CacheDriver } from '../cache/types';

export type InstallCachePayload = {
  driver: CacheDriver;
  redis?: InstallRedisPayload;
};

export type InstallSettingsPublic = {
  pending: boolean;
  completed: boolean;
  completedAt?: string;
  capabilities?: NodeCapability[];
  nodeName?: string;
  overrideExistingObjects?: boolean;
  databaseInitialized?: boolean;
  emailConfigured?: boolean;
  seedSampleData?: boolean;
};

export const INSTALL_WIZARD_API_VERSION = 2;

export type InstallStatusResponse = {
  success: true;
  apiVersion: number;
  install: InstallSettingsPublic;
  defaultDatabase?: {
    provider: ControlPlaneProviderId;
    host: string;
    port: number;
    database: string;
    username: string;
    hasPassword: boolean;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
  defaultCache?: {
    driver: CacheDriver;
    redis?: {
      host: string;
      port: number;
      hasPassword: boolean;
      dbIndex: number;
    };
  };
  defaultEmail?: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    hasPassword: boolean;
    smtpFromEmail: string;
    smtpFromName: string;
    smtpSecure: boolean;
  };
};

export type InstallDatabasePayload = {
  provider: ControlPlaneProviderId;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  overrideExistingObjects?: boolean;
  seedSampleData?: boolean;
};

export type InstallEmailPayload = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpSecure: boolean;
  /** Install wizard only: save settings without verifying SMTP connectivity. */
  skipVerification?: boolean;
};

export type InstallAdminPayload = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileImageBody?: string | null;
  profileImageBodyXs?: string | null;
  profileImageMime?: string | null;
};

export type InstallCapabilitiesPayload = {
  capabilities: NodeCapability[];
  nodeName: string;
};

export type InstallRedisPayload = {
  host: string;
  port: number;
  password?: string;
  dbIndex?: number;
};

export type InstallHealthChecksResponse = {
  success: true;
  checks: InstallHealthCheck[];
  allPassed: boolean;
};

export type InstallCapabilitiesGuideResponse = {
  success: true;
  capabilities: NodeCapability[];
  nodeName: string;
  envVars: InstallEnvVarGuide[];
};

export const INSTALL_COMPLETE_REDIRECT_PATH = '/us/studio' as const;

export type InstallCompleteResponse = {
  success: true;
  message: string;
  redirectTo: string;
  restartRequired: boolean;
};
