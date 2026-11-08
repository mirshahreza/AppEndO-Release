import type {
  InstallDatabasePayload,
  InstallRedisPayload,
} from '../../shared/api/contracts/install/types';
import {
  isControlPlaneProviderId,
} from '../../shared/api/contracts/install/controlPlaneProviders';
import type { CacheDriver } from '../../shared/api/contracts/cache/types';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import { validateNodeCapabilities } from '../../shared/nodeCapabilities';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import type { InstallWizardStepId } from './installWizardSteps';
import { isSqlServerNamedInstanceHost } from '../../shared/lib/sqlServerAddress';
import { installText } from './installWizardI18n';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type StepValidationResult = {
  valid: boolean;
  message?: string;
};

export const validateDatabaseStep = (
  form: InstallDatabasePayload,
  t?: TranslationFn,
): StepValidationResult => {
  const provider = String(form.provider ?? '').trim().toLowerCase();
  if (!isControlPlaneProviderId(provider)) {
    return { valid: false, message: installText('validation.selectProvider', t) };
  }

  const database = form.database.trim();
  const port = Number(form.port);

  if (provider === 'sqlite') {
    if (!database) {
      return { valid: false, message: installText('validation.sqlitePathRequired', t) };
    }
    return { valid: true };
  }

  const host = form.host.trim();
  const username = form.username.trim();

  if (!host) {
    return { valid: false, message: installText('validation.hostRequired', t) };
  }
  if (!database) {
    return { valid: false, message: installText('validation.databaseRequired', t) };
  }
  if (!username) {
    return { valid: false, message: installText('validation.usernameRequired', t) };
  }
  const sqlServerNamedInstance = provider === 'sqlserver' && isSqlServerNamedInstanceHost(host);
  if (!sqlServerNamedInstance && (!Number.isFinite(port) || port <= 0)) {
    return { valid: false, message: installText('validation.portPositive', t) };
  }

  return { valid: true };
};

export { defaultDatabasePortForProvider } from '../../shared/api/contracts/install/controlPlaneProviders';

export const validateAdminStep = (
  input: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  },
  t?: TranslationFn,
): StepValidationResult => {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim();

  if (!username) {
    return { valid: false, message: installText('validation.adminUsernameRequired', t) };
  }
  if (!email) {
    return { valid: false, message: installText('validation.adminEmailRequired', t) };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { valid: false, message: installText('validation.adminEmailInvalid', t) };
  }
  if (!input.password) {
    return { valid: false, message: installText('validation.adminPasswordRequired', t) };
  }
  if (input.password !== input.confirmPassword) {
    return { valid: false, message: installText('validation.adminPasswordMismatch', t) };
  }

  return { valid: true };
};

export const validateCapabilitiesStep = (
  input: {
    capabilities: NodeCapability[];
    nodeName: string;
  },
  t?: TranslationFn,
): StepValidationResult => {
  const capabilityValidation = validateNodeCapabilities(input.capabilities);
  if (!capabilityValidation.valid) {
    return { valid: false, message: installText('validation.capabilitiesRequired', t) };
  }
  if (!input.nodeName.trim()) {
    return { valid: false, message: installText('validation.nodeNameRequired', t) };
  }
  return { valid: true };
};

export const validateCacheStep = (
  input: {
    driver: CacheDriver;
    redisForm: InstallRedisPayload;
  },
  t?: TranslationFn,
): StepValidationResult => {
  if (input.driver === 'memory') {
    return { valid: true };
  }

  const host = input.redisForm.host.trim();
  const port = Number(input.redisForm.port);

  if (!host) {
    return { valid: false, message: installText('validation.redisHostRequired', t) };
  }
  if (!Number.isFinite(port) || port <= 0) {
    return { valid: false, message: installText('validation.redisPortPositive', t) };
  }

  return { valid: true };
};

export const validateEmailStep = (
  input: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    smtpFromEmail: string;
    smtpFromName: string;
    passwordSaved?: boolean;
  },
  t?: TranslationFn,
): StepValidationResult => {
  const smtpHost = input.smtpHost.trim();
  const smtpUser = input.smtpUser.trim();
  const smtpFromEmail = input.smtpFromEmail.trim().toLowerCase();
  const smtpPort = Number(input.smtpPort);

  if (!smtpHost) {
    return { valid: false, message: installText('validation.smtpHostRequired', t) };
  }
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    return { valid: false, message: installText('validation.smtpPortPositive', t) };
  }
  if (!smtpUser) {
    return { valid: false, message: installText('validation.smtpUserRequired', t) };
  }
  if (!input.smtpPass && !input.passwordSaved) {
    return { valid: false, message: installText('validation.smtpPassRequired', t) };
  }
  if (!smtpFromEmail) {
    return { valid: false, message: installText('validation.fromEmailRequired', t) };
  }
  if (!EMAIL_PATTERN.test(smtpFromEmail)) {
    return { valid: false, message: installText('validation.fromEmailInvalid', t) };
  }

  return { valid: true };
};

export const validateInstallWizardStep = (
  stepId: InstallWizardStepId,
  input: {
    databaseForm: InstallDatabasePayload;
    adminEmail: string;
    adminUsername: string;
    adminPassword: string;
    adminConfirmPassword: string;
    capabilities: NodeCapability[];
    nodeName: string;
    cacheDriver: CacheDriver;
    redisForm: InstallRedisPayload;
    emailForm: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      smtpFromEmail: string;
      smtpFromName: string;
      smtpSecure: boolean;
    };
    emailPasswordSaved?: boolean;
    adminStepEnabled?: boolean;
  },
  t?: TranslationFn,
): StepValidationResult => {
  switch (stepId) {
    case 'welcome':
      return { valid: true };
    case 'database':
      return validateDatabaseStep(input.databaseForm, t);
    case 'cache':
      return validateCacheStep({
        driver: input.cacheDriver,
        redisForm: input.redisForm,
      }, t);
    case 'email':
      return validateEmailStep({
        ...input.emailForm,
        passwordSaved: input.emailPasswordSaved,
      }, t);
    case 'admin':
      if (input.adminStepEnabled === false) {
        return { valid: true };
      }
      return validateAdminStep({
        username: input.adminUsername,
        email: input.adminEmail,
        password: input.adminPassword,
        confirmPassword: input.adminConfirmPassword,
      }, t);
    case 'capabilities':
      return validateCapabilitiesStep({
        capabilities: input.capabilities,
        nodeName: input.nodeName,
      }, t);
    case 'summary':
      return { valid: true };
    default:
      return { valid: true };
  }
};
