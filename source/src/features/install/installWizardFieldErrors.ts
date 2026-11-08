import type {
  InstallDatabasePayload,
  InstallEmailPayload,
  InstallRedisPayload,
} from '../../shared/api/contracts/install/types';
import type { CacheDriver } from '../../shared/api/contracts/cache/types';
import { isControlPlaneProviderId } from '../../shared/api/contracts/install/controlPlaneProviders';
import { isSqlServerNamedInstanceHost } from '../../shared/lib/sqlServerAddress';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type InstallWizardFieldState = {
  invalid: boolean;
  message: string | null;
};

export type InstallWizardFieldsState = Record<string, InstallWizardFieldState>;

const fieldState = (invalid: boolean, message: string | null = null): InstallWizardFieldState => ({
  invalid,
  message,
});

const isFilled = (value: string | number | null | undefined): boolean => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  return Boolean(String(value ?? '').trim());
};

const requiredInvalid = (value: string | number | null | undefined): InstallWizardFieldState =>
  fieldState(!isFilled(value));

export const getDatabaseFieldErrors = (form: InstallDatabasePayload): InstallWizardFieldsState => {
  const provider = String(form.provider ?? '').trim().toLowerCase();
  if (!isControlPlaneProviderId(provider)) {
    return { provider: requiredInvalid(provider) };
  }

  if (provider === 'sqlite') {
    return {
      database: requiredInvalid(form.database),
    };
  }

  const sqlServerNamedInstance = provider === 'sqlserver' && isSqlServerNamedInstanceHost(form.host);
  return {
    host: requiredInvalid(form.host),
    port: sqlServerNamedInstance ? fieldState(false) : requiredInvalid(form.port),
    database: requiredInvalid(form.database),
    username: requiredInvalid(form.username),
  };
};

export const getCacheFieldErrors = (input: {
  driver: CacheDriver;
  redisForm: InstallRedisPayload;
}): InstallWizardFieldsState => {
  if (input.driver !== 'redis') {
    return {};
  }

  return {
    host: requiredInvalid(input.redisForm.host),
    port: requiredInvalid(input.redisForm.port),
  };
};

export const getEmailFieldErrors = (input: {
  form: InstallEmailPayload;
  passwordSaved: boolean;
}): InstallWizardFieldsState => {
  const smtpFromEmail = String(input.form.smtpFromEmail ?? '').trim().toLowerCase();
  const smtpPass = String(input.form.smtpPass ?? '');

  return {
    smtpFromEmail: !smtpFromEmail
      ? requiredInvalid(smtpFromEmail)
      : !EMAIL_PATTERN.test(smtpFromEmail)
        ? fieldState(true, 'Enter a valid email address.')
        : fieldState(false),
    smtpHost: requiredInvalid(input.form.smtpHost),
    smtpPort: requiredInvalid(input.form.smtpPort),
    smtpUser: requiredInvalid(input.form.smtpUser),
    smtpPass: smtpPass || input.passwordSaved ? fieldState(false) : requiredInvalid(smtpPass),
  };
};

export const getAdminFieldErrors = (input: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): InstallWizardFieldsState => {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim();

  let confirmPassword = requiredInvalid(input.confirmPassword);
  if (!confirmPassword.invalid && input.password !== input.confirmPassword) {
    confirmPassword = fieldState(true, 'Passwords do not match.');
  }

  return {
    username: requiredInvalid(username),
    email: !email
      ? requiredInvalid(email)
      : !EMAIL_PATTERN.test(email)
        ? fieldState(true, 'Enter a valid email address.')
        : fieldState(false),
    password: requiredInvalid(input.password),
    confirmPassword,
  };
};

export const getCapabilitiesFieldErrors = (input: {
  nodeName: string;
  isSingleNodeTopology: boolean;
}): InstallWizardFieldsState => {
  if (input.isSingleNodeTopology) {
    return {};
  }

  return {
    nodeName: requiredInvalid(input.nodeName),
  };
};

/** Bind FormField invalid/error from install wizard field state (border-only when message is null). */
export const installWizardFieldProps = (state?: InstallWizardFieldState) => ({
  invalid: Boolean(state?.invalid),
  error: state?.message ?? null,
});
